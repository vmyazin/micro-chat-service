---
phase: quick
plan: 1
subsystem: ui
tags: [treekem, encryption, e2e, voice-message, image-message, forward-secrecy]

# Dependency graph
requires: []
provides:
  - Voice messages pass the current TreeKEM epoch when sent
  - Image messages pass the current TreeKEM epoch when sent
  - All three message types (text, voice, image) use live key material
affects: [e2e-encryption, message-send-paths]

# Tech tracking
tech-stack:
  added: []
  patterns: [treekemManager.getEpoch(groupId) called before every message send of any type]

key-files:
  created: []
  modified:
    - apps/web/app/(chat)/chat/[groupId]/page.tsx

key-decisions:
  - "Retrieve epoch immediately before each send call (not once at component mount) so the latest epoch is always used"

patterns-established:
  - "All message send paths call treekemManager.getEpoch(groupId as GroupId) and pass the result as the epoch argument"

requirements-completed: []

# Metrics
duration: 5min
completed: 2026-02-27
---

# Quick Task 1: TreeKEM UI Integration Summary

**Voice and image message sends now pass the current TreeKEM epoch, closing a forward-secrecy gap where those paths fell back to epoch 0 while text messages used live key material.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-02-27T00:00:00Z
- **Completed:** 2026-02-27T00:05:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- `handleSendVoiceMessage` now calls `treekemManager.getEpoch(groupId as GroupId)` and passes the epoch to `client.sendVoiceMessage`
- `handleSendImage` now calls `treekemManager.getEpoch(groupId as GroupId)` and passes the epoch to `client.sendImageMessage`
- All three message-send paths are consistent: text, voice, and image all use the current TreeKEM epoch

## Task Commits

1. **Task 1: Pass epoch to voice and image message sends** - `51a141a` (feat)

## Files Created/Modified
- `apps/web/app/(chat)/chat/[groupId]/page.tsx` - Added epoch retrieval and forwarding in `handleSendVoiceMessage` (line 435) and `handleSendImage` (line 463)

## Decisions Made
- Epoch is retrieved immediately before each send (not memoized at render time) so that if the epoch changes mid-session (e.g., after a tree update), the most recent value is used.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. TypeScript check (`tsc --noEmit`) passed with no errors after the change.

## Manual Testing Steps

Per CLAUDE.md, manual testing steps:

1. Start dev server: `pnpm dev`
2. Open two browser windows and log in as two different users
3. Have User A create a group and User B join via invite link
4. User A records and sends a voice message — verify it sends without error (check browser console for epoch-related warnings)
5. User A sends an image — verify it sends without error
6. User B receives both messages and can play/view them
7. In the browser DevTools Network tab, confirm the POST requests to `/api/groups/:id/messages` include a non-zero `epoch` in the request body for voice and image sends (previously these would show `epoch: 0` or omit the field entirely)

## Next Phase Readiness

- All message-send paths now forward the current TreeKEM epoch
- No blockers for further encryption work

---
*Phase: quick*
*Completed: 2026-02-27*
