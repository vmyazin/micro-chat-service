# Phase 5: TreeKEM State Recovery - Context

**Gathered:** 2026-02-28
**Status:** Ready for planning
**Source:** PRD Express Path (bug report — TreeKEM divergence)

<domain>
## Phase Boundary

This phase fixes a critical TreeKEM state divergence bug where a member (e.g. Vasily) ends up with a different epoch N+1 key than the group. The root cause: `joinGroupTree` falls back to a synthetic epoch-0 welcome with `leafIndex=0`, which is wrong for any non-owner member. The fix persists enough server-side data (`leaf_index`, `commit_json`) so that a diverged member can reconstruct the correct welcome from their existing private key and re-join without a full re-invite.

**Out of scope:** Recovering old blobs encrypted with the diverged key (unrecoverable by design). The "Resync encryption" UI button is deferred — `deleteGroup()` is the only UI-adjacent piece delivered here.

</domain>

<decisions>
## Implementation Decisions

### Database Schema (Locked)
- `ALTER TABLE group_members ADD COLUMN leaf_index INTEGER` — persists the leaf position assigned when the invite was accepted
- `ALTER TABLE group_tree_state ADD COLUMN commit_json TEXT` — persists the full serialized commit from the last tree update

### Server: Invite Accept (Locked)
- When a member accepts an invite, the server records their `leaf_index` in `group_members`
- Leaf index is determined by the tree insert position at accept time

### Server: Tree Update (Locked)
- On every POST to the tree-update endpoint, the server stores the serialized `commit_json` in `group_tree_state`

### Server: getTreeState Response (Locked)
- `getTreeState` returns `commitJson` and `leafIndex` for the authenticated requesting member
- `leafIndex` is fetched from `group_members` for the current user

### Client: joinGroup in treekem-manager.ts (Locked)
- `joinGroup` receives `commitJson` from the server response
- Uses `commitJson` to reconstruct the welcome message (replaces the epoch-0 synthetic fallback)
- The member's existing private key in IndexedDB/localStorage can decrypt path secrets from the original commit

### Client: joinGroupTree (Locked)
- `joinGroupTree` uses `leafIndex` from the server `getTreeState` response
- Removes the hardcoded `leafIndex=0` passed to `joinGroup`

### Client: TreeKEMManager.deleteGroup (Locked)
- Add `deleteGroup(groupId: string): void` method to `TreeKEMManager`
- Clears local tree state for the group from the key store
- Intended for use by a future "Resync encryption" button — not wired to UI in this phase

### Claude's Discretion
- Exact field name casing in API response (`commitJson` vs `commit_json` — use camelCase in TypeScript types, snake_case in DB)
- Error handling for groups where `commit_json` is NULL (tree initialized before this migration) — fall back to existing synthetic welcome behavior
- TypeScript type updates for `TreeStateResponse` to include optional `commitJson` and `leafIndex`
- Migration rollback strategy

</decisions>

<specifics>
## Specific Ideas

**The recovery flow (from bug report):**
1. Vasily's `useTreeKEMAutoInit` calls `joinGroupTree(groupId, 0)`
2. `joinGroupTree` calls `getTreeState` → server now returns `{ ..., commitJson, leafIndex: 2 }` (for example)
3. `joinGroupTree` passes `leafIndex=2` (not hardcoded 0) to `joinGroup`
4. `joinGroup` calls `treekem.joinFromCommit(commitJson, privateKey)` instead of the synthetic epoch-0 path
5. Vasily's private key decrypts path secrets from the commit → correct epoch N key derived
6. Tree state is now in sync

**Why this works:** Vasily's private key was never lost — it was stored in IndexedDB. The problem was only that the server didn't give back enough context to reconstruct the correct welcome. With `commit_json` stored server-side, the client has everything it needs.

**deleteGroup use case:** Before a "Resync encryption" flow (future), the client must purge stale local tree state. `deleteGroup()` provides this primitive.

</specifics>

<deferred>
## Deferred Ideas

- "Resync encryption" UI button that calls `deleteGroup()` then re-triggers `joinGroupTree` — deferred to a future UX phase
- Recovering blobs encrypted with diverged keys — cryptographically impossible, explicitly out of scope
- Automated divergence detection (epoch mismatch detection on decrypt failure) — future hardening phase

</deferred>

---

*Phase: 05-treekem-state-recovery*
*Context gathered: 2026-02-28 via PRD Express Path (bug report)*
