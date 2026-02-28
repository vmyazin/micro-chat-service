---
created: 2026-02-28T19:52:26.941Z
title: Show encrypted message guard with recovery action
area: ui
files:
  - apps/web/components/MessageBubble.tsx
  - apps/web/hooks/useTreeKEM.ts
---

## Problem

When a user's TreeKEM state is diverged (or not yet initialized), encrypted messages arrive as undecryptable blobs. The app currently renders these raw — users see garbled binary/base64 text and have no idea what happened or what to do.

This is especially confusing for:
- A user who just joined a group but whose `joinGroup` path hasn't fully synced yet
- A user whose state diverged (the scenario fixed in Phase 5) before the recovery path fires
- Any user on a fresh device/session where IndexedDB keys haven't been restored

The UX need: detect that a message is an undecrypted blob, replace it with a readable explanation ("This message could not be decrypted"), and show a contextual action button (e.g. "Resync encryption" which calls `deleteGroup()` + re-triggers `joinGroupTree`).

## Solution

1. In the message rendering layer: detect when decryption returns an error or when the message content looks like a raw ciphertext blob — render a locked-message placeholder instead of the raw bytes.
2. Placeholder UI should show:
   - Icon + text: "Message encrypted — your key is out of sync"
   - Action button: "Resync" → calls `TreeKEMManager.deleteGroup(groupId)` then re-runs `joinGroupTree(groupId)` (both now exist from Phase 5)
3. After resync, the message list should re-attempt decryption (or at minimum show a "reload" prompt).

`TreeKEMManager.deleteGroup` was added in Phase 5 (REQ-5.6) specifically to support this future button.
