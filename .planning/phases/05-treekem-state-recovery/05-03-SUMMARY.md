---
phase: 05-treekem-state-recovery
plan: "03"
subsystem: client
tags:
  - treekem
  - encryption
  - state-recovery
  - typescript
dependency_graph:
  requires:
    - "05-01"
    - "05-02"
  provides:
    - real-welcome-reconstruction-from-commit-json
    - async-delete-group-with-key-cleanup
    - server-supplied-leaf-index
  affects:
    - packages/crypto
    - packages/client
    - apps/web
tech_stack:
  added: []
  patterns:
    - commitJson fast path before synthetic fallback
    - delegation method for keyStore operations
    - server-authoritative leaf index
key_files:
  created: []
  modified:
    - packages/client/src/client.ts
    - packages/crypto/src/group-cipher.ts
    - packages/client/src/treekem-manager.ts
    - apps/web/hooks/useTreeKEM.ts
    - apps/web/hooks/useTreeKEMAutoInit.ts
    - apps/web/app/invite/[code]/page.tsx
decisions:
  - Use '' (empty string) for treeHash in reconstructed Welcome — lazily computed inside MLSGroup
  - Preserve full synthetic Welcome fallback for groups where commitJson is absent (owners, pre-migration)
  - joinGroupTree signature drops leafIndex entirely — server is now the authoritative source
  - invite page joinGroupTree updated alongside auto-init to keep all callers consistent
metrics:
  duration: "3 minutes"
  completed: "2026-02-28"
  tasks_completed: 2
  files_changed: 6
---

# Phase 05 Plan 03: Client Integration Summary

**One-liner:** Client-side TypeScript updated to use server-supplied `commitJson` and `leafIndex` for real Welcome reconstruction, plus async `deleteGroup` with full key cleanup.

## What Was Built

This plan completed the client-side leg of the TreeKEM state recovery fix. The server (05-02) now persists `commit_json` and `leaf_index` in D1 and returns them from `getTreeState`. This plan wires those values into the client so diverged local tree state can be correctly rebuilt after a page reload.

## Files Changed

### packages/client/src/client.ts
- Extended `getTreeState` return type with two new optional fields:
  - `commitJson?: string` — full MLS Commit JSON for real Welcome reconstruction
  - `leafIndex?: number` — member's ratchet tree leaf position (0 for owner/legacy)
- No fetch logic changes needed — `response.json()` includes the new server fields automatically

### packages/crypto/src/group-cipher.ts
- Added `deleteAllGroupKeys(groupId: GroupId): Promise<number>` delegation method to `GroupCipher`
- Delegates to `this.keyStore.deleteAllGroupKeys(groupId)` — the `KeyStore` interface already defines this on both `MemoryKeyStore` and `IndexedDBKeyStore`
- Keeps the API clean: `TreeKEMManager` calls `this.cipher.deleteAllGroupKeys` rather than reaching into `keyStore` via `any` cast

### packages/client/src/treekem-manager.ts

**joinGroup — commitJson fast path:**
When `commitJson` is provided, `joinGroup` reconstructs a real Welcome from the server-persisted Commit:
```typescript
if (commitJson) {
  const commit: Commit = JSON.parse(commitJson);
  const welcome: Welcome = {
    groupId,
    epoch: commit.newEpoch,
    treeData: treeDataJson,
    commit,
    leafIndex: myLeafIndex,
    groupContext: {
      groupId,
      epoch: commit.newEpoch,
      treeHash: '',                        // Lazily computed inside MLSGroup
      transcriptHash: commit.transcriptHash,
    },
  };
  const group = await MLSGroup.joinFromWelcome(welcome, myKeyPair, this.cipher);
  this.groups.set(groupId, group);
  return;
}
// ... synthetic fallback unchanged ...
```
The synthetic epoch-0 fallback is fully preserved for groups where no `commitJson` exists.

**deleteGroup — new async method:**
```typescript
async deleteGroup(groupId: GroupId): Promise<void> {
  this.groups.delete(groupId);              // Synchronous: hasTree() returns false immediately
  await this.cipher.deleteAllGroupKeys(groupId);
}
```
Removes the in-memory `MLSGroup` and awaits deletion of all derived epoch keys from IndexedDB. Must be awaited since IndexedDB operations are async.

### apps/web/hooks/useTreeKEM.ts
- `joinGroupTree` signature simplified: removed `leafIndex: number` parameter (now server-authoritative)
- The `treekemManager.joinGroup` call now passes:
  - `treeState.leafIndex ?? 0` — null-coalesced to 0 for owners/pre-migration groups
  - `treeState.commitJson` — undefined when server has no commit → synthetic fallback activates

### apps/web/hooks/useTreeKEMAutoInit.ts
- Updated `joinGroupTree(group.groupId, 0)` → `joinGroupTree(group.groupId)` — hardcoded `0` removed

### apps/web/app/invite/[code]/page.tsx
- Updated `joinGroupTree(result.groupId, result.leafIndex ?? 0)` → `joinGroupTree(result.groupId)` — leaf index removed since joinGroupTree now fetches it from the server

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing] Updated invite page joinGroupTree caller**
- **Found during:** Task 2 (pitfall check: "Check useTreeKEM.ts for any OTHER callers")
- **Issue:** `apps/web/app/invite/[code]/page.tsx` also called `joinGroupTree(result.groupId, result.leafIndex ?? 0)` — after signature change this would be a TypeScript error
- **Fix:** Updated to `joinGroupTree(result.groupId)` — server now supplies leafIndex internally
- **Files modified:** `apps/web/app/invite/[code]/page.tsx`

**2. [N/A] deleteGroup retry loop in useTreeKEM.ts**
- **Found during:** Task 2 step C
- **Issue:** Plan said to find `treekemManager.deleteGroup` in retry loop and add `await`. The call does not exist in the current codebase — the retry loop described in MEMORY.md was not present in the actual source.
- **Fix:** No action needed — `deleteGroup` is a new method, no existing callers to update.

## Manual Testing Steps (per CLAUDE.md)

1. Two-user flow: Alice creates group + TreeKEM init → invite Bob → Bob accepts.
2. Both exchange messages (encrypted at epoch N). Verify no console errors.
3. Reload Bob's page (clears in-memory tree state; IndexedDB key + identity key survive).
4. Bob's `useTreeKEMAutoInit` fires `joinGroupTree(groupId)` — server returns `commitJson` + `leafIndex: 1`.
5. `joinGroup` takes the `commitJson` path → `MLSGroup.joinFromWelcome` with real Commit.
6. Alice sends a new message → Bob decrypts successfully (no GroupCipherError in console).
7. Open browser devtools console, run:
   - `treekemManager.deleteGroup('<group-id>').then(() => console.log('deleted'))` → logs 'deleted'
   - `treekemManager.hasTree('<group-id>')` → false

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | `5818cd6` | feat(05-03): extend getTreeState return type + add deleteAllGroupKeys to GroupCipher |
| Task 2 | `e7f54a7` | feat(05-03): client integration — commitJson recovery path, deleteGroup, server leafIndex |

## Self-Check: PASSED
