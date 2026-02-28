---
phase: 05-treekem-state-recovery
plan: "01"
subsystem: database
tags: [migration, schema, treekem, state-recovery]
dependency_graph:
  requires: []
  provides: [leaf_index column on group_members, commit_json column on group_tree_state]
  affects: [packages/server/src/routes/groups.ts]
tech_stack:
  added: []
  patterns: [nullable-column-additive-migration]
key_files:
  created:
    - packages/server/src/db/migrations/009_treekem_state_recovery.sql
  modified:
    - packages/server/src/db/schema.ts
decisions:
  - Both columns are nullable with no DEFAULT to preserve backward compatibility with existing rows
  - leaf_index as INTEGER (not REAL) because ratchet tree positions are always whole-number indices
  - commit_json as TEXT to store serialized JSON blob for full MLS Commit reconstruction
metrics:
  duration: "46 seconds"
  completed: "2026-02-28T19:38:00Z"
  tasks_completed: 2
  files_changed: 2
---

# Phase 05 Plan 01: TreeKEM State Recovery — DB Schema Summary

**One-liner:** Added nullable `leaf_index` (INTEGER) to `group_members` and `commit_json` (TEXT) to `group_tree_state` via migration 009, with matching TypeScript interface updates.

## What Was Done

### Task 1: Migration 009_treekem_state_recovery.sql (commit: 62b6bbe)

Created `packages/server/src/db/migrations/009_treekem_state_recovery.sql` with two `ALTER TABLE` statements:

- `ALTER TABLE group_members ADD COLUMN leaf_index INTEGER` — stores the ratchet tree leaf position for each member, set at invite-accept time. NULL for group owners (always leaf 0) and members who pre-date this migration.
- `ALTER TABLE group_tree_state ADD COLUMN commit_json TEXT` — stores the full serialized MLS Commit from the last tree update, used for Welcome message reconstruction during state recovery. NULL for pre-migration groups.

Both columns are nullable with no `DEFAULT` or `NOT NULL` constraint, ensuring zero data migration burden on existing rows.

### Task 2: Update schema.ts TypeScript interfaces (commit: 6477cfd)

Updated `packages/server/src/db/schema.ts`:

- `GroupTreeStateTable`: added `commit_json: string | null` after `tree_data`
- `GroupMembersTable`: added `leaf_index: number | null` after `identity_key`

Both types match the SQL column types exactly (TEXT → `string`, INTEGER → `number`) and include JSDoc comments explaining null semantics.

TypeScript compilation confirmed clean (`npx tsc --noEmit` exits 0).

## Decisions Made

- **No IF NOT COLUMN EXISTS guard:** Cloudflare D1's migration tracker ensures each file runs exactly once; adding guards would be redundant and misleading.
- **Nullable without DEFAULT:** Existing rows get NULL automatically; consumers must handle NULL (leaf 0 for owners, synthetic-welcome fallback for missing commit_json).
- **commit_json after tree_data in interface:** Logical grouping — tree_data and commit_json both describe the same tree snapshot.

## Deviations from Plan

None — plan executed exactly as written.

## Manual Testing Steps

To verify the migration applies correctly against a local D1 database:

1. Run the Wrangler migration apply:
   ```bash
   cd packages/server
   npx wrangler d1 migrations apply microchat-db --local
   ```
2. Confirm migration 009 appears in the applied list.
3. Verify the new columns exist:
   ```bash
   npx wrangler d1 execute microchat-db --local --command "PRAGMA table_info(group_members);" | grep leaf_index
   npx wrangler d1 execute microchat-db --local --command "PRAGMA table_info(group_tree_state);" | grep commit_json
   ```
4. Both should return a row showing the column name, type (INTEGER / TEXT), and nullable (notnull=0).

## Self-Check

### Files

- [x] `packages/server/src/db/migrations/009_treekem_state_recovery.sql` — created
- [x] `packages/server/src/db/schema.ts` — modified (commit_json + leaf_index)

### Commits

- 62b6bbe — chore(05-01): add migration 009_treekem_state_recovery.sql
- 6477cfd — feat(05-01): update schema.ts interfaces for TreeKEM state recovery columns

## Self-Check: PASSED
