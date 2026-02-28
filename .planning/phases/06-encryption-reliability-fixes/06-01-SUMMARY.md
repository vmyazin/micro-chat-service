---
phase: 06-encryption-reliability-fixes
plan: 01
subsystem: crypto
tags: [treekem, mls, aes-gcm, indexeddb, epoch, encryption]

# Dependency graph
requires:
  - phase: 05-treekem-state-recovery
    provides: joinGroup with commitJson path and synthetic fallback

provides:
  - Epoch-0 guard in GroupCipher.deriveGroupKey (throws GroupCipherError for epoch=0)
  - Error propagation from joinGroup commitJson path to handleResync

affects:
  - 06-02
  - any plan touching GroupCipher.deriveGroupKey or TreeKEMManager.joinGroup

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fail-fast guard at method entry for invalid invariants (epoch=0)"
    - "Error propagation over silent fallback for recovery paths"

key-files:
  created: []
  modified:
    - packages/crypto/src/group-cipher.ts
    - packages/client/src/treekem-manager.ts

key-decisions:
  - "Guard placed as first statement in deriveGroupKey — before any HKDF logic — so no crypto operation is attempted at epoch 0"
  - "try/catch removed entirely from commitJson branch; synthetic fallback remains for commitJson-absent groups (owners, pre-migration)"

patterns-established:
  - "Fail-fast on epoch=0: GroupCipherError thrown before touching the key store"
  - "No silent catch in recovery path: decryption errors propagate to handleResync for user-visible feedback"

requirements-completed: [REQ-6.1, REQ-6.3]

# Metrics
duration: 1min
completed: 2026-02-28
---

# Phase 06 Plan 01: Encryption Reliability Fixes Summary

**Epoch-0 guard in GroupCipher.deriveGroupKey and try/catch removal from joinGroup commitJson path to propagate TreeKEM decryption errors to handleResync**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-02-28T23:26:56Z
- **Completed:** 2026-02-28T23:27:51Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added epoch-0 guard to `GroupCipher.deriveGroupKey` — throws `GroupCipherError` before any HKDF logic runs, preventing garbage AES keys from being persisted in IndexedDB at epoch 0
- Removed try/catch from the `commitJson` branch of `joinGroup` — decryption errors (e.g., "Cannot find decryption point in UpdatePath") now propagate to `handleResync` instead of being swallowed silently
- Synthetic fallback path (epoch-0 synthetic Welcome for pre-migration/owner groups) remains intact and reachable when `commitJson` is falsy
- Both `@microchat/crypto` and `@microchat/client` TypeScript compile clean with no errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Add epoch-0 guard to GroupCipher.deriveGroupKey** - `f7d5aa3` (fix)
2. **Task 2: Remove try/catch from joinGroup commitJson path** - `9ab3913` (fix)

## Files Created/Modified
- `packages/crypto/src/group-cipher.ts` - Added epoch === 0 guard as first statement in deriveGroupKey, throwing GroupCipherError before any HKDF key derivation
- `packages/client/src/treekem-manager.ts` - Removed try/catch wrapper from commitJson branch in joinGroup; updated JSDoc to reflect error propagation behaviour

## Decisions Made
- Guard placed as the very first statement in `deriveGroupKey` — before any HKDF logic — so no crypto operation is attempted at epoch 0
- try/catch removed entirely from the commitJson branch; no fallback to synthetic path when commitJson is present and decryption fails — caller gets the real error

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Manual Testing Steps

1. Start dev server: `cd packages/server && wrangler dev`
2. Register Alice and Bob in two separate browser windows
3. Alice creates a group, initialises TreeKEM (epoch becomes 1)
4. Alice invites Bob; Bob accepts the invite
5. Wait for Alice's browser to receive `memberJoined` WebSocket event and post tree-update (check Network tab for POST /tree-update)
6. In Alice's browser, send an encrypted message
7. Reload Bob's browser tab
8. Observe Bob's console — expect NO "Cannot find decryption point in UpdatePath" swallowed silently; Bob should decrypt Alice's message
9. To test epoch-0 guard: in devtools console run `window.__treekemManager?.cipher?.deriveGroupKey?.('test', 0, new Uint8Array(32))` — expect `GroupCipherError` thrown, not a resolved key

## Next Phase Readiness
- Root-cause crypto fixes in place; ready for Phase 06-02 (resync flow and UI feedback improvements)
- No blockers

## Self-Check: PASSED

- `packages/crypto/src/group-cipher.ts` — found (epoch guard at line 61)
- `packages/client/src/treekem-manager.ts` — found (no catch block in commitJson branch)
- `06-01-SUMMARY.md` — found
- Commit `f7d5aa3` — found
- Commit `9ab3913` — found

---
*Phase: 06-encryption-reliability-fixes*
*Completed: 2026-02-28*
