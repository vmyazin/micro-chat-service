# MicroChat Roadmap

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4 (shipped 2026-02-28)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-4) — SHIPPED 2026-02-28</summary>

- [x] Phase 1: Core Chat — completed
- [x] Phase 2: Voice Calls — completed
- [x] Phase 3: TreeKEM Crypto + Server Wiring — completed
- [x] Phase 4: TreeKEM UI Integration — completed 2026-02-28

</details>

## v1.1 Encryption Hardening

- [ ] Phase 5: TreeKEM State Recovery — Fix tree divergence: persist leaf_index + commit_json, enable real re-join without resetting epoch

**Goal:** Members whose TreeKEM state diverges (e.g. missed a commit) can self-recover by reloading without needing a full re-invite.

**Requirements:**
- REQ-5.1: DB migration adds `leaf_index` to `group_members` and `commit_json` to `group_tree_state`
- REQ-5.2: Server stores leaf_index when invite is accepted and commit_json on every tree update
- REQ-5.3: `getTreeState` endpoint returns `commitJson` and `leafIndex` for the requesting member
- REQ-5.4: `joinGroup` in `treekem-manager.ts` uses server-supplied `commitJson` to reconstruct welcome (replaces epoch-0 synthetic fallback)
- REQ-5.5: `joinGroupTree` uses server-supplied `leafIndex` instead of hardcoded 0
- REQ-5.6: `TreeKEMManager.deleteGroup(groupId)` method added for use by a future "Resync encryption" UI button

**Plans:** 3 plans

Plans:
- [ ] 05-01-PLAN.md — DB migration + schema.ts type interfaces (REQ-5.1)
- [ ] 05-02-PLAN.md — Server endpoint changes: invite-accept, tree-update, getTreeState (REQ-5.2, REQ-5.3)
- [ ] 05-03-PLAN.md — Client changes: getTreeState type, joinGroup commitJson path, joinGroupTree, deleteGroup (REQ-5.4, REQ-5.5, REQ-5.6)

## Phase 6: Encryption Reliability Fixes

- [ ] Phase 6: Encryption Reliability Fixes — Fix remaining crypto bugs: UpdatePath decryption failure on resync, 403 on members/messages after invite-accept, epoch-0 key guard

**Goal:** Encrypted message exchange works reliably end-to-end: resync succeeds after page reload, newly invited members can read/send messages without re-invite, and no crash at epoch 0.

**Requirements:**
- REQ-6.1: `processUpdatePath` succeeds for the second member (Simon-2 scenario) — root cause of `leafIndex` calculation or commit_json staleness identified and fixed
- REQ-6.2: Members who accepted an invite can access `/api/groups/:id/members` and `/api/groups/:id/messages` (no spurious 403)
- REQ-6.3: Guard against epoch-0 key storage/retrieval in GroupCipher and key store — epoch 0 is the uninitialised state and must never attempt to derive/store a message key
- REQ-6.4: `joinGroupTree` handles 404 tree-state gracefully (group has no server tree) without throwing and without leaving the UI in a broken state
- REQ-6.5: After a successful resync, the chat window shows messages and allows sending without requiring a page reload

**Plans:** 2 plans

Plans:
- [ ] 06-01-PLAN.md — Crypto/client bug fixes: epoch-0 guard in GroupCipher, remove try/catch from joinGroup commitJson path (REQ-6.1, REQ-6.3)
- [ ] 06-02-PLAN.md — Web/UI fixes: 403 retry in useMessages + useMembers, post-resync Zustand sync, confirm 404 grace (REQ-6.2, REQ-6.4, REQ-6.5)

## Progress

| Phase                             | Milestone | Status   | Completed  |
| --------------------------------- | --------- | -------- | ---------- |
| 1. Core Chat                      | v1.0      | Complete | —          |
| 2. Voice Calls                    | v1.0      | Complete | —          |
| 3. TreeKEM Crypto + Server Wiring | v1.0      | Complete | —          |
| 4. TreeKEM UI Integration         | v1.0      | Complete | 2026-02-28 |
| 5. TreeKEM State Recovery         | v1.1      | Planned  | —          |
| 6. Encryption Reliability Fixes   | v1.1      | Planned  | —          |
