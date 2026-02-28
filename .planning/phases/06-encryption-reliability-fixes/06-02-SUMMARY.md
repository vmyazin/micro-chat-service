---
phase: 06-encryption-reliability-fixes
plan: "02"
subsystem: ui
tags: [react-query, treekem, zustand, retry, d1-replication]

# Dependency graph
requires:
  - phase: 06-encryption-reliability-fixes
    provides: "06-01: epoch-0 guard and joinGroup crypto fixes"
provides:
  - "useMessages retries 403 up to 3x with 500/1000/2000ms backoff"
  - "useMembers retries 403 up to 3x with 500/1000/2000ms backoff"
  - "handleResync calls setTreeEpoch after successful join when epoch > 0"
  - "handleResync invalidates members query in finally block"
  - "joinGroupTree 404 handling confirmed and documented"
affects: [future-ui-phases, e2e-tests]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "React Query retry callback scoped to 403 for D1 replication lag tolerance"
    - "Zustand epoch sync after successful tree resync"
    - "Members query invalidation in resync finally block"

key-files:
  created: []
  modified:
    - apps/web/hooks/useMessages.ts
    - apps/web/hooks/useMembers.ts
    - apps/web/app/(chat)/chat/[groupId]/page.tsx
    - apps/web/hooks/useTreeKEM.ts

key-decisions:
  - "Retry callback scoped to these two hooks only — avoids accidentally masking auth bugs in other queries"
  - "setTreeEpoch only called when hasTree && epoch > 0 — else-if branch prevents setting 0 for 404-no-tree case"
  - "Members query invalidation placed in finally block so it runs regardless of resync success/failure"
  - "REQ-6.4 required no code changes — both getTreeState null-on-404 and joinGroupTree null guard already in place"

patterns-established:
  - "Pattern: 403-specific retry with exponential backoff for D1 replica lag"
  - "Pattern: Always invalidate related queries in finally after operations that modify membership"

requirements-completed:
  - REQ-6.2
  - REQ-6.4
  - REQ-6.5

# Metrics
duration: 12min
completed: 2026-02-28
---

# Phase 06 Plan 02: UI Reliability Fixes Summary

**React Query 403-retry backoff for D1 replication lag, post-resync Zustand epoch sync, and 404 tree-state null-guard confirmation**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-02-28T20:00:00Z
- **Completed:** 2026-02-28T20:12:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Added 403-specific retry function (3x, 500/1000/2000ms backoff) to `useMessages` and `useMembers` to absorb D1 read-replica replication lag after invite-accept
- Updated `handleResync` in `ConversationPage` to call `setTreeEpoch` after successful join (epoch > 0) and invalidate members query in finally block
- Confirmed `joinGroupTree` already handles 404 tree-state safely; added inline comment documenting the null guard

## Task Commits

Each task was committed atomically:

1. **Task 1: Add 403-retry config to useMessages and useMembers** - `4e93bd9` (feat)
2. **Task 2: Update handleResync to sync Zustand epoch and invalidate members query** - `5b30cea` (feat)
3. **Task 3: Confirm REQ-6.4 -- 404 tree-state handling is already safe** - `6281e91` (docs)

**Plan metadata:** see final commit (docs: complete plan)

## Files Created/Modified
- `apps/web/hooks/useMessages.ts` - Replaced `retry: 1` with 403-aware retry function and retryDelay
- `apps/web/hooks/useMembers.ts` - Replaced `retry: 1` with 403-aware retry function and retryDelay
- `apps/web/app/(chat)/chat/[groupId]/page.tsx` - Added `setTreeEpoch` selector; updated `handleResync` with epoch sync and members invalidation
- `apps/web/hooks/useTreeKEM.ts` - Added inline comment documenting 404 null-guard behavior in `joinGroupTree`

## Decisions Made
- Retry callback is scoped to `useMessages` and `useMembers` only — global retry would hide auth bugs in other queries
- `setTreeEpoch` is called only when `hasTree && epoch > 0` — the `else if` branch prevents accidentally writing epoch=0 to Zustand when the 404-no-tree path is taken (REQ-6.4 pitfall)
- Members query invalidation placed in `finally` block so it always runs, even when resync fails (partial recovery still updates member list)
- REQ-6.4 required no code changes — both the client 404 null return and the joinGroupTree null guard were already in place

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Manual Testing Steps

**REQ-6.2 (403 retry for D1 lag):**
1. Register a fresh user (Charlie) in a private browser window
2. Alice creates a group and generates an invite code
3. Open DevTools Network tab in Charlie's browser BEFORE accepting the invite
4. Charlie pastes the invite code and accepts
5. Observe: `GET /api/groups/:id/members` and `GET /api/groups/:id/messages` may show initial 403 in Network
6. Expected: React Query retries automatically; within ~3 seconds both succeed (200) and Charlie sees the group

**REQ-6.4 (404 grace on no-tree group):**
1. Create a group but skip TreeKEM initialization
2. As another user, join the group normally
3. Observe: `GET /api/groups/:id/tree-state` returns 404; chat page loads normally with no JS error

**REQ-6.5 (post-resync epoch refresh):**
1. Alice and Bob are in an encrypted group (epoch N > 0)
2. Bob clicks "Resync encryption" button in the banner
3. Expected: Spinner appears then disappears; encryption epoch banner shows N (not 0); message list refreshes; Bob can send a message without page reload

## Next Phase Readiness
- All three UI reliability bugs fixed for the 06 phase
- The retry config pattern (403-specific backoff) is reusable for other hooks if similar D1 lag issues emerge
- No blockers for remaining plans in phase 06

---
*Phase: 06-encryption-reliability-fixes*
*Completed: 2026-02-28*
