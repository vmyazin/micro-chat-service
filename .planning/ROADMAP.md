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

## Progress

| Phase                             | Milestone | Status   | Completed  |
| --------------------------------- | --------- | -------- | ---------- |
| 1. Core Chat                      | v1.0      | Complete | —          |
| 2. Voice Calls                    | v1.0      | Complete | —          |
| 3. TreeKEM Crypto + Server Wiring | v1.0      | Complete | —          |
| 4. TreeKEM UI Integration         | v1.0      | Complete | 2026-02-28 |
| 5. TreeKEM State Recovery         | v1.1      | Planned  | —          |
