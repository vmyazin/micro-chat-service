# Voice Calls

MicroChat supports 1-to-1 audio calls using WebRTC with privacy-first design. The server never touches media — it only relays signaling messages between peers.

## Architecture

```
Caller                    Server (ChatHub DO)              Callee
  |                            |                              |
  |-- callOffer (SDP) -------->|-- callOffer (SDP) ---------> |
  |                            |                              |
  |<- callAnswer (SDP) --------|<- callAnswer (SDP) --------- |
  |                            |                              |
  |-- iceCandidate ----------->|-- iceCandidate ------------> |
  |<- iceCandidate ------------|<- iceCandidate ------------- |
  |                            |                              |
  |<========== P2P audio (DTLS-SRTP) ======================>  |
```

### Components

| Component | Location | Role |
|-----------|----------|------|
| `CallClient` | `packages/client/src/call-client.ts` | WebRTC peer connection management, state machine, ICE handling |
| `WebSocketClient` | `packages/client/src/websocket-client.ts` | Transport layer for signaling events |
| `ChatHub` | `packages/server/src/websocket/chat-hub.ts` | Durable Object that relays signaling between peers |
| `callsRouter` | `packages/server/src/routes/calls.ts` | `GET /api/calls/ice-servers` — generates TURN credentials |
| `call-cipher` | `packages/crypto/src/call-cipher.ts` | Sealed-sender caller identity encryption |

### Call state machine

```
idle -> ringing-out (caller) / ringing-in (callee)
     -> connecting (SDP exchanged)
     -> active (P2P established)
     -> ended (cleanup)
```

### Signaling events

All signaling flows through WebSocket JSON messages via the ChatHub Durable Object:

- `callOffer` — SDP offer + optional sealed-sender identity
- `callAnswer` — SDP answer
- `iceCandidate` — trickle ICE candidates
- `callEnd` — termination with reason (`hangup`, `rejected`, `missed`, `error`)
- `callRinging` — reserved for future ring-back indication

## NAT Traversal / ICE

Establishing a peer-to-peer connection requires traversing NATs and firewalls. The system uses a layered ICE server strategy:

### Server-side (`GET /api/calls/ice-servers`)

1. **Primary** — Cloudflare Calls TURN (credentials generated per-session, 1-hour TTL)
2. **Fallback** — `ICE_FALLBACK_SERVERS` env var (Cloudflare secret in production). Currently Metered TURN with multiple transports including TURNS on port 443/TCP.
3. **Last resort** — STUN-only from Cloudflare, Nextcloud, and Google

### Client-side defaults

If the server endpoint is unreachable, the client falls back to STUN-only:

```
stun:stun.cloudflare.com:3478
stun:stun.nextcloud.com:443
stun:stun.l.google.com:19302
```

### Why multiple TURN transports matter

Restrictive networks (corporate firewalls, Russian ISPs with DPI) often block UDP entirely or throttle non-standard ports. The Metered TURN config includes:

| Transport | Purpose |
|-----------|---------|
| `stun:...:80` | Basic NAT discovery over a common port |
| `turn:...:80?transport=udp` | TURN relay over UDP (fastest) |
| `turn:...:80?transport=tcp` | TURN relay over TCP on port 80 |
| `turn:...:443?transport=tcp` | TURN relay over TCP on port 443 (looks like HTTPS) |
| `turns:...:443?transport=tcp` | TURN over TLS on 443 (indistinguishable from HTTPS to DPI) |

The browser tries candidates in preference order. In practice, `turns:443/tcp` is the last-resort path that gets through almost any network.

## Security

### Media encryption

All WebRTC media is encrypted with DTLS-SRTP by default — this is built into the protocol and cannot be disabled. The server never has access to media content.

### Sealed-sender caller identity

The caller's identity is hidden from the server using AES-GCM encryption derived from the group's shared key:

1. A per-call signing key is derived via HKDF-SHA256 from the group epoch key
2. Salt: `SHA-256("microchat-call-salt-{callId}")`, truncated to 16 bytes
3. Info: `"microchat-call-{groupId}-{callId}"`
4. The caller's userId and name are encrypted with AES-256-GCM using a random 12-byte IV
5. The encrypted blob travels in the `sealedSender` field of `callOffer`
6. Only group members (who have the epoch key) can decrypt

This means the ChatHub relay knows a call is happening in a group, but not who initiated it.

### Sender token pool

Outgoing calls optionally carry a `senderToken` from the same pool-based system used for messages. This allows the server to authorize delivery without learning the sender's identity.

### Signaling authentication

WebSocket connections require a valid session cookie. The ChatHub validates authentication before relaying any signaling events.

## Reliability

### ICE restart on failure

When the connection state reaches `failed`, the caller side automatically attempts an ICE restart by creating a new offer with `{ iceRestart: true }`. This renegotiates ICE candidates through potentially different network paths without tearing down the call. If the restart also fails, the call is ended.

The `iceRestartAttempted` flag resets on successful connection, so a call that recovers and then fails again gets another restart attempt.

### Disconnect grace period (15 seconds)

Transient disconnections (network switches, brief packet loss) are common, especially on mobile or high-latency routes. When the connection state changes to `disconnected`, a 15-second timer starts. If the connection recovers within that window, the timer is cancelled and the call continues. If not, the call is hung up.

### Connection setup timeout (30 seconds)

If a call stays in `ringing-out` or `connecting` for more than 30 seconds without reaching `active`, it auto-hangs up. This prevents the UI from getting stuck on a call that will never connect.

### ICE candidate queuing

ICE candidates received before the remote SDP description is set are queued in memory and flushed once `setRemoteDescription` completes. Candidates that fail with `InvalidStateError` are re-queued rather than dropped.

### WebSocket auto-reconnect

The WebSocket transport has exponential backoff reconnection (1s, 2s, 4s, 8s, 16s) up to 5 attempts. Group subscriptions are automatically re-sent on reconnect.

## Future enhancements

Potential improvements roughly ordered by impact:

- **ICE candidate type logging** — Emit structured logs of gathered candidate types (host/srflx/relay) so connectivity issues can be diagnosed remotely without access to the browser console
- **Codec preferences** — Explicitly prefer Opus with constrained bitrate (e.g., 32kbps) for calls over relay paths to reduce bandwidth and improve quality on slow links
- **Call quality metrics** — Periodically sample `RTCPeerConnection.getStats()` for round-trip time, jitter, and packet loss; surface in UI or log for post-call diagnostics
- **Network type detection** — Use `navigator.connection` API where available to adapt behavior (e.g., automatically prefer relay on metered/slow connections)
- **Opting in to relay-only mode** — Allow users in restrictive networks to force `iceTransportPolicy: 'relay'` to skip direct connection attempts that will always fail, reducing call setup time
- **Self-hosted TURN (coturn)** — Deploy a coturn instance on a VPS geographically close to users in restrictive regions (e.g., Finland for Russia) for lower latency than commercial TURN providers
- **Group calls** — Multi-party audio using an SFU (Selective Forwarding Unit) architecture rather than mesh, to keep bandwidth manageable
- **Call history persistence** — Store call metadata (participants, duration, outcome) in D1 for a proper call log rather than synthetic chat messages

## VPS Plan

/Users/vm/.claude/plans/magical-roaming-pine.md
