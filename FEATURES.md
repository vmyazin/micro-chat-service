# Feature Capabilities

## Audio Messages (Voice Notes)

**Status:** Easily adaptable with current architecture

The existing AES-256-GCM encryption in `packages/crypto/src/group-cipher.ts` can encrypt binary data directly with minimal changes:

1. Modify `encrypt()` to accept `Uint8Array` instead of string plaintext
2. Audio is recorded via Web Audio API, encrypted, and sent as base64-encoded ciphertext
3. The messages table already supports arbitrary encrypted payloads
4. No schema changes required

**Implementation path:**
- Client: Add audio recording (MediaRecorder API)
- Crypto: Extend GroupCipher to handle binary payloads
- UI: Add voice note recording/playback interface

## VOIP Calls

**Status:** Possible but requires significant additions

### Current Architecture Limitations
- WebSocket is for signaling only, not media transport
- No peer-to-peer connection handling
- No real-time media encryption (SRTP)

### Required Additions

1. **WebRTC Integration**
   - Peer connections for bidirectional audio streams
   - MediaStream handling for microphone input

2. **Signaling Extensions**
   - New WebSocket event types: `call-offer`, `call-answer`, `ice-candidate`
   - Call coordination messages

3. **Media Encryption**
   - DTLS-SRTP (built into WebRTC) provides end-to-end encrypted audio
   - Ephemeral keys negotiated per call

4. **Call State Management**
   - Ring, accept, reject, hangup flows
   - Call duration tracking

5. **Infrastructure**
   - STUN/TURN servers for NAT traversal
   - New Durable Object for call session coordination

### Architecture Compatibility

| Component | Compatibility |
|-----------|--------------|
| Existing group keys | Can derive DTLS certificates |
| WebSocket events | Can signal call setup |
| Authentication | Already in place |
| Durable Objects | New DO needed for call coordination |

**Note:** The MLS-based key management supports both use cases—text messages reuse group keys, while VOIP calls would negotiate ephemeral SRTP keys per call via the existing key infrastructure.

## Technical Considerations

- **Audio Messages:** Leverage existing `EncryptedMessage` interface; minimal crypto changes
- **VOIP Calls:** Require new infrastructure layer; WebRTC is the standard approach
- **Security:** Both maintain end-to-end encryption. Audio messages use group keys; VOIP uses DTLS-SRTP
- **Server Load:** Audio messages stored like text; VOIP is peer-to-peer after setup
