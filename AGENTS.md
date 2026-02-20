# MicroChat Development Guide

## Package Manager

Use **pnpm** for all package management.

## Commands

- **Build:** `pnpm build`
- **Test:** `pnpm test`
- **Typecheck:** `pnpm typecheck`
- **Development:** `pnpm dev`
- **D1 Migrations (local):** `cd packages/server && pnpm wrangler d1 migrations apply microchat-db --local`
- **D1 Migrations (remote):** `cd packages/server && pnpm wrangler d1 migrations apply microchat-db --remote`

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
| Sealed Sender token utils | `packages/crypto/src/sealed-sender.ts` |
| Client-side token pool | `packages/client/src/sender-token-store.ts` |

## Runtime Architecture

**Authentication:** WebAuthn passkeys via `@simplewebauthn/server`. Challenges stored in D1 (per-isolate). Session is an `httpOnly` cookie (30-day expiry). See `packages/server/src/routes/auth.ts`.

**Real-time Messaging:** Singleton `ChatHub` Durable Object handles WebSocket connections. Clients subscribe to groups; server fans out via internal `POST /broadcast`. See `packages/server/src/websocket/chat-hub.ts`.

**E2E Encryption:** AES-256-GCM per-group-epoch keys. Server stores only ciphertext + nonce (blind to content). `GroupCipher` handles encrypt/decrypt. See `packages/crypto/src/group-cipher.ts`.

**Sealed Sender:** Token-based sender anonymity. Clients prefetch one-time tokens via `POST /api/groups/:id/sender-tokens`; server stores only SHA-256 hashes (unlinkable to user). Messages sent with a token have `sender_id = NULL` in DB. Sender identity is encrypted in `sealedSender` field, decryptable only by group members. See `packages/crypto/src/sealed-sender.ts` and `packages/client/src/sender-token-store.ts`.

## Conventions & Gotchas

- **D1 migrations live in `packages/server/src/db/migrations/`** — run wrangler commands from `packages/server` directory
- **Rate limiting is per-isolate** — not globally consistent across Workers instances
- **`MessageClient` sends plaintext without an injected `GroupCipher`** — development mode fallback
- **Group names are currently unencrypted** — stored as `encrypted_name` but sent as plaintext
- **Next.js rewrites `/api/*` to Workers** — no CORS config needed; the web app only talks to its own origin
- **Use `db.batch([...])` for atomic multi-table operations** — e.g., cascading delete on group removal
- **`packages/server` runs on Cloudflare Workers** — target environment is `wrangler dev` / `wrangler deploy`, not Node.js

### API and Business Logic Testing Guidelines

- Split endpoints into `route -> controller -> service`:
- Route: thin, uses `createApiHandler`; do not test framework plumbing.
- Controller: orchestrates inputs/user context; minimal tests where logic exists.
- Service: contains pure, testable logic;
	- handle impure services (mock the dependency, test the logic around it).
- Test behaviors, not trivial implementation details:
- Good: access validation outcomes, null/edge short-circuits, result parsing.
- Avoid: asserting string concatenation, default `.trim()` behavior, or framework defaults (e.g., auth required by default).
- Don't test routes — they're thin wrappers; test services instead
- Don't test syntax — avoid checking SQL strings or internal implementation details
- Don't test API integration at all
- Test outcomes — given proper inputs and mocked dependencies, does the function return correct results?
- File naming/location convention — `*.test.ts` colocated in `/features` or alongside routes

## Commits

Provide a concise and descriptive commit message after finishing a job in a markdown snippet. Do not automatically commit changes.

## HTML Semantic Structure and Class Naming Conventions

When creating HTML elements, follow these guidelines:

1. **Use semantic HTML elements** whenever possible (`header`, `nav`, `main`, `section`, `article`, etc.)
2. **Apply descriptive class names** that indicate purpose
3. **Use single dash as separator** for improved readability
4. **Keep class names simple and intuitive**

**Class Naming Pattern:**
- `{component}-{element}`
- `{purpose}-{variant}`

**Examples:**
- `sidebar-nav`, `sidebar-item`, `sidebar-header`
- `gallery-grid`, `gallery-item`, `gallery-thumbnail`
- `card-featured`, `card-compact`

## Linting

- Always run linting first with `pnpm lint` before proceeding to build
- Never run a build automatically — instead, suggest "Run `pnpm build` to build the project."