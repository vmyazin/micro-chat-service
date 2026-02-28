---
phase: 05-treekem-state-recovery
plan: "02"
subsystem: server-routes
tags: [treekem, server, groups, leaf-index, commit-json, state-recovery]
dependency_graph:
  requires: ["05-01"]
  provides: ["leaf_index persisted on invite-accept", "commit_json persisted on tree-update", "getTreeState returns leafIndex+commitJson"]
  affects: ["05-03-client-integration"]
tech_stack:
  added: []
  patterns: ["pre-insert count for 0-based leaf index", "conditional spread for optional response fields"]
key_files:
  modified:
    - packages/server/src/routes/groups.ts
decisions:
  - "Move member count query BEFORE INSERT so pre-insert count = new member's 0-based leaf index (no off-by-one)"
  - "Store body.commit (full Commit JSON) as commit_json, not treeData (RatchetTree only) — full Commit needed for Welcome reconstruction"
  - "null-coalesce leaf_index ?? 0 so group owners and pre-migration members default to 0 without schema changes"
  - "Omit commitJson from response when null using conditional spread — preserves response shape for pre-migration groups"
metrics:
  duration: "~2 minutes"
  completed: "2026-02-28"
  tasks_completed: 2
  files_modified: 1
---

# Phase 05 Plan 02: Server Route Changes Summary

**One-liner:** Three endpoint changes in groups.ts to persist leaf_index on invite-accept, store full Commit JSON on tree-update, and return both fields from getTreeState.

## What Was Built

Updated `packages/server/src/routes/groups.ts` with three targeted changes enabling TreeKEM state recovery:

### Change 1 — Invite-accept: persist leaf_index (Task 1, ~lines 272-289)

**Problem:** The old code ran the member count query AFTER the INSERT, then subtracted 1 (`count - 1`) to compute the leaf index. While the subtraction gave the right number, the leaf index was never saved to the database.

**Fix:**
- Moved the `SELECT COUNT(*)` query to run BEFORE the INSERT
- Pre-insert count equals the new member's 0-based leaf index (no off-by-one subtraction needed)
- Added `leaf_index` column and parameter to the `INSERT INTO group_members` statement
- Removed the now-redundant post-insert count + subtraction

**Key lines changed:**
- Before: `INSERT INTO group_members (id, group_id, user_id, joined_at, identity_key) VALUES (?, ?, ?, ?, ?)`
- After: `INSERT INTO group_members (id, group_id, user_id, joined_at, identity_key, leaf_index) VALUES (?, ?, ?, ?, ?, ?)`

### Change 2 — Tree-update: persist commit_json (Task 2, ~lines 595-599)

**Problem:** The upsert only stored `treeData` (the extracted RatchetTree portion), not the full Commit JSON. The RatchetTree alone cannot reconstruct a Welcome message.

**Fix:** Extended the `INSERT INTO group_tree_state ... ON CONFLICT DO UPDATE` to include `commit_json`, storing `body.commit` (the full MLS Commit JSON string) directly.

**SQL change:**
- Before: `INSERT INTO group_tree_state (group_id, epoch, tree_data, updated_at) VALUES (?, ?, ?, ?)`
- After: `INSERT INTO group_tree_state (group_id, epoch, tree_data, commit_json, updated_at) VALUES (?, ?, ?, ?, ?)`

### Change 3 — getTreeState: return leafIndex + commitJson (Task 2, ~lines 494-548)

**Problem:** The handler neither selected `commit_json` from the DB nor fetched the requesting user's `leaf_index`, so clients could not recover tree state.

**Fix (three sub-changes):**
1. Added `commit_json: string | null` to the SELECT query type and SQL string
2. Added a new query after `const state = rows[0]`: `SELECT leaf_index FROM group_members WHERE group_id = ? AND user_id = ?`, null-coalesced to `0`
3. Both response branches (pending-welcome branch and final fallback) now include:
   - `leafIndex` — always present, `0` for owners/pre-migration members
   - `...(state.commit_json ? { commitJson: state.commit_json } : {})` — omitted when null

## Decisions Made

### Pre-insert vs post-insert count for leaf_index
- **Decision:** Count members BEFORE the INSERT
- **Rationale:** Pre-insert count = number of existing members = 0-based index for the new member. This eliminates the old off-by-one subtraction (`count - 1`), makes intent clearer, and ensures the value is available to pass directly to the INSERT statement.

### Store body.commit, not treeData, as commit_json
- **Decision:** Store `body.commit` (full Commit JSON) as `commit_json`
- **Rationale:** `treeData` is the RatchetTree only (extracted from the Commit in the tree-update handler). The full Commit contains `updatePath`, `proposals`, `transcriptHash`, `newEpoch`, etc. — all required for Welcome reconstruction during state recovery. The client needs the full Commit, not just the RatchetTree.

### Conditional spread for commitJson in responses
- **Decision:** Use `...(state.commit_json ? { commitJson: state.commit_json } : {})` instead of `commitJson: state.commit_json ?? null`
- **Rationale:** Omitting the field when null preserves the original response shape for pre-migration groups. Clients that don't expect this field won't receive it unnecessarily.

## Deviations from Plan

None — plan executed exactly as written.

## Manual Testing Steps

After applying the migration with `wrangler dev`:

1. Register Alice + Bob. Alice creates group + initializes TreeKEM (POST /api/groups, POST /api/groups/:id/tree-update).
2. Alice creates invite code (POST /api/groups/:id/invites); Bob accepts (POST /api/invites/:code/accept).
3. Via Wrangler D1 console: `SELECT leaf_index FROM group_members WHERE user_id = '<bob_id>'` — should return `1`.
4. `SELECT commit_json FROM group_tree_state WHERE group_id = '<group_id>'` — should return a non-null JSON string.
5. Call `GET /api/groups/<group_id>/tree-state` as Bob — response should include `commitJson` (non-null) and `leafIndex: 1`.
6. Call same endpoint as Alice — response should include `leafIndex: 0` (null-coalesced from NULL owner row) and `commitJson`.

## Self-Check

### Files Exist
- [x] packages/server/src/routes/groups.ts — modified

### Commits Exist
- [x] 57f7726 — feat(05-02): persist leaf_index in invite-accept before INSERT
- [x] eed416d — feat(05-02): persist commit_json in tree-update, return leafIndex+commitJson from getTreeState

## Self-Check: PASSED
