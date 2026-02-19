# MicroChat Development Guide

## Package Manager

Use **pnpm** for all package management.

## Commands

- **Build:** `pnpm build`
- **Test:** `pnpm test`
- **Typecheck:** `pnpm typecheck`
- **Development:** `pnpm dev`

## Structure

```
packages/
├── server/   # Backend API, WebSocket server, message routing
├── client/   # Client SDK for encryption, sending, receiving
├── crypto/   # MLS protocol (RFC 9420), key management, crypto-erasure
└── shared/   # Shared TypeScript types and utilities

apps/
└── web/      # Web application frontend
```

## Conventions

- TypeScript strict mode enabled
- Path aliases: `@microchat/server`, `@microchat/client`, `@microchat/crypto`, `@microchat/shared`
- ES2022 target

## Package Dependency Graph

```
shared ← crypto ← client ← web (app)
shared ← server (standalone backend)
```

Note: `server` is not imported by any other package (it's the runtime). All other packages import from `shared`.

## Key Types & Canonical Files

| Purpose | File |
|---------|------|
| Branded IDs, `Message`, `WebSocketEvent` union | `packages/shared/src/types.ts` |
| TTL constants, group size limits | `packages/shared/src/constants.ts` |
| DB row types | `packages/server/src/db/schema.ts` |
| `EncryptedMessage` interface | `packages/crypto/src/group-cipher.ts` |
| `KeyStore` interface | `packages/crypto/src/key-store.ts` |

## Runtime Architecture

**Authentication:** WebAuthn passkeys via `@simplewebauthn/server`. Challenges stored in D1 (per-isolate). Session is an `httpOnly` cookie (30-day expiry). See `packages/server/src/routes/auth.ts`.

**Real-time Messaging:** Singleton `ChatHub` Durable Object handles WebSocket connections. Clients subscribe to groups; server fans out via internal `POST /broadcast`. See `packages/server/src/websocket/chat-hub.ts`.

**E2E Encryption:** AES-256-GCM per-group-epoch keys. Server stores only ciphertext + nonce (blind to content). `GroupCipher` handles encrypt/decrypt. See `packages/crypto/src/group-cipher.ts`.

## Conventions & Gotchas

- **Rate limiting is per-isolate** — not globally consistent across Workers instances
- **`MessageClient` sends plaintext without an injected `GroupCipher`** — development mode fallback
- **Group names are currently unencrypted** — stored as `encrypted_name` but sent as plaintext
- **Next.js rewrites `/api/*` to Workers** — no CORS config needed; the web app only talks to its own origin
- **Use `db.batch([...])` for atomic multi-table operations** — e.g., cascading delete on group removal
- **`packages/server` runs on Cloudflare Workers** — target environment is `wrangler dev` / `wrangler deploy`, not Node.js
