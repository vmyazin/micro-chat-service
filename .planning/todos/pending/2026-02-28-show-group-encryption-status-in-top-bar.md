---
created: 2026-02-28T20:04:48.664Z
title: Show group encryption status in top bar
area: ui
files:
  - apps/web/app/chat/[groupId]/page.tsx
  - apps/web/hooks/useTreeKEM.ts
  - apps/web/hooks/useTreeKEMAutoInit.ts
---

## Problem

Users have no visible signal that their messages are end-to-end encrypted. The group top bar currently shows the group name but nothing about the encryption state. Users can't tell whether TreeKEM has initialized, is still syncing, or has a problem.

## Solution

In the group chat top bar, add a small status indicator comprising:
- A lock icon (locked = encrypted and synced, unlocked or warning = not ready)
- Small text label reflecting current state, e.g.:
  - "End-to-end encrypted" (epoch > 0, tree synced)
  - "Syncing encryption…" (tree initializing)
  - "Encryption unavailable" (fallback/degraded mode)

Source of truth: `useTreeKEM` / `useTreeKEMAutoInit` already expose the current epoch and group tree state — the indicator can read from there without new data fetching.
