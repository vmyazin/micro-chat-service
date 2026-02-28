# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — MVP

**Shipped:** 2026-02-28
**Phases:** 4 | **Plans:** informal (quick-task workflow) | **Timeline:** 36 days

### What Was Built
- Real-time group chat on Cloudflare Workers + Durable Objects
- Voice calls via WebRTC with in-chat call event display
- Custom TreeKEM group key management (epoch-based, forward-secret)
- Full E2E encryption wiring: create group → init tree, accept invite → join tree, send message → use live epoch
- IndexedDB key persistence + silent auto re-init on page load

### What Worked
- Skipping formal GSD planning for the last integration phase (Phase 4) — it was a small wiring task, quick-task workflow was right-sized
- UAT-driven completion: 5 manual tests caught the full integration surface without test infrastructure overhead
- Epoch 0 = degrade gracefully decision avoided a whole class of "encryption not ready" UX bugs
- Server-side epoch optimistic locking (409) + client retry loop kept state consistent without complex sync

### What Was Inefficient
- Phases 1-3 were completed before GSD was set up — no SUMMARY.md files, so milestone archive has no structured history for those phases
- No REQUIREMENTS.md from the start meant requirement traceability is reconstructed post-hoc
- Minimal config.json means GSD tooling had limited context (roadmap analyze showed 0 completed phases despite 4 done)

### Patterns Established
- TreeKEM epoch guard: always `const epoch = rawEpoch > 0 ? rawEpoch : undefined` before encrypting
- MemoryKeyStore for call keys (deterministic), IndexedDBKeyStore for message keys (persistent)
- Test endpoints behind `ENABLE_TEST_ENDPOINTS` env var — always mounted, returns 404 if var not set
- Group settings (invite button) is inside a drawer — E2E tests must open settings first

### Key Lessons
1. Set up GSD from project day 0 — retroactive adoption loses phase history and makes milestone archival incomplete
2. Small integration phases are best served by quick-task workflow — avoid over-planning a 1-day wiring job
3. Graceful degradation > hard failures for crypto — users should never be blocked by a key not being ready

### Cost Observations
- Model mix: primarily Sonnet 4.6
- Sessions: multiple across 36 days
- Notable: Quick-task workflow for Phase 4 was significantly more efficient than a full plan-phase cycle would have been

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Key Change |
|-----------|--------|------------|
| v1.0      | 4      | Initial baseline — GSD adopted mid-project |

### Cumulative Quality

| Milestone | Manual UAT Tests | E2E Playwright Tests |
|-----------|-----------------|----------------------|
| v1.0      | 5/5 passing     | Scaffold in place    |

### Top Lessons (Verified Across Milestones)

1. Adopt tooling (GSD) at project start, not mid-stream — retroactive adoption has high archaeology cost
2. Graceful degradation is a first-class design choice for crypto flows, not an afterthought
