# PRD: MicroChat MVP

## Introduction

MicroChat is a production-ready, privacy-focused group messaging platform with end-to-end encryption built on the MLS protocol (RFC 9420). The MVP delivers a complete messaging experience for end-users via a web application, with server-side crypto-erasure ensuring deleted groups are permanently unreadable. The platform is designed for edge deployment (Cloudflare Workers) with WebAuthn/passkey authentication.

## Goals

- Deliver a fully functional encrypted group messaging web application
- Implement MLS (RFC 9420) for secure, scalable group encryption
- Provide server-side crypto-erasure when groups are deleted
- Enable passwordless authentication via WebAuthn/passkeys
- Deploy to edge infrastructure (Cloudflare Workers) for low latency
- Maintain minimal metadata retention as defined in THREAT_MODEL.md

## User Stories

### US-001: Initialize MLS crypto package with OpenMLS bindings
**Description:** As a developer, I need the crypto package to provide MLS operations so the system can perform end-to-end encryption.

**Acceptance Criteria:**
- [ ] Integrate OpenMLS or mls-rs library via WASM bindings
- [ ] Implement `MLSClient` interface: `createGroup`, `joinGroup`, `addMember`, `removeMember`, `encrypt`, `decrypt`
- [ ] Generate and manage key packages for users
- [ ] Store group state with epoch tracking
- [ ] Typecheck passes (`pnpm typecheck`)
- [ ] Unit tests for all MLS operations

---

### US-002: Implement key management and crypto-erasure
**Description:** As a system, I need to securely store and delete encryption keys so that crypto-erasure guarantees are met.

**Acceptance Criteria:**
- [ ] Keys stored separately from encrypted content
- [ ] Implement `deleteGroupKeys(groupId)` that securely erases all epoch keys
- [ ] Deletion is logged and auditable
- [ ] After key deletion, decryption attempts fail with clear error
- [ ] Typecheck passes

---

### US-003: Create WebSocket server for real-time messaging
**Description:** As a user, I want to receive messages in real-time so conversations feel instant.

**Acceptance Criteria:**
- [ ] WebSocket server using Cloudflare Durable Objects or compatible runtime
- [ ] Authenticate WebSocket connections via session token
- [ ] Route messages to correct group members
- [ ] Handle connection/disconnection gracefully
- [ ] Support reconnection with message catch-up
- [ ] Typecheck passes

---

### US-004: Implement REST API for group management
**Description:** As a user, I want to create, join, and manage groups so I can organize conversations.

**Acceptance Criteria:**
- [ ] `POST /api/groups` - Create a new group (returns group ID and MLS welcome)
- [ ] `GET /api/groups` - List user's groups
- [ ] `POST /api/groups/:id/members` - Add member (returns MLS commit)
- [ ] `DELETE /api/groups/:id/members/:userId` - Remove member
- [ ] `DELETE /api/groups/:id` - Delete group (triggers crypto-erasure)
- [ ] All endpoints require authentication
- [ ] Typecheck passes

---

### US-005: Implement message send/receive API
**Description:** As a user, I want to send and receive encrypted messages so I can communicate securely.

**Acceptance Criteria:**
- [ ] `POST /api/groups/:id/messages` - Send encrypted message
- [ ] `GET /api/groups/:id/messages` - Fetch message history (encrypted blobs)
- [ ] Messages stored as `EncryptedBlob` (ciphertext + nonce)
- [ ] Server never sees plaintext
- [ ] Pagination support for message history
- [ ] Typecheck passes

---

### US-006: Implement WebAuthn registration flow
**Description:** As a new user, I want to register with a passkey so I don't need a password.

**Acceptance Criteria:**
- [ ] `POST /api/auth/register/options` - Generate registration options
- [ ] `POST /api/auth/register/verify` - Verify and store credential
- [ ] Support platform authenticators (Touch ID, Face ID, Windows Hello)
- [ ] Support cross-platform authenticators (security keys)
- [ ] Store credential public key and metadata
- [ ] Create user account on successful registration
- [ ] Typecheck passes

---

### US-007: Implement WebAuthn authentication flow
**Description:** As a returning user, I want to sign in with my passkey so access is quick and secure.

**Acceptance Criteria:**
- [ ] `POST /api/auth/login/options` - Generate authentication options
- [ ] `POST /api/auth/login/verify` - Verify assertion and create session
- [ ] Session tokens stored securely (httpOnly cookies)
- [ ] Sessions expire after 30 days of inactivity
- [ ] Support "remember this device" for faster re-auth
- [ ] Typecheck passes

---

### US-008: Build client SDK encryption layer
**Description:** As a developer, I need the client SDK to handle encryption/decryption transparently so the web app doesn't manage crypto directly.

**Acceptance Criteria:**
- [ ] `MicroChatClient` class with `connect()`, `disconnect()`, `sendMessage()`, `onMessage()`
- [ ] Automatically encrypt messages before sending
- [ ] Automatically decrypt messages on receipt
- [ ] Handle MLS epoch updates (commits) transparently
- [ ] Emit events for group membership changes
- [ ] Typecheck passes

---

### US-009: Build client SDK group management
**Description:** As a developer, I need the client SDK to manage groups so the web app has a clean API.

**Acceptance Criteria:**
- [ ] `createGroup(name)` - Creates group and initializes MLS state
- [ ] `joinGroup(inviteCode)` - Joins via invite and processes welcome
- [ ] `inviteMember(groupId, userId)` - Generates invite for another user
- [ ] `leaveGroup(groupId)` - Leaves group cleanly
- [ ] `deleteGroup(groupId)` - Deletes group (owner only)
- [ ] Local storage of group state with IndexedDB
- [ ] Typecheck passes

---

### US-010: Create web app authentication pages
**Description:** As a user, I want to register and sign in via the web app so I can access my messages.

**Acceptance Criteria:**
- [ ] `/register` page with passkey registration flow
- [ ] `/login` page with passkey authentication flow
- [ ] Clear error messages for unsupported browsers
- [ ] Redirect to `/chat` on successful auth
- [ ] Redirect unauthenticated users to `/login`
- [ ] Typecheck passes
- [ ] Verify in browser

---

### US-011: Create web app group list view
**Description:** As a user, I want to see my groups so I can choose which conversation to open.

**Acceptance Criteria:**
- [ ] Sidebar showing all user's groups
- [ ] Display group name, member count, last message preview
- [ ] "New Group" button to create a group
- [ ] Unread message indicator
- [ ] Click group to open conversation
- [ ] Typecheck passes
- [ ] Verify in browser

---

### US-012: Create web app conversation view
**Description:** As a user, I want to view and send messages in a group so I can have conversations.

**Acceptance Criteria:**
- [ ] Message list showing decrypted messages
- [ ] Messages display sender name, content, timestamp
- [ ] Auto-scroll to latest message
- [ ] Message input with send button
- [ ] Real-time message updates via WebSocket
- [ ] Loading state while fetching history
- [ ] Typecheck passes
- [ ] Verify in browser

---

### US-013: Create web app group management UI
**Description:** As a user, I want to manage group membership so I can control who's in the conversation.

**Acceptance Criteria:**
- [ ] Group settings panel (accessible from conversation view)
- [ ] Member list with names
- [ ] "Invite" button generating shareable invite link
- [ ] "Remove" button for group owner to remove members
- [ ] "Leave Group" button
- [ ] "Delete Group" button (owner only, with confirmation)
- [ ] Typecheck passes
- [ ] Verify in browser

---

### US-014: Deploy server to Cloudflare Workers
**Description:** As an operator, I want the server deployed to the edge so users get low latency globally.

**Acceptance Criteria:**
- [ ] Wrangler configuration for Workers deployment
- [ ] Durable Objects for WebSocket and group state
- [ ] KV or D1 for persistent storage
- [ ] Environment variables for secrets
- [ ] CI/CD pipeline for automated deployment
- [ ] Health check endpoint (`GET /health`)
- [ ] Typecheck passes

---

### US-015: Implement message retention and cleanup
**Description:** As a system, I need to enforce retention policies so we minimize data exposure.

**Acceptance Criteria:**
- [ ] Delivery receipts deleted after 30 days
- [ ] Messages retained until group deletion or user-initiated delete
- [ ] Background job for retention enforcement
- [ ] Audit log for deletions
- [ ] Typecheck passes

---

### US-016: Add client-side message deletion
**Description:** As a user, I want to delete my own messages so I can remove content I regret sending.

**Acceptance Criteria:**
- [ ] Delete button on user's own messages
- [ ] `DELETE /api/groups/:id/messages/:messageId` endpoint
- [ ] Deleted messages show "Message deleted" placeholder
- [ ] Deletion synced to all group members in real-time
- [ ] Typecheck passes
- [ ] Verify in browser

## Functional Requirements

- FR-1: All messages must be end-to-end encrypted using MLS (RFC 9420)
- FR-2: Server must never have access to plaintext message content
- FR-3: Group deletion must trigger crypto-erasure (key deletion)
- FR-4: Authentication must use WebAuthn/passkeys exclusively (no passwords)
- FR-5: WebSocket connections must be authenticated
- FR-6: All API endpoints must require valid session
- FR-7: Group membership changes must trigger MLS commit/welcome flow
- FR-8: Client must handle MLS epoch transitions transparently
- FR-9: Messages must be delivered in real-time via WebSocket
- FR-10: Message history must be retrievable with pagination
- FR-11: Retention policies must be enforced per THREAT_MODEL.md

## Non-Goals (Out of Scope)

- Push notifications (mobile/desktop)
- File/media attachments
- Voice/video calls
- Message reactions or threading
- Read receipts visible to other users
- User profile customization (avatars, bios)
- Admin dashboard or moderation tools
- Federation with other messaging systems
- Mobile native apps (iOS/Android)
- Offline message queueing (beyond reconnection catch-up)
- Custom MLS ciphersuites

## Technical Considerations

### Architecture
- **Server:** Cloudflare Workers with Durable Objects for WebSocket state
- **Storage:** Cloudflare D1 (SQLite) for messages, KV for sessions
- **Crypto:** OpenMLS compiled to WASM for browser and edge runtime
- **Client:** TypeScript SDK using IndexedDB for local state
- **Web App:** Next.js with React, deployed to Cloudflare Pages

### Dependencies
- OpenMLS or mls-rs (WASM build)
- @simplewebauthn/server and @simplewebauthn/browser
- Hono or itty-router for Workers API routing
- Cloudflare Workers/Durable Objects/D1/KV

### Security
- All secrets in environment variables, never in code
- HTTPS only (enforced by Cloudflare)
- CSP headers to prevent XSS
- Rate limiting on auth endpoints
- No logging of message content or encryption keys

### Existing Code
- `packages/shared/src/types.ts` - Type definitions to extend
- `packages/crypto/src/mls-client.ts` - MLS interface to implement
- `THREAT_MODEL.md` - Security guarantees to uphold

## Success Metrics

- Users can complete registration and login in under 30 seconds
- Message delivery latency < 200ms (P95)
- Group creation to first message < 5 seconds
- Crypto-erasure completes within 1 second of group deletion
- Zero plaintext message exposure in server logs or storage
- WebAuthn works on 95%+ of modern browsers

## Design Decisions

- **Invite links:** Expire after 7 days OR single use (whichever comes first)
- **Max group size:** 100 members for MVP (MLS scales O(log n) but practical limit)
- **Typing indicators:** Deferred post-MVP (metadata exposure concern, not core functionality)
- **User identity:** Require display name at registration (users need to identify each other in groups)
- **Group names:** Encrypted client-side (server cannot see group topics, aligns with threat model)
