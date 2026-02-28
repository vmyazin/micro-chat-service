# MicroChat — Project

## What This Is

A secure, end-to-end encrypted messaging service for small groups. Built on Cloudflare Workers, WebRTC, and a custom TreeKEM protocol for group key management.

## Core Value

End-to-end encryption that works without a central key server — the TreeKEM protocol means the server never sees decrypted content or keys.

## Requirements

### Validated

- ✓ Real-time group chat — v1.0
- ✓ Voice calls via WebRTC — v1.0
- ✓ End-to-end encryption with TreeKEM — v1.0
- ✓ Invite system for group membership — v1.0
- ✓ IndexedDB key persistence across page reloads — v1.0
- ✓ Epoch-based key rotation for forward secrecy — v1.0

### Active

- [ ] Mobile-responsive UI polish
- [ ] File/image sharing
- [ ] Read receipts
- [ ] Group member management (remove members, rotate keys on leave)

### Out of Scope

- Native mobile apps — web-first, PWA approach
- Self-hosted key server — the whole point is serverless key management
- Federation / multi-server — monolithic Cloudflare Workers deployment

## Context

Shipped v1.0 MVP with ~25,459 LOC TypeScript across monorepo (packages/server, packages/crypto, packages/client, packages/shared, apps/web).

**Tech stack:** Next.js (frontend), Cloudflare Workers + Hono (backend), Durable Objects (WebSocket rooms), D1 (SQLite), custom TreeKEM crypto package, WebRTC via Cloudflare TURN.

**Key decisions:**
- TreeKEM epoch 0 = uninitialized; always guard before using keys
- IndexedDBKeyStore for messages, MemoryKeyStore for call keys (deterministic derivation)
- Tree init failure → degrade silently, never block the user
- Server validates epoch optimistic locking (409 on stale epoch, client retries)

## Key Decisions

| Decision | Outcome | Status |
|----------|---------|--------|
| TreeKEM over Signal Protocol | Custom TreeKEM allows serverless key management | ✓ Good |
| Cloudflare Durable Objects for rooms | Single-region latency acceptable for MVP | ✓ Good |
| Epoch 0 = degrade, don't block | Smooth UX even before tree initializes | ✓ Good |
| IndexedDB key persistence | Keys survive page reload without re-prompting | ✓ Good |
| Quick-task workflow for phase 4 | Skipped formal planning overhead for a small integration | ✓ Good |

---
*Last updated: 2026-02-28 after v1.0 milestone*
