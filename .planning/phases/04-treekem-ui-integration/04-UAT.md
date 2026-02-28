---
status: testing
phase: 04-treekem-ui-integration
source: 04-RESEARCH.md, 04-CONTEXT.md (no SUMMARY.md - implemented directly)
started: 2026-02-28T00:00:00Z
updated: 2026-02-28T00:00:00Z
---

## Current Test

number: ~
name: ~
awaiting: complete

## Tests

### 1. Keys persist in IndexedDB after group creation
expected: After creating a group, open DevTools → Application → IndexedDB → microchat-keys → group-keys. At least one record should be present with a key for the new group at epoch 1.
result: pass

### 2. Keys survive page reload
expected: After the keys appear in IndexedDB (Test 1), reload the page. Open DevTools → IndexedDB → microchat-keys → group-keys again. The same records should still be there (not wiped on reload, unlike MemoryKeyStore).
result: pass

### 3. Send message works after page reload
expected: After reloading, navigate to the group and send a message. The send should succeed without a "No key found" error — useTreeKEMAutoInit silently re-joins the tree in the background.
result: pass
notes: |
  Console showed [KeyStore] logs from memory-key-store.ts (epoch 0, call cipher) — expected.
  callKeyStore uses MemoryKeyStore (call keys derived deterministically).
  messageKeyStore uses IndexedDBKeyStore (message keys persisted). Architecture correct.

### 4. Invite acceptance shows encryption spinner
expected: Open an invite link in a second browser/incognito window. After the "Joining group…" step completes, the page should briefly show a spinner with "Setting up encrypted session…" before redirecting to the chat.
result: pass

### 5. Message send degrades gracefully without tree
expected: In a group where tree init hasn't completed (or for a pre-phase-4 group with no tree state on the server), sending a message should succeed without crashing — it sends unencrypted rather than throwing "No key found for epoch 0".
result: pass

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
