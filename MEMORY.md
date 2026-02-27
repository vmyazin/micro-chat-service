# MicroChat Service Memory

## Project Structure
- Monorepo: `apps/web` (Next.js), `packages/crypto`, `packages/client`, `packages/server`, `packages/shared`
- Server: Cloudflare Workers + Durable Objects (`ChatHub`), D1 database
- Package manager: `bun` (also `pnpm` for workspace test runner)
- Linter: Biome (`bun run lint`)
- Type check: `npx tsc --noEmit -p apps/web/tsconfig.json`
- Tests: `pnpm test` (vitest per package)

## Key Architectural Notes
- `packages/shared/dist` must be rebuilt (`bun run --cwd packages/shared build`) when types change — web app uses compiled dist
- `packages/crypto/dist` and `packages/client/dist` similarly need rebuilding after source changes
- `apps/web/tsconfig.json` has `skipLibCheck: true` and `moduleResolution: bundler`
- Pre-existing type errors in `useTreeKEM.ts` lines 28/35 (Uint8Array<ArrayBufferLike> ↔ BufferSource) — ignore
- Pre-existing test failures in `call-client.test.ts` (18 tests): `RTCPeerConnection is not a constructor` — WebRTC not available in Node test env

## TreeKEM UI Integration (completed Feb 27, 2026)
**Files changed:**
- `packages/server/src/routes/groups.ts` — `acceptInvite` returns `leafIndex` (member count - 1 after insert)
- `packages/client/src/group-client.ts` — `AcceptInviteResult` has `leafIndex?: number`
- `apps/web/hooks/useTreeKEM.ts` — `handleTreeUpdate` handles both existing member (processCommit) and new joiner (joinFromWelcome); skips if already at commit epoch (committer self-bounce prevention)
- `apps/web/hooks/useWebSocket.ts` — calls `handleTreeUpdate(event)` on `treeUpdate` events via `useTreeKEM`
- `apps/web/components/NewGroupDialog.tsx` — calls `initGroupTree(result.groupId)` after group creation
- `apps/web/app/invite/[code]/page.tsx` — calls `joinGroupTree(result.groupId, result.leafIndex ?? 0)` after invite accept
- `apps/web/app/(chat)/chat/[groupId]/page.tsx` — passes `treekemManager.getEpoch(groupId)` as `epoch` to every `sendMessage`

## Post-Compromise Security UI (completed Feb 27, 2026)
- "Rotate Encryption Keys" button in `GroupSettings.tsx` Security section
- Smart: initializes tree if not yet set up (`initGroupTree`), rotates if already initialized (`treekemManager.update()` + `client.postTreeUpdate()`)
- `rotateStatus: 'idle' | 'pending' | 'done'` — spinner → checkmark → reverts after 2s
- Translations in en/ru/fa: `security`, `rotateKeys`, `rotateKeysDone`, `rotateKeysDescription`, `initializeEncryption`, `initializeEncryptionDescription`, `rotateKeysFailed`
- Epoch self-bounce fix: `handleTreeUpdate` skips if `getEpoch(groupId) >= event.epoch`

## Encryption Decryption Fix (completed Feb 27, 2026)
- `epoch` now stored in DB (`messages.epoch`), returned in GET, and included in WS broadcast
- `nonce`/`epoch` added to `WebSocketEvent.message` in shared types
- `MessageListItem` now has `epoch?: number`
- `MessageClient.getMessages()` decrypts inline via `cipher.decrypt()` (swallows errors when key missing)
- `useWebSocket.ts` `handleEvent` is now async; decrypts WS messages before caching
- Migration: `packages/server/src/db/migrations/007_message_epoch.sql`
- Rebuild needed: `bun run --cwd packages/shared build && bun run --cwd packages/client build`

## Features Status (as of Feb 27, 2026)
See FEATURES.md. Remaining not-implemented:
- Display Users' Last Seen (medium effort)
- Message Delivery & Read Receipts (high effort, full spec written)
- Post-Compromise Security — done except periodic auto-rotation (low effort)
- Forward Secrecy Per-Message (high effort)
- MLS Protocol RFC 9420 (very high)
- HPKE (high, depends on MLS)

## Translation Pattern
- Files: `apps/web/messages/{en,ru,fa}.json`
- Add keys via python3 json manipulation to preserve formatting
- All user-facing strings need all 3 locales

## WebSocket / TreeKEM Event Flow
- `treeUpdate` events are handled in `useWebSocket` → delegates to `handleTreeUpdate` from `useTreeKEM`
- Committer skips own broadcast: `if (getEpoch(groupId) >= event.epoch) return`
- New joiners bootstrap via `welcome` field in `treeUpdate` event
