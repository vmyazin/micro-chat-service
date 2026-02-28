---
created: 2026-02-28T20:36:54.413Z
title: Auto-initialize encryption for new and existing groups
area: ui
files:
  - apps/web/hooks/useTreeKEM.ts
  - apps/web/hooks/useTreeKEMAutoInit.ts
  - apps/web/components/GroupSettings.tsx
---

## Problem

Encryption is not established by default when a group is created or joined. This results in two persistent UX issues:

1. The top bar shows "Syncing..." indefinitely because `useTreeKEMAutoInit` polls for tree state that never exists — it 404s and keeps retrying with no end state.
2. "Initialize Encryption" is always visible in Group Settings as an initial CTA, even for groups that just need encryption set up automatically — it reads as a manual maintenance action rather than a normal setup step.

The current design assumes the group creator intentionally defers encryption initialization, but in practice every group wants encryption on. This creates confusion: users see "Syncing" on a fresh group and don't know if something is wrong.

## Solution

**Consider auto-initializing TreeKEM when a group is created (and possibly when a user first joins).**

### Pros
- No "Syncing" limbo state for new groups — encryption starts working immediately
- "Initialize Encryption" button disappears from Settings for groups that are properly initialized, reducing noise
- UX matches user expectation: encryption should just work, not be an explicit step

### Cons / risks
- Tree init fails silently on the client (by design) — if auto-init fires but fails, the group still shows Syncing and there's no path forward
- For existing groups (created before this change), the server has no tree state — auto-init on join would need to handle "I'm not the creator, should I init?" logic, which is non-trivial
- Race condition: if two members both auto-init on join, epoch conflicts occur (409) — need to ensure only the creator auto-inits on create, and joiners use the existing tree

### Approach hints
- On group create: fire `initTree` immediately after creation (in `useCreateGroup` or similar)
- On join: only call `joinGroupTree` if tree state exists on server (already the case) — no change needed
- "Initialize Encryption" button in GroupSettings should be hidden if tree is already initialized (check `treeEpoch > 0`)
- The "Syncing" indicator should distinguish between "tree state is loading" and "tree state does not exist" — latter should show a different state (or nothing)
