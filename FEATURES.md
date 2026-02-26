# Feature Capabilities

## Audio Messages (Voice Notes)

**Status:** Completed (implemented Feb 19, 2026)

The existing AES-256-GCM encryption in `packages/crypto/src/group-cipher.ts` can encrypt binary data directly with minimal changes:

1. Modify `encrypt()` to accept `Uint8Array` instead of string plaintext
2. Audio is recorded via Web Audio API, encrypted, and sent as base64-encoded ciphertext
3. The messages table already supports arbitrary encrypted payloads
4. No schema changes required

**Implementation path:**
- Client: Add audio recording (MediaRecorder API)
- Crypto: Extend GroupCipher to handle binary payloads
- UI: Add voice note recording/playback interface

## Voice Calls (1-to-1)

**Status:** Completed (Feb 20, 2026) — Full implementation with sealed-sender and TURN

End-to-end encrypted audio calls between two members of a group using WebRTC.

### Scope

| Aspect | Decision |
|--------|----------|
| Call type | 1-to-1 audio only (no video, no group calls) |
| Call button | Hidden in groups with >2 members |
| Signaling privacy | Sealed-sender (caller identity hidden from server) |
| Missed calls | Synthetic system message in chat |
| TURN credentials | Fresh per call via `GET /api/calls/ice-servers` |

### Phase 1 — Types + Signaling Plumbing (Completed Feb 20, 2026)

- Added call signaling types (`CallId`, `CallState`, and WebSocket event variants).
- ChatHub now relays `callOffer`, `callAnswer`, `iceCandidate`, and `callEnd` and bounces missed calls.
- `GET /api/calls/ice-servers` returns public STUN (Google) only.
- Client `CallClient` stub sends fake SDP and logs incoming call events.
- Web UI renders the call button for 1:1 groups and logs incoming call events.

### Phase 2 — WebRTC Audio (Completed Feb 20, 2026)

- **Real WebRTC peer-to-peer audio**: `RTCPeerConnection`, `getUserMedia`, ICE trickle, SDP exchange.
- **IncomingCallModal**: Full-screen ring screen with caller name, Accept/Reject buttons, 30s timeout.
- **ActiveCallOverlay**: In-call bar with mute toggle, duration timer (MM:SS), hangup button.
- **CallSession state machine**: `idle → ringing-out → connecting → active → ended` for outgoing, `idle → ringing-in → connecting → active → ended` for incoming.
- **Missed call system messages**: Synthetic message appears in chat when call ends with `reason: 'missed'`.
- **Caller identity plaintext**: Sent as `fromUserId` in signaling (sealed-sender in Phase 3).
- **Public STUN only**: `stun.l.google.com` (TURN infrastructure in Phase 3).

### Phase 3 — Sealed Sender + TURN Infrastructure (Completed Feb 20, 2026)

- **Multi-provider TURN**: Cloudflare Calls API (primary) + coturn fallbacks on Hetzner/OVH.
- **Fresh credentials per call**: `GET /api/calls/ice-servers` generates short-lived TURN credentials.
- **ICE server caching**: Client caches ICE servers with TTL expiration.
- **Sealed-sender call signaling**: Caller identity encrypted via AES-GCM with HKDF-derived ephemeral keys.
- **Call cipher**: `deriveCallSigningKey()` derives per-call keys from group epoch keys.
- **Graceful degradation**: Calls work without sealed-sender if `callCipher` not provided; caller identity shown as plaintext.
- **Caller identity decryption**: Incoming calls decrypt `sealedSender` field to display caller name in modal.

### Architecture

```
Caller                 ChatHub DO                  Callee
  │                       │                          │
  │── callOffer ─────────▶ (sealed-sender token)   │
  │                       │── callOffer ────────────▶│
  │                       │◀── callAnswer ───────────│
  │◀── callAnswer ────────│                          │
  │◀──── iceCandidate ────│── iceCandidate ─────────▶│
  │                                                   │
  │◀══════════ WebRTC P2P (DTLS-SRTP audio) ═════════▶│
```

The `ChatHub` Durable Object acts as a **signaling relay only**. Media flows peer-to-peer via DTLS-SRTP (built into WebRTC).

### Components

**1. Shared Types (`packages/shared/src/types.ts`)**

```ts
export type CallId = string & { readonly __brand: 'CallId' };
export type CallState = 'idle' | 'ringing-out' | 'ringing-in' | 'connecting' | 'active' | 'ended';

// WebSocketEvent additions:
| { type: 'callOffer';    groupId: GroupId; callId: CallId; toUserId: UserId;
    fromUserId: UserId | null; sealedSender?: string; sdp: string; timestamp: string; }
| { type: 'callAnswer';   groupId: GroupId; callId: CallId;
    fromUserId: UserId | null; sealedSender?: string; sdp: string; }
| { type: 'iceCandidate'; groupId: GroupId; callId: CallId;
    fromUserId: UserId | null; sealedSender?: string; candidate: RTCIceCandidateInit; }
| { type: 'callEnd';      groupId: GroupId; callId: CallId;
    fromUserId: UserId | null; sealedSender?: string;
    reason: 'hangup' | 'rejected' | 'missed' | 'error'; }
| { type: 'callRinging';  groupId: GroupId; callId: CallId; }
```

**2. Server Signaling (`packages/server/src/websocket/chat-hub.ts`)**

- Add `sendToUser(targetUserId, event)` for unicast delivery
- Relay call events to specific recipient only (not broadcast)
- Bounce `callEnd { reason: 'missed' }` to caller if callee offline

**3. ICE Server Endpoint (`packages/server/src/routes/calls.ts`)**

```
GET /api/calls/ice-servers
→ { iceServers: RTCIceServer[], ttl: number }
```

Generates fresh Cloudflare Calls TURN credentials on each request. Returns merged list:
- Primary: Cloudflare Calls TURN
- Fallbacks: Self-hosted coturn on Hetzner/OVH (resilient to CF/GCP blocking)
- Public STUN: `stun.l.google.com:19302`

**4. Call Cipher (`packages/crypto/src/call-cipher.ts`)** — new file

```ts
deriveCallSigningKey(groupCipher, groupId, epoch, callId): Promise<CryptoKey>
encryptCallerId(callerId, callerName, key): Promise<string>
decryptCallerId(sealed, key): Promise<SealedSenderPayload>
```

Derives an ephemeral AES-256-GCM key from the group epoch key + callId via HKDF. Used for sealed-sender call signaling (encrypting caller identity).

**5. Call Client (`packages/client/src/call-client.ts`)** — new file

```ts
class CallClient {
  startCall(groupId, targetUserId, cipher, epoch): Promise<CallSession>
  onIncomingCall(handler): () => void
  onMissedCall(handler): () => void
}

class CallSession {
  callId: CallId
  groupId: GroupId
  direction: 'outgoing' | 'incoming'
  remoteUserId: UserId | null
  remoteUserName: string | null
  localStream: MediaStream
  remoteStream: MediaStream
  state: CallState

  accept(): Promise<void>   // incoming only
  reject(): Promise<void>   // incoming only
  hangup(): Promise<void>
}
```

WebRTC orchestration: `getUserMedia`, `RTCPeerConnection`, ICE trickle, SDP exchange, state management.

**6. Web UI**

| Component | Purpose |
|-----------|---------|
| `CallButton.tsx` | Phone icon in conversation header (hidden if group >2 members) |
| `IncomingCallModal.tsx` | Full-screen ring screen: caller name, accept/reject, 30s timeout |
| `ActiveCallOverlay.tsx` | In-call bar: mute toggle, duration timer, hangup |
| `useCall.ts` | React hook wrapping `CallClient` state and events |

Missed calls render as synthetic system messages: `"Missed call from X"`.

### Infrastructure

**Environment variables (`wrangler.toml`):**

```toml
CLOUDFLARE_CALLS_APP_ID = "..."
CLOUDFLARE_CALLS_TOKEN  = "..."   # secret
ICE_FALLBACK_SERVERS    = '[{"urls":"turn:...","username":"...","credential":"..."}]'
```

**No new Durable Objects.** The existing `ChatHub` handles signaling relay. Call state is entirely client-managed.

**No D1 schema changes.** Calls are ephemeral (no persistent call history).

### State Transitions

```
idle → ringing-out → connecting → active → ended   (outgoing)
idle → ringing-in  → connecting → active → ended   (incoming, accepted)
idle → ringing-in  → ended                         (incoming, rejected/missed)
```

### Out of Scope

- Call history / CDRs
- Video
- Group calls (>2 participants)
- Screen sharing
- Call recording
- Push notifications for incoming calls

## Technical Considerations

- **Audio Messages:** Leverage existing `EncryptedMessage` interface; minimal crypto changes
- **Voice Calls:** WebRTC with DTLS-SRTP for E2E encrypted media; sealed-sender for signaling privacy
- **Security:** Audio messages use group keys; voice calls use DTLS-SRTP (WebRTC-native) + sealed-sender signaling
- **Server Load:** Audio messages stored like text; voice calls are peer-to-peer after signaling
- **NAT Traversal:** Multi-provider TURN (Cloudflare + self-hosted) for resilience in restricted networks

## Display Users' Online Status

**Status:** Completed (Feb 22, 2026)

### UX Improvements
- **Visual Indicator:** Show a clear, accessible green dot (with a subtle pulse animation when coming online) next to the user's avatar in 1-on-1 chats, group member lists, and the sidebar.
- **Real-time State:** Instantly reflect online/offline transitions without requiring page refreshes using WebSocket events.
- **Accessibility:** Include descriptive `aria-label`s or visually hidden text (e.g., `<span class="sr-only">Online</span>`) for screen readers.
- **Group Context:** In group chats, display a summary such as "3 members online" under the group name, expanding to show who is active when hovered or clicked.

## Display Users' Last Seen

**Status:** not implemented.

### UX Improvements
- **Human-Readable Timestamps:** Display relative, easily digestible times (e.g., "Last seen 5 mins ago", "Last seen yesterday at 14:00") below the user's name in 1-on-1 conversations.
- **Smooth Transitions:** Crossfade the "Last seen" text with "Typing..." indicators using smooth animations to avoid jarring layout shifts.
- **Privacy Controls:** Allow users to opt-out of sharing their last seen timestamp in settings. If both users disable it, hide the indicator entirely or show a generic "Offline" state.
- **Graceful Degradation:** If the device is offline or the server falls out of sync, gracefully fallback to the latest cached timestamp without showing error states.

## Use Framer Animations In Calls

**Status:** Completed (Feb 26, 2026)

### UX Improvements
- **Incoming Call:** Animate the call modal bounding into view from the top of the screen to the center using spring physics. Add a continuous, soft pulsing glow effect behind the "Accept" button.
- **Active Call Morphing:** Use Framer Motion's `layoutId` to transform the large incoming call modal down into the compact active call status bar when a call is accepted with a fluid structural morph.
- **Call End Animation:** Seamlessly transform the status bar from the active call state back to the default chat header, using an elegant shrink, slide-up, and fade-out sequence.

## Message Delivery & Read Receipts

**Status:** not implemented.

Telegram-style double-check indicators showing whether a message has been delivered to the recipient's device and whether they have actually read it.

### Visual Indicators

- **Sent (single check):** Message reached the server. Shown immediately after the server acknowledges the message.
- **Delivered (double check):** Message was delivered to the recipient's device via WebSocket. Server sends a `messageDelivered` event back to the sender when the recipient's client confirms receipt.
- **Read (double check, colored):** Recipient scrolled the message into view. Client sends a `messageRead` event; sender's check marks turn blue/accent-colored.
- **Group chats:** Show delivered when **all** members have received it, and read when **all** members have read it. Optionally show per-member receipt detail on long-press/click.

### Implementation Path

**1. Shared Types (`packages/shared/src/types.ts`)**

New WebSocket event variants:

```ts
| { type: 'messageDelivered'; groupId: GroupId; messageId: string; userId: UserId; timestamp: string }
| { type: 'messageRead';      groupId: GroupId; messageId: string; userId: UserId; timestamp: string }
| { type: 'receiptUpdate';    groupId: GroupId; messageId: string; status: 'delivered' | 'read'; count: number; total: number }
```

**2. Server (`packages/server`)**

- Add `message_receipts` D1 table: `(message_id, user_id, delivered_at, read_at)` — tracks per-user delivery and read state.
- On `messageDelivered` / `messageRead` from a client, upsert the receipt row and broadcast a `receiptUpdate` summary to the sender (aggregated count vs total members).
- Receipts are lightweight — no encryption needed since they contain only message IDs and timestamps (no content).

**3. Client SDK (`packages/client`)**

- On receiving a message via WebSocket, automatically send `messageDelivered` back to the server.
- Expose `markAsRead(groupId, messageIds)` for the UI to call when messages scroll into the viewport.
- Track receipt state per message in the local query cache.

**4. Web UI**

| Component | Change |
|-----------|--------|
| `MessageBubble` | Render check marks next to timestamp on own messages: single gray (sent), double gray (delivered), double accent (read) |
| `ConversationPage` | Use `IntersectionObserver` on message elements to detect visibility and batch `markAsRead` calls |
| Zustand/React Query | Cache receipt state; update optimistically on send, then reconcile with server events |

### Privacy Considerations

- Read receipts should be opt-out per user (setting stored server-side). If disabled, that user's client never sends `messageRead` events, and their messages show delivery status only (no read marks).
- Delivery receipts are always sent (not optional) since they don't reveal reading intent.

### Out of Scope

- Typing indicators ("User is typing...")
- Message editing receipts
- Delivery/read timestamps visible to the user (just the check marks)

## Call Button

- Show as disabled if more than one user in chat
- Show tooltip on hover with reason why it's disabled
