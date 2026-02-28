# Milestones

## v1.0 MVP (Shipped: 2026-02-28)

**Phases:** 4 | **Timeline:** 36 days (2026-01-23 → 2026-02-28)
**Commits:** ~252 | **TypeScript LOC:** ~25,459

**Key accomplishments:**
1. Real-time group chat on Cloudflare Workers + Durable Objects with WebSocket transport
2. Voice calls via WebRTC with call event display in the chat UI
3. Custom TreeKEM protocol for end-to-end encrypted group messaging with epoch-based key rotation
4. TreeKEM lifecycle wired to all UI flows — group creation, invite acceptance, and all message types (text, voice, image)
5. IndexedDB key persistence so encryption keys survive page reloads with auto re-init from server on app start
6. Invite system with welcome message flow for new group members joining encrypted sessions

**Archive:** `.planning/milestones/v1.0-ROADMAP.md`

---
