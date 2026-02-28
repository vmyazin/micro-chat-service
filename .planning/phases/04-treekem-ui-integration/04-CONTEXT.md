# Phase 4: TreeKEM UI Integration - Context

**Gathered:** 2026-02-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire all UI flows (create group, join group, send message) to the TreeKEM lifecycle so the app uses live key material instead of epoch 0 fallbacks. Scope is integration only — no new crypto primitives, no new UI surfaces beyond loading feedback during join.

</domain>

<decisions>
## Implementation Decisions

### Error handling UX
- Tree init failure after group creation → navigate to chat immediately, retry silently in background. No user-visible error for init failure.
- joinGroupTree failure after accepting invite → show a toast "Setting up encrypted session…" with a spinner. Dismisses automatically on success or timeout.
- Hard timeout: 5 seconds. After 5s, dismiss any spinner/toast and proceed in degraded mode (epoch 0). No manual retry prompt.
- If tree init keeps failing and messages go out with epoch 0 → dev-only console warning (`console.warn`), nothing in production UI. Users are not informed.

### Key persistence strategy
- On page reload, in-memory keys are lost. Recovery: auto re-init from server on app load. No manual action required from the user.
- Re-init trigger location: a **global app-level hook** that re-inits all known groups on app start (not per-chat-page). Everything is ready before user opens any chat.
- User-visible feedback during global re-init: none. Happens silently in the background.
- Partial failure (one group's re-init fails): skip that group silently, fall back to epoch 0 if user opens it. Dev console warning only. No retry scheduling.

### Epoch-0 guard behavior
- Sending in epoch 0 is **allowed** — epoch 0 still encrypts with AES-256-GCM. No UI blocking or send-button disabling.
- When epoch advances from 0 → 1+, already-sent messages stay as-is. No retroactive re-encryption.
- GET /tree-state returning 404 on app load → skip silently. Not an error — tree hasn't been initialized by the creator yet. No polling.

### Claude's Discretion
- Exact toast styling (which toast library/component, position, duration before auto-dismiss)
- Exponential backoff parameters for silent retry
- Exact console.warn message format for epoch-0 sends
- How to enumerate "all known groups" for global re-init (from Zustand store, from API, etc.)

</decisions>

<specifics>
## Specific Ideas

- The "Setting up encrypted session…" toast on join is the only user-visible loading state for tree init. Keep it brief and non-alarming.
- Global re-init on app load should be non-blocking — the app should be fully usable while it runs in the background.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 04-treekem-ui-integration*
*Context gathered: 2026-02-28*
