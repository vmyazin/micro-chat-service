# Feature Capabilities

Completed items to be marked with ✅.

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

**Status:** Completed (Feb 26, 2026)

- Show as disabled with reduced opacity in group chats (>2 members)
- Native tooltip on hover explains: "Calls are only available in 1-on-1 chats"
- Translations in English, Russian, and Farsi

## Message Lifecycle Countdown

**Status:** Completed (Feb 26, 2026) ✅

- Show countdown timer over a message bubble on hover to indicate how much time left before the message is deleted.

## QR Code For Invites

**Status:** Completed (Feb 26, 2026) ✅

### Implementation Details

- **QR Code Generation**: Uses `qrcode.react` library to generate canvas-based QR codes containing the full invite URL
- **Dialog Display**: InviteQRDialog component displays the QR code in a centered modal with blur backdrop
- **Copy to Clipboard**: Users can copy the QR code image as PNG to clipboard via the clipboard API
- **Download**: Users can download the QR code as a PNG file with timestamp-based naming
- **Group Context**: Displays the group name below the QR code for context
- **Logo Watermark**: The MicroChat logo is overlaid on the QR code as a faint watermark (70% opacity) with a semi-transparent white background for enhanced visibility
- **Multilingual**: Translations in English, Russian, and Farsi

### Components

- **InviteQRDialog.tsx**: New dialog component that displays:
  - QR code canvas (256x256px, high error correction level H)
  - Logo watermark overlay (70% opacity with semi-transparent background)
  - Group name label
  - Copy image button (with success feedback)
  - Download button (with success feedback)
  - Close button

- **GroupSettings.tsx** (updated):
  - Added "Show QR Code" button that appears after invite link is generated
  - Integrated InviteQRDialog as child component
  - Added state management for QR dialog visibility

### Features

- **Logo Watermark**: Canvas-based logo overlay with 70% opacity and semi-transparent background for subtle branding
- **Copy Image**: Copies QR code with logo to clipboard as PNG using Clipboard API
- **Download**: Downloads QR code with logo as timestamped PNG file
- **Visual Feedback**: Buttons show success state (checkmark + "Copied!" / "Downloaded!") that auto-resets after 2 seconds
- **Canvas-Based**: Uses canvas rendering for better control over logo overlay and image export
- **Responsive Design**: Dialog is centered and works on all screen sizes
- **Dark Mode**: Fully themed with CSS custom properties for light/dark modes

### Files Modified

- `apps/web/components/InviteQRDialog.tsx` (new)
- `apps/web/components/GroupSettings.tsx` (updated to add QR button and dialog)
- `apps/web/messages/en.json` (added translations)
- `apps/web/messages/ru.json` (added translations)
- `apps/web/messages/fa.json` (added translations)
- `apps/web/package.json` (added qrcode.react dependency)

## TreeKEM (Ratchet Tree)

**Status:** Completed (Feb 26, 2026) — crypto layer, server/client wiring, and serialization implemented. UI integration pending.

Group members arranged in a left-balanced binary tree where leaf nodes are members, intermediate nodes hold derived key pairs, and the root key is the shared group secret. Achieves O(log N) encryption cost per group operation instead of O(N) pairwise encryption.

- Left-balanced binary tree with ECDH P-256 key pairs at each node
- Path secret derivation via HKDF-SHA-256 from leaf to root
- Path secret encryption to sibling nodes using ephemeral ECDH + AES-GCM
- Operations: createGroup, update (PCS), addMember, removeMember
- Root secret integrates directly with existing GroupCipher.deriveGroupKey()
- 142 tests across math, crypto primitives, tree operations, serialization, manager, and GroupCipher integration

### Server/Client Wiring (Feb 26, 2026)

- D1 migration: `epoch` column on `groups`, `group_tree_state` table for serialized tree snapshots
- Server endpoints: `GET /api/groups/:id/tree-state`, `POST /api/groups/:id/tree-update`
- WebSocket broadcasts: `memberJoined`, `memberLeft`, `treeUpdate` events
- Serialization: `serializeTree/deserializeTree`, `serializeUpdatePath/deserializeUpdatePath` for CryptoKey-safe JSON
- `TreeKEMManager`: client-side per-group orchestrator wrapping TreeKEM + GroupCipher
- `MicroChatClient`: accepts `messageCipher` + `treekemManager`, replaces hardcoded epoch 0
- `useTreeKEM` hook: React lifecycle for init/join/processUpdate (not yet called from UI components)

### Remaining: UI Integration

- `useCreateGroup` / `NewGroupDialog`: call `initGroupTree()` after group creation
- `useWebSocket`: call `handleTreeUpdate()` on `treeUpdate` events
- `useAcceptInvite` / join flows: call `joinGroupTree()` after joining
- `useSendMessage`: pass `treekemManager.getEpoch(groupId)` as epoch

### Files

- `packages/crypto/src/treekem.ts` — main TreeKEM class
- `packages/crypto/src/treekem-math.ts` — left-balanced binary tree index arithmetic
- `packages/crypto/src/treekem-crypto.ts` — ECDH, HKDF, path secret encrypt/decrypt
- `packages/crypto/src/treekem-types.ts` — RatchetTree, UpdatePath, KeyPackage types
- `packages/crypto/src/treekem-errors.ts` — TreeKEMError, TreeKEMDecryptionError
- `packages/crypto/src/treekem-serialization.ts` — serialize/deserialize trees and UpdatePaths
- `packages/client/src/treekem-manager.ts` — per-group TreeKEM orchestration
- `apps/web/hooks/useTreeKEM.ts` — React hook for TreeKEM lifecycle
- `packages/server/src/db/migrations/006_treekem.sql` — epoch + tree state migration

## MLS Protocol (RFC 9420)

**Status:** not implemented. Stub interfaces only in `packages/crypto/src/mls-client.ts`.

Full Messaging Layer Security state machine with Proposals, Commits, and epoch transitions. Each group operation (add, remove, update, send) advances the group to Epoch N+1 with fresh key material.

- Discrete epoch-based group state transitions
- Commit messages that bundle proposals and advance epochs
- Integration with TreeKEM for key agreement
- Requires OpenMLS or mls-rs library integration

## HPKE (Hybrid Public Key Encryption)

**Status:** not implemented. Listed on protocol page as a core primitive.

Asymmetric encryption primitive used by MLS for encrypting path secrets to specific tree nodes. Combines Diffie-Hellman key exchange with symmetric AEAD encryption.

- Encap/decap operations for encrypting to public keys
- Used by TreeKEM to encrypt path secrets to sibling nodes
- Currently only symmetric AES-GCM is used (no asymmetric encryption)

## Forward Secrecy (Per-Message)

**Status:** partial. Epoch-level only, not per-message.

The protocol page describes one-way KDF chains where key material for Epoch N is derived from Epoch N-1 and old keys are deleted. Current implementation uses a static key per epoch (same key + random IV for all messages in that epoch). True forward secrecy requires per-message key ratcheting so compromising one message key doesn't expose other messages in the same epoch.

## Post-Compromise Security

**Status:** partial (Feb 26, 2026). TreeKEM `update()` and `removeMember()` provide PCS healing. UI trigger pending.

When a member's device is compromised, a Key Update from any member generates new entropy that "heals" the tree, locking the attacker out of future messages. TreeKEM propagates new path secrets up the ratchet tree.

- `TreeKEMManager.update()` performs PCS key rotation (fresh leaf key + path secret derivation)
- `TreeKEMManager.removeMember()` blanks compromised leaf and rotates keys
- Server relays `treeUpdate` events to all group members
- Missing: UI button/trigger for manual key rotation, automatic periodic rotation

## TreeKEM UI Integration

**Status:** not implemented. Crypto and server wiring done; chat flow not connected.

`useCreateGroup`, `useWebSocket`, `useAcceptInvite`, and `useSendMessage` must call TreeKEM lifecycle methods. Until wired, messages use epoch 0 / hardcoded keys.

## Message Deletion on Delivery

**Status:** not implemented. Messages are soft-deleted on a timer, not removed after delivery.

Security page claims "0 days post-delivery" retention. Actual schema uses `deleted_at` (time-based). Delivery receipts with timestamps are stored indefinitely in `delivery_receipts`.

## Third-Party Security Audit

**Status:** not obtained. Target: Trail of Bits audit before v1.0.

Security page references a Trail of Bits audit, SOC 2 Type II, GDPR, and CCPA compliance. These are aspirational targets to fulfill prior to launch, not current state.

## Update Security Page: Authentication Description

**Status:** not done. Security page describes bcrypt-hashed credentials; actual auth is WebAuthn (FIDO2) via `@simplewebauthn/server`. Copy needs to reflect the real auth mechanism.

## Full MLS Protocol Conformance

**Status:** not implemented. Homepage badge reads "Built on MLS Protocol / RFC 9420." Current implementation is a custom TreeKEM approach. Achieving conformance is the long-term goal; copy should be updated to reflect the current TreeKEM foundation until full MLS is implemented.

## HPKE Implementation

**Status:** not implemented. Protocol page lists HPKE as a core primitive. Currently only symmetric AES-GCM is used. HPKE is on the roadmap as a dependency for full MLS conformance.

## Minimize Server-Side Metadata

**Status:** not implemented. Security page aspires to zero contact graph or timestamp logging. Currently the server stores plaintext `sender_id`, `created_at`, and `delivery_receipts(user_id, delivered_at)`. The goal is to minimize or encrypt this metadata so the claim holds.

## Sealed Sender on Calls (Full Coverage)

**Status:** partial. Sealed sender for call signaling degrades to plaintext `fromUserId` when `callCipher` is absent, which is the case until TreeKEM UI integration is complete. Full coverage is the target once TreeKEM is wired into the chat flow.

## "How It Works" Button

**Status:** not implemented. Homepage CTA button has no `href`, `onClick`, or scroll target — it does nothing.

## Call Events In Chat UI

**Status:** not implemented. Call events aren't logged in the chat UI.

- Display missed calls in the chat UI
- Display accept/reject in the chat UI
- Display call duration in the completed call record