# Phase 5: TreeKEM State Recovery - Research

**Researched:** 2026-02-28
**Domain:** TreeKEM / MLS cryptography, Cloudflare D1 SQLite migrations, TypeScript client/server
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Database Schema:**
- `ALTER TABLE group_members ADD COLUMN leaf_index INTEGER` — persists the leaf position assigned when the invite was accepted
- `ALTER TABLE group_tree_state ADD COLUMN commit_json TEXT` — persists the full serialized commit from the last tree update

**Server: Invite Accept:**
- When a member accepts an invite, the server records their `leaf_index` in `group_members`
- Leaf index is determined by the tree insert position at accept time

**Server: Tree Update:**
- On every POST to the tree-update endpoint, the server stores the serialized `commit_json` in `group_tree_state`

**Server: getTreeState Response:**
- `getTreeState` returns `commitJson` and `leafIndex` for the authenticated requesting member
- `leafIndex` is fetched from `group_members` for the current user

**Client: joinGroup in treekem-manager.ts:**
- `joinGroup` receives `commitJson` from the server response
- Uses `commitJson` to reconstruct the welcome message (replaces the epoch-0 synthetic fallback)
- The member's existing private key in IndexedDB/localStorage can decrypt path secrets from the original commit

**Client: joinGroupTree:**
- `joinGroupTree` uses `leafIndex` from the server `getTreeState` response
- Removes the hardcoded `leafIndex=0` passed to `joinGroup`

**Client: TreeKEMManager.deleteGroup:**
- Add `deleteGroup(groupId: string): void` method to `TreeKEMManager`
- Clears local tree state for the group from the key store
- Intended for use by a future "Resync encryption" button — not wired to UI in this phase

### Claude's Discretion
- Exact field name casing in API response (`commitJson` vs `commit_json` — use camelCase in TypeScript types, snake_case in DB)
- Error handling for groups where `commit_json` is NULL (tree initialized before this migration) — fall back to existing synthetic welcome behavior
- TypeScript type updates for `TreeStateResponse` to include optional `commitJson` and `leafIndex`
- Migration rollback strategy

### Deferred Ideas (OUT OF SCOPE)
- "Resync encryption" UI button that calls `deleteGroup()` then re-triggers `joinGroupTree` — deferred to a future UX phase
- Recovering blobs encrypted with diverged keys — cryptographically impossible, explicitly out of scope
- Automated divergence detection (epoch mismatch detection on decrypt failure) — future hardening phase
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| REQ-5.1 | DB migration adds `leaf_index` to `group_members` and `commit_json` to `group_tree_state` | Migration pattern: `ALTER TABLE` with `ADD COLUMN` (nullable), named `009_treekem_state_recovery.sql` |
| REQ-5.2 | Server stores leaf_index when invite is accepted and commit_json on every tree update | invite-accept endpoint already computes `leafIndex` but doesn't persist it; tree-update upsert needs `commit_json` column added to ON CONFLICT update |
| REQ-5.3 | `getTreeState` endpoint returns `commitJson` and `leafIndex` for the requesting member | Query `group_members` for `leaf_index` by `group_id + user_id`; add to JSON response alongside existing fields |
| REQ-5.4 | `joinGroup` in `treekem-manager.ts` uses server-supplied `commitJson` to reconstruct welcome | Change method signature to accept `commitJson?: string`; use `MLSGroup.joinFromWelcome` with parsed commit from `commitJson` when present |
| REQ-5.5 | `joinGroupTree` uses server-supplied `leafIndex` instead of hardcoded 0 | `client.getTreeState()` return type needs `commitJson?: string; leafIndex?: number`; `joinGroupTree` reads `treeState.leafIndex` and `treeState.commitJson` |
| REQ-5.6 | `TreeKEMManager.deleteGroup(groupId)` method added | Calls `this.groups.delete(groupId)` + `this.cipher.deleteAllGroupKeys(groupId)` — `GroupCipher` exposes this via `KeyStore.deleteAllGroupKeys` |
</phase_requirements>

---

## Summary

Phase 5 is a surgical bug fix spread across three layers: database schema, server API, and client TypeScript. The root cause of TreeKEM state divergence is that `joinGroupTree` always passes `leafIndex=0` to `joinGroup`, and `joinGroup` builds a synthetic epoch-0 welcome with an empty UpdatePath — which cannot derive the correct group secret for epoch N > 0. The fix persists the two missing pieces server-side: `leaf_index` (where the member sits in the ratchet tree) and `commit_json` (the full MLS Commit that generated the current tree state), so the client can reconstruct a real Welcome and call `MLSGroup.joinFromWelcome` with correct data.

All six changes are well-scoped and low-risk because they touch additive code paths. The database migration adds two nullable columns — harmless to existing rows. The server changes add data storage and extend response JSON without breaking existing clients. The client changes add a `commitJson` path in `joinGroup` while keeping the existing synthetic-welcome fallback when `commitJson` is absent (needed for groups created before this migration). The `deleteGroup` method has no side effects on existing callers.

The most critical implementation detail is that `joinGroup` in `treekem-manager.ts` must reconstruct a `Welcome` object from `commitJson` (a serialized `Commit`) and then call `MLSGroup.joinFromWelcome`. The `Welcome` type requires `groupId`, `epoch`, `treeData`, `commit`, `leafIndex`, and `groupContext`. The `treeData` comes from `treeState.treeData` (already in the response); `epoch` comes from `treeState.epoch`; `commit` is parsed from `commitJson`; `leafIndex` is `treeState.leafIndex`. The `groupContext` fields (`treeHash`, `transcriptHash`) are available inside the parsed `Commit` object itself.

**Primary recommendation:** Implement changes in dependency order: DB migration first, then server endpoints (invite-accept, tree-update, getTreeState), then client type updates (`getTreeState` return type, `joinGroup` signature), then `joinGroupTree` caller update, then `deleteGroup`. This order prevents TypeScript compilation failures at each step.

---

## Standard Stack

### Core (already in project — no new packages needed)

| Component | Version/Location | Purpose | Notes |
|-----------|-----------------|---------|-------|
| Cloudflare D1 / SQLite | `packages/server/src/db/migrations/` | Schema migration | `ALTER TABLE ... ADD COLUMN` syntax; D1 is SQLite-compatible |
| Hono routes | `packages/server/src/routes/groups.ts` | Server endpoints | Pattern: `db.query<T>()` + `db.batch()` for atomic writes |
| MLSGroup | `packages/crypto/src/mls-group.ts` | Core TreeKEM group state | `MLSGroup.joinFromWelcome(welcome, myKeyPair, cipher)` |
| TreeKEMManager | `packages/client/src/treekem-manager.ts` | Client-side TreeKEM orchestration | `joinGroup`, `joinFromWelcome`, groups Map |
| GroupCipher / KeyStore | `packages/crypto/src/group-cipher.ts` | Key derivation + storage | `deleteAllGroupKeys(groupId)` already on `KeyStore` interface |
| useTreeKEM hook | `apps/web/hooks/useTreeKEM.ts` | React glue for joinGroupTree | Calls `client.getTreeState()` then `treekemManager.joinGroup` |
| MicroChatClient | `packages/client/src/client.ts` | API client | `getTreeState()` return type needs `commitJson`, `leafIndex` |

### No New Dependencies

This phase requires zero new npm packages. All primitives exist: SQLite ALTER TABLE, existing crypto types (`Welcome`, `Commit`), existing `KeyStore.deleteAllGroupKeys`, existing `MLSGroup.joinFromWelcome`.

---

## Architecture Patterns

### Recommended Change Sequence

```
packages/server/src/db/migrations/
├── 009_treekem_state_recovery.sql   # REQ-5.1 — ADD COLUMN leaf_index + commit_json

packages/server/src/
├── db/schema.ts                     # Add leaf_index to GroupMembersTable, commit_json to GroupTreeStateTable
└── routes/groups.ts
    ├── POST /api/invites/:code/accept   # REQ-5.2a — persist leaf_index to group_members
    ├── POST /api/groups/:id/tree-update # REQ-5.2b — persist commit_json to group_tree_state
    └── GET  /api/groups/:id/tree-state  # REQ-5.3 — return commitJson + leafIndex

packages/client/src/
├── client.ts          # REQ-5.5 — extend getTreeState() return type
└── treekem-manager.ts # REQ-5.4 — joinGroup uses commitJson; REQ-5.6 — deleteGroup

apps/web/hooks/
└── useTreeKEM.ts      # REQ-5.5 — joinGroupTree passes leafIndex+commitJson from server
```

### Pattern 1: SQLite ADD COLUMN (D1 Migration)

**What:** Cloudflare D1 uses SQLite. `ALTER TABLE ADD COLUMN` requires the new column to be nullable or have a DEFAULT, because existing rows cannot be backfilled retroactively via DDL.

**When to use:** Adding optional data to existing tables.

```sql
-- Source: project migration pattern (packages/server/src/db/migrations/006_treekem.sql)
-- Migration 009_treekem_state_recovery.sql

-- Nullable: groups pre-migration have no leaf_index recorded
ALTER TABLE group_members ADD COLUMN leaf_index INTEGER;

-- Nullable: groups pre-migration have no commit recorded
ALTER TABLE group_tree_state ADD COLUMN commit_json TEXT;
```

**Why nullable:** Existing `group_members` rows (group owners added at group creation time) never went through invite-accept, so their `leaf_index` is implicitly 0 (they are leaf 0). Stored as NULL; client code can default NULL to 0 for the owner. Existing `group_tree_state` rows have no `commit_json` — the fallback to synthetic welcome handles this gracefully.

### Pattern 2: Server Invite-Accept — Persisting leaf_index

**What:** The `/api/invites/:code/accept` endpoint already computes `leafIndex` at line 299 of `groups.ts` and returns it in the response JSON. The only change is persisting it to the `group_members` row during the INSERT.

**Current code (line 279-282):**
```typescript
// Source: packages/server/src/routes/groups.ts:279
await db.execute(
  'INSERT INTO group_members (id, group_id, user_id, joined_at, identity_key) VALUES (?, ?, ?, ?, ?)',
  [memberId, invite.group_id, user.id, now, publicKey ?? null],
);
```

**After change:**
```typescript
// ADD leaf_index column to INSERT
await db.execute(
  'INSERT INTO group_members (id, group_id, user_id, joined_at, identity_key, leaf_index) VALUES (?, ?, ?, ?, ?, ?)',
  [memberId, invite.group_id, user.id, now, publicKey ?? null, leafIndex],
);
```

Note: `leafIndex` is already computed at line 295-299 before the INSERT occurs. The INSERT just needs the column added.

### Pattern 3: Server Tree Update — Persisting commit_json

**What:** The `/api/groups/:id/tree-update` endpoint receives `body.commit` (the full serialized MLS Commit JSON string). This must be stored as `commit_json` in `group_tree_state` alongside the already-stored `treeData`.

**Current upsert (lines 584-588):**
```typescript
// Source: packages/server/src/routes/groups.ts:584
{
  sql: `INSERT INTO group_tree_state (group_id, epoch, tree_data, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(group_id) DO UPDATE SET epoch = ?, tree_data = ?, updated_at = ?`,
  params: [groupId, body.epoch, treeData, now, body.epoch, treeData, now],
},
```

**After change:**
```typescript
{
  sql: `INSERT INTO group_tree_state (group_id, epoch, tree_data, commit_json, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(group_id) DO UPDATE SET epoch = ?, tree_data = ?, commit_json = ?, updated_at = ?`,
  params: [groupId, body.epoch, treeData, body.commit, now, body.epoch, treeData, body.commit, now],
},
```

Note: `body.commit` is the raw commit string (the full Commit JSON). `treeData` is already extracted from it (`parsed.treeData ?? body.commit`). Storing `body.commit` as `commit_json` preserves the full Commit structure needed for Welcome reconstruction.

### Pattern 4: getTreeState — Returning commitJson and leafIndex

**What:** The GET `/api/groups/:id/tree-state` must join `group_members` to retrieve `leaf_index` for the requesting user, and include `commit_json` from `group_tree_state` in the response.

```typescript
// Source: packages/server/src/routes/groups.ts (current query at line 494)
const rows = await db.query<{
  group_id: GroupId;
  epoch: number;
  tree_data: string;
  commit_json: string | null;   // NEW
  updated_at: string;
}>(
  'SELECT group_id, epoch, tree_data, commit_json, updated_at FROM group_tree_state WHERE group_id = ?',
  [groupId],
);

// NEW: fetch leaf_index for this user
const memberRows = await db.query<{ leaf_index: number | null }>(
  'SELECT leaf_index FROM group_members WHERE group_id = ? AND user_id = ?',
  [groupId, user.id],
);
const leafIndex = memberRows[0]?.leaf_index ?? 0;
```

Response JSON (camelCase as per Claude's Discretion):
```typescript
return c.json({
  groupId: state.group_id,
  epoch: state.epoch,
  treeData: state.tree_data,
  updatedAt: state.updated_at,
  commitJson: state.commit_json ?? undefined,  // omit if NULL
  leafIndex,                                   // always present; 0 for owner/legacy
  // welcome: ... (existing pending_welcomes path unchanged)
});
```

### Pattern 5: Client getTreeState Type Extension

**What:** `MicroChatClient.getTreeState()` return type needs two new optional fields.

**Current type (packages/client/src/client.ts:218):**
```typescript
// Source: packages/client/src/client.ts
async getTreeState(
  groupId: GroupId,
): Promise<{ epoch: number; treeData: string; welcome?: string } | null>
```

**After change:**
```typescript
async getTreeState(
  groupId: GroupId,
): Promise<{
  epoch: number;
  treeData: string;
  welcome?: string;
  commitJson?: string;    // NEW
  leafIndex?: number;     // NEW
} | null>
```

No fetch code changes needed — `response.json()` will include the new fields automatically.

### Pattern 6: joinGroup — Using commitJson for Real Welcome Reconstruction

**What:** `TreeKEMManager.joinGroup()` currently builds a synthetic epoch-0 Welcome. When `commitJson` is provided, it should instead build a real Welcome from the server-persisted commit data.

**Current signature (packages/client/src/treekem-manager.ts:79):**
```typescript
async joinGroup(
  groupId: GroupId,
  treeDataJson: string,
  myLeafIndex: LeafIndex,
  myKeyPair: ECKeyPair,
): Promise<void>
```

**After change:**
```typescript
async joinGroup(
  groupId: GroupId,
  treeDataJson: string,
  myLeafIndex: LeafIndex,
  myKeyPair: ECKeyPair,
  commitJson?: string,   // NEW — if present, use real welcome reconstruction
): Promise<void>
```

**Implementation of the commitJson path:**
```typescript
if (commitJson) {
  // Reconstruct a real Welcome from the persisted commit
  const commit: Commit = JSON.parse(commitJson);
  const welcome: Welcome = {
    groupId,
    epoch: commit.newEpoch,   // the epoch the commit transitions TO
    treeData: treeDataJson,
    commit,
    leafIndex: myLeafIndex,
    groupContext: {
      groupId,
      epoch: commit.newEpoch,
      treeHash: '',           // computed lazily; '' is acceptable here
      transcriptHash: commit.transcriptHash,
    },
  };
  const group = await MLSGroup.joinFromWelcome(welcome, myKeyPair, this.cipher);
  this.groups.set(groupId, group);
  return;
}
// ... existing synthetic welcome fallback below
```

**Why this works:** `MLSGroup.joinFromWelcome` calls `treekem.processUpdatePath(commit.updatePath)` which uses our private key at `leafIndex` to decrypt the path secret encrypted for us in `commit.encryptedPathSecrets`. This is exactly what a real Welcome would do.

### Pattern 7: joinGroupTree — Reading leafIndex from Server

**What:** `useTreeKEM.joinGroupTree` currently passes hardcoded `leafIndex=0` to `treekemManager.joinGroup`. It should use `treeState.leafIndex` and `treeState.commitJson`.

**Current (apps/web/hooks/useTreeKEM.ts:152-157):**
```typescript
// Source: apps/web/hooks/useTreeKEM.ts
await treekemManager.joinGroup(
  groupId,
  treeState.treeData,
  leafIndex,     // ← hardcoded parameter from caller, always 0
  keyPair,
);
```

**After change:**
```typescript
await treekemManager.joinGroup(
  groupId,
  treeState.treeData,
  treeState.leafIndex ?? 0,    // from server (falls back to 0 for owner/pre-migration groups)
  keyPair,
  treeState.commitJson,        // undefined when NULL on server → uses synthetic fallback
);
```

Also update the `joinGroupTree` function signature — the `leafIndex` parameter that callers pass (e.g., `joinGroupTree(group.groupId, 0)` in `useTreeKEMAutoInit`) becomes unused. The parameter can be removed or made optional. `useTreeKEMAutoInit` calls `joinGroupTree(group.groupId, 0)` — update to `joinGroupTree(group.groupId)`.

### Pattern 8: TreeKEMManager.deleteGroup

**What:** New method that clears in-memory group state AND all stored epoch keys for the group.

```typescript
// Add to TreeKEMManager class (packages/client/src/treekem-manager.ts)
/**
 * Remove all local tree state for a group.
 * Clears the in-memory MLSGroup and all derived epoch keys from the key store.
 * Call before re-joining via joinGroupTree to reset diverged state.
 */
async deleteGroup(groupId: GroupId): Promise<void> {
  this.groups.delete(groupId);
  await this.cipher.deleteAllGroupKeys(groupId);
}
```

**Note:** `GroupCipher.deleteAllGroupKeys` delegates to `KeyStore.deleteAllGroupKeys` which already exists on both `MemoryKeyStore` and `IndexedDBKeyStore`. The method exists; only the manager wrapper is missing.

**Note:** Method must be `async` because `this.cipher.deleteAllGroupKeys` returns `Promise<number>`. The return value (count of deleted keys) can be ignored.

### Anti-Patterns to Avoid

- **Don't rebuild Welcome from treeData alone:** The synthetic `joinGroup` path uses an empty UpdatePath and epoch=0, which means `processUpdatePath` does nothing useful and `deriveGroupSecret` gets the wrong input. Always prefer `commitJson` when available.
- **Don't store `treeData` as `commit_json`:** `treeData` is the serialized `RatchetTree` JSON. `commit_json` is the full MLS `Commit` object which contains `updatePath`, `proposals`, `transcriptHash`, etc. They are different. Store `body.commit` (not the extracted `treeData`) as `commit_json`.
- **Don't remove the synthetic fallback:** Groups created before migration 009 will have NULL `commit_json`. The fallback path must remain.
- **Don't make `deleteGroup` synchronous:** `cipher.deleteAllGroupKeys` is async (IndexedDB operations). Omitting `await` would silently fail to clear keys.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Welcome reconstruction from commit | Custom deserialization | `MLSGroup.joinFromWelcome(welcome, keyPair, cipher)` | Already handles UpdatePath processing, key derivation, epoch advance |
| Clearing epoch keys | Manual IndexedDB iteration | `KeyStore.deleteAllGroupKeys(groupId)` | Already implemented in both MemoryKeyStore and IndexedDBKeyStore |
| SQLite column addition | Data migration scripts | `ALTER TABLE ... ADD COLUMN` | SQLite supports this natively; D1 applies it to all existing rows as NULL |
| Batch DB writes | Multiple sequential execute() | `db.batch([...])` | Cloudflare D1 batch is atomic; use existing pattern from tree-update handler |

**Key insight:** All required primitives exist. The implementation is purely about wiring existing components together with the two new server-persisted fields as the bridge.

---

## Common Pitfalls

### Pitfall 1: Wrong Value Stored as commit_json

**What goes wrong:** Developer stores `treeData` (the extracted `RatchetTree` JSON) as `commit_json` instead of `body.commit` (the full `Commit` JSON).
**Why it happens:** The tree-update handler already extracts `treeData` from `body.commit` (lines 567-573 of groups.ts). Easy to use `treeData` by mistake.
**How to avoid:** Store `body.commit` directly as `commit_json`. The full Commit is what's needed because `Welcome.commit` is a `Commit` object, not just tree data.
**Warning signs:** `joinGroup` crashes in `deserializeUpdatePath(commit.updatePath)` because `commit.updatePath` is undefined — meaning the wrong thing was stored.

### Pitfall 2: leafIndex NULL for Group Owner / Pre-Migration Members

**What goes wrong:** Group owners (leaf 0) and members who joined before migration 009 have `leaf_index = NULL` in `group_members`. Code that reads `memberRows[0].leaf_index` directly without null-coalescing will pass `null` or `undefined` to `joinGroup`, which treats it as falsy and may silently use 0 — or crash depending on `typeof` checks.
**Why it happens:** Group owners are inserted via POST `/api/groups` (not via invite-accept), so they never go through the code path that sets `leaf_index`.
**How to avoid:** Always null-coalesce: `memberRows[0]?.leaf_index ?? 0`. Group owners are always leaf 0, so this default is correct.
**Warning signs:** A group owner gets incorrect tree state after page reload — their epoch matches but decryption fails because their leaf index was used incorrectly in a 2+ member group.

### Pitfall 3: useTreeKEMAutoInit Still Passing Hardcoded leafIndex

**What goes wrong:** After updating `joinGroupTree` to read `leafIndex` from `treeState`, the call site in `useTreeKEMAutoInit` still passes `leafIndex=0` as the second argument. If the function signature changes to remove the parameter, TypeScript will catch this. If it's kept as optional and ignored, the bug is silently masked.
**Why it happens:** There are two callers of `joinGroupTree` (in `useTreeKEM.ts` itself and in `useTreeKEMAutoInit.ts`). Easy to miss updating the auto-init caller.
**How to avoid:** Search for all call sites. Update `useTreeKEMAutoInit.ts` from `joinGroupTree(group.groupId, 0)` to `joinGroupTree(group.groupId)`. Remove the `leafIndex` parameter from the `joinGroupTree` function signature entirely so TypeScript enforces the update.
**Warning signs:** TypeScript error "Expected 1 arguments, but got 2" if parameter is removed — a helpful compile-time catch.

### Pitfall 4: deleteGroup Is Synchronous in Existing Usage

**What goes wrong:** The MEMORY.md notes that the existing retry logic in `useTreeKEM.ts` calls `treekemManager.deleteGroup(groupId)` without `await` (the method was previously synchronous — it only deleted from the in-memory Map). After adding `cipher.deleteAllGroupKeys()`, the method becomes async. Not adding `await` means keys are not deleted before `joinGroupTree` is called on retry.
**Why it happens:** Caller expects synchronous behavior. Return type was `void`.
**How to avoid:** Change return type to `Promise<void>` and update all callers to `await treekemManager.deleteGroup(groupId)`. Check `useTreeKEM.ts` for the existing retry-loop usage.
**Warning signs:** Keys are not cleared — old epoch keys remain in IndexedDB and the re-join still uses stale state.

### Pitfall 5: commit.transcriptHash in Reconstructed Welcome

**What goes wrong:** The reconstructed Welcome's `groupContext.transcriptHash` is set to `commit.transcriptHash`. If `MLSGroup.joinFromWelcome` stores this as the starting transcript hash and later processCommit calls verify against it, an off-by-one in transcript hash advancement could cause verification failures.
**Why it happens:** The transcript hash in a Commit is `H(prevHash || commitContent)` — i.e., the hash AFTER the commit, not before. `joinFromWelcome` stores it as the group's current transcript hash, which is correct: it's the hash that the next commit will extend.
**How to avoid:** Use `commit.transcriptHash` directly as `groupContext.transcriptHash`. This matches what `MLSGroup.joinFromWelcome` expects (it stores `welcome.groupContext.transcriptHash` as `this.transcriptHash`).
**Warning signs:** `processCommit` throws "Transcript hash verification failed" on the first commit after re-join.

### Pitfall 6: D1 ALTER TABLE Idempotency

**What goes wrong:** Running the migration twice (e.g., local dev reset) causes `ALTER TABLE` to fail with "duplicate column name".
**Why it happens:** SQLite `ALTER TABLE ADD COLUMN` is not idempotent — it errors if the column already exists.
**How to avoid:** This is handled by Cloudflare D1's migration runner which tracks applied migrations. Do not manually re-run migration files. The pattern is consistent with all 8 existing migrations in the project.
**Warning signs:** Migration runner error during local `wrangler dev` restart. The fix is standard: use the migration tracker, not raw SQL.

---

## Code Examples

### Migration File

```sql
-- Source: project migration pattern, packages/server/src/db/migrations/009_treekem_state_recovery.sql
-- Add leaf_index and commit_json for TreeKEM state recovery (Phase 5)

-- leaf_index: position in ratchet tree, set at invite-accept time
-- NULL for group owners (always leaf 0) and pre-migration members
ALTER TABLE group_members ADD COLUMN leaf_index INTEGER;

-- commit_json: full serialized MLS Commit from the last tree update
-- NULL for groups with no server tree state yet (pre-migration epoch 0)
ALTER TABLE group_tree_state ADD COLUMN commit_json TEXT;
```

### Schema.ts Updates

```typescript
// Source: packages/server/src/db/schema.ts — add new fields to existing interfaces

export interface GroupTreeStateTable {
  group_id: GroupId;
  epoch: number;
  tree_data: string;
  commit_json: string | null;   // NEW: full Commit JSON for Welcome reconstruction
  updated_at: string;
}

export interface GroupMembersTable {
  id: string;
  group_id: GroupId;
  user_id: UserId;
  joined_at: string;
  identity_key: string | null;
  leaf_index: number | null;    // NEW: ratchet tree leaf position; NULL for owners (leaf 0)
}
```

### TreeKEMManager.deleteGroup

```typescript
// Source: packages/client/src/treekem-manager.ts — new method

/**
 * Remove all local tree state for a group.
 * Clears in-memory MLSGroup and all derived epoch keys from the key store.
 * Called before re-joining to reset diverged local state.
 */
async deleteGroup(groupId: GroupId): Promise<void> {
  this.groups.delete(groupId);
  await this.cipher.deleteAllGroupKeys(groupId);
}
```

### GroupCipher.deleteAllGroupKeys Verification

The method already exists on `KeyStore` interface (packages/crypto/src/key-store.ts:19):
```typescript
deleteAllGroupKeys(groupId: GroupId): Promise<number>;
```

And is already implemented in both key stores. `GroupCipher` needs to expose it:
```typescript
// Check if GroupCipher already delegates this — if not, add:
async deleteAllGroupKeys(groupId: GroupId): Promise<number> {
  return this.keyStore.deleteAllGroupKeys(groupId);
}
```

---

## State of the Art

| Old Behavior | New Behavior | When | Impact |
|---|---|---|---|
| `joinGroupTree` always passes `leafIndex=0` | Reads `treeState.leafIndex` from server | Phase 5 | Non-owner members (leaf 1, 2, ...) get correct tree position |
| `joinGroup` builds synthetic epoch-0 Welcome | Uses real Commit from `commitJson` when available | Phase 5 | Correct epoch N group key derived; encrypted messages become readable |
| `commit_json` not stored server-side | Stored on every tree-update | Phase 5 | Recovery possible after page reload without re-invite |
| `leaf_index` not stored server-side | Stored at invite-accept | Phase 5 | `getTreeState` can return correct position per member |
| `TreeKEMManager.deleteGroup` absent | Added as async method | Phase 5 | Primitive for future "Resync encryption" UX flow |

**Key understanding from code review:** The `leafIndex` bug has TWO failure points:
1. `useTreeKEMAutoInit` always calls `joinGroupTree(group.groupId, 0)` — hardcoded 0
2. `joinGroupTree` always passes whatever `leafIndex` it receives directly to `treekemManager.joinGroup` without fetching the real value from server

The fix in `joinGroupTree` should read `leafIndex` from `treeState` (server), NOT from the caller parameter. The caller parameter becomes unnecessary and should be removed to prevent confusion.

---

## Open Questions

1. **Does `MLSGroup.joinFromWelcome` handle the case where the Commit's `committer` is not leaf 0?**
   - What we know: `MLSGroup.joinFromWelcome` calls `treekem.processUpdatePath(updatePath)` which finds the encrypted path secret for "our" node. The process is independent of the committer index.
   - What's unclear: Whether the `transcriptHash` in the reconstructed Welcome's `groupContext` needs to match the exact hash that the current group members have. If there have been commits after the one stored in `commit_json`, the hash will be stale.
   - Recommendation: This is acceptable for recovery — the member will have epoch N's key and can process subsequent commits to catch up. `processCommit` will fail if the transcript hash is wrong, but that's a separate "missed commits" problem outside this phase's scope.

2. **What happens when `commit_json` is from a much older epoch?**
   - What we know: `commit_json` is overwritten on every tree-update, so it always reflects the latest commit.
   - What's unclear: Edge case where the server has a commit at epoch N but the member's private key was generated for epoch N-K (several commits ago). The private key would still be at the right leaf, but path secrets may have changed.
   - Recommendation: This is the same "missed commits" problem. The phase description says this case is out of scope — the fix is designed for cases where the private key is still valid for the current commit's encrypted path secrets (i.e., the member was part of the last commit batch).

3. **Should `deleteGroup` also clear the in-memory `groups` Map entry before awaiting key deletion?**
   - What we know: `this.groups.delete(groupId)` is synchronous and should happen first so `hasTree(groupId)` returns false immediately.
   - Recommendation: Yes — delete from Map synchronously, then `await` the async key deletion. This prevents a race where another call sees `hasTree=true` during the async operation.

---

## Manual Testing Steps

Per CLAUDE.md — provide manual testing steps where applicable.

### Testing REQ-5.1 and REQ-5.2 (Migration + Server Storage)
1. Run `wrangler dev` locally and apply the new migration
2. Register two users (Alice and Bob)
3. Alice creates a group and initializes TreeKEM (epoch becomes 1)
4. Alice creates an invite; Bob accepts it
5. Check D1 via Wrangler: `SELECT leaf_index FROM group_members WHERE user_id = '<bob_id>'` — should return 1 (not NULL)
6. Check: `SELECT commit_json FROM group_tree_state WHERE group_id = '<group_id>'` — should contain a full JSON Commit object

### Testing REQ-5.3 (getTreeState Response)
1. After step 5 above, call `GET /api/groups/<group_id>/tree-state` as Bob
2. Response JSON should include `commitJson` (non-null string) and `leafIndex: 1`
3. Call the same endpoint as Alice (owner) — should return `leafIndex: 0`

### Testing REQ-5.4 and REQ-5.5 (Client Recovery)
1. Both Alice and Bob chat; verify messages encrypt/decrypt correctly (epoch N)
2. Simulate divergence: reload Bob's browser (clears in-memory TreeKEM state but not IndexedDB private key)
3. Bob should auto-rejoin via `useTreeKEMAutoInit` — verify the console shows no divergence error
4. Alice sends a new message; Bob should be able to decrypt it (verify no "GroupCipherError" in console)

### Testing REQ-5.6 (deleteGroup)
1. Call `treekemManager.deleteGroup(groupId)` from browser console (via devtools)
2. Verify `treekemManager.hasTree(groupId)` returns `false`
3. Verify IndexedDB `microchat-keys` database no longer contains entries for that groupId
4. Verify `joinGroupTree` can re-initialize the tree after `deleteGroup`

---

## Sources

### Primary (HIGH confidence)
- Direct code inspection: `packages/server/src/routes/groups.ts` — all server endpoint implementations
- Direct code inspection: `packages/server/src/db/schema.ts` — current table types
- Direct code inspection: `packages/server/src/db/migrations/` — migration naming/SQL pattern
- Direct code inspection: `packages/client/src/treekem-manager.ts` — current `joinGroup` implementation
- Direct code inspection: `packages/crypto/src/mls-group.ts` — `MLSGroup.joinFromWelcome` signature and behavior
- Direct code inspection: `packages/crypto/src/key-store.ts` — `KeyStore` interface including `deleteAllGroupKeys`
- Direct code inspection: `packages/crypto/src/indexeddb-key-store.ts` — `deleteAllGroupKeys` already implemented
- Direct code inspection: `apps/web/hooks/useTreeKEM.ts` — `joinGroupTree` call sites and hardcoded 0
- Direct code inspection: `apps/web/hooks/useTreeKEMAutoInit.ts` — `joinGroupTree(group.groupId, 0)` caller
- Direct code inspection: `packages/client/src/client.ts` — `getTreeState()` current return type
- Direct code inspection: `packages/crypto/src/mls-commit.ts` — `Welcome` and `Commit` type definitions

### Secondary (MEDIUM confidence)
- Cloudflare D1 documentation pattern: `ALTER TABLE ... ADD COLUMN` for nullable columns — consistent with existing migration files in project
- SQLite behavior: `ADD COLUMN` sets existing rows to NULL (default) — consistent across SQLite versions

### Tertiary (LOW confidence — not needed, everything verified from source)
None required.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all tools already in project, verified from source
- Architecture patterns: HIGH — based on direct code inspection of existing endpoints and matching patterns
- Pitfalls: HIGH — derived from reading actual code paths and understanding how `joinGroup`, `MLSGroup.joinFromWelcome`, and `processUpdatePath` interact
- Type changes: HIGH — TypeScript interfaces and function signatures read directly from source

**Research date:** 2026-02-28
**Valid until:** 2026-03-30 (stable internal codebase — changes only when someone modifies the files above)
