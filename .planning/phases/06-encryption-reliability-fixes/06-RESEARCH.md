# Phase 6: Encryption Reliability Fixes - Research

**Researched:** 2026-02-28
**Domain:** TreeKEM/MLS cryptography bug fixes, Cloudflare D1 consistency, React state post-resync
**Confidence:** HIGH

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| REQ-6.1 | `processUpdatePath` succeeds for second member (Simon-2) — root cause of UpdatePath decryption failure identified and fixed | Root cause confirmed: the `catch` block in `joinGroup` swallows the real commitJson failure and falls through to the empty-UpdatePath synthetic path, which also throws. Fix: remove the try/catch swallowing, or re-throw after logging. |
| REQ-6.2 | Members who accepted an invite can access `/api/groups/:id/members` and `/api/groups/:id/messages` (no spurious 403) | Root cause confirmed: both endpoints use identical membership check to `/tree-state`. D1 read-replica lag is the likely cause. Fix: use a write-consistent read or add a short retry on 403. |
| REQ-6.3 | Guard against epoch-0 key storage/retrieval — epoch 0 is uninitialised state | Root cause confirmed: synthetic `joinGroup` fallback calls `cipher.deriveGroupKey(groupId, 0, groupSecret)` which stores a garbage AES key at epoch 0. Fix: guard in `GroupCipher.deriveGroupKey` and `joinGroup` to skip epoch 0. |
| REQ-6.4 | `joinGroupTree` handles 404 tree-state gracefully without throwing or breaking UI | Current state: `client.getTreeState` already returns null on 404; `joinGroupTree` already does `if (!treeState) return`. The 404 path is safe. Fix needed: confirm the 404 happens for groups without ANY tree state and verify the UI does not show a broken state. |
| REQ-6.5 | After successful resync, chat window shows messages and allows sending without page reload | Root cause: `handleResync` calls `refetch()` for messages but `useMembers` data and `treeEpochs` Zustand state are not refreshed. Fix: invalidate members query and call `setTreeEpoch` after successful resync. |
</phase_requirements>

---

## Summary

Phase 6 fixes five interconnected reliability bugs in the TreeKEM encryption stack. All root causes have been identified by direct code inspection — no library research is needed; all fixes are internal to the project.

The most critical bug (REQ-6.1) is in `joinGroup` in `treekem-manager.ts`: the `try/catch` block at lines 93–114 silently swallows `TreeKEMError: Cannot find decryption point in UpdatePath` when the real commitJson-based Welcome fails, then falls through to the synthetic path which issues an empty UpdatePath — also throwing. The result is `handleResync` always throws for any non-trivial tree, and the UI shows "resync failed" even when server-side data is correct. The fix is to let the commitJson path propagate errors rather than silently falling back.

The 403 bug (REQ-6.2) is caused by Cloudflare D1 read-replica eventual consistency: after `POST /api/invites/:code/accept` writes the `group_members` row, the subsequent GET requests for `/members` and `/messages` may hit a replica that hasn't yet seen the write. The `/tree-state` endpoint works because `joinGroupTree` is called from the invite page after a delay (`Promise.race` with 5s timeout), giving D1 time to replicate. The epoch-0 key bug (REQ-6.3) occurs because `MLSGroup.joinFromWelcome` in the synthetic fallback derives a group key at `welcome.epoch = 0`, persisting a garbage AES key at epoch 0 in IndexedDB; subsequent decrypts of messages with `epoch: 0` from the database then use this garbage key. Guarding at both `deriveGroupKey` and the IndexedDB store level prevents accidental use.

**Primary recommendation:** Fix bugs in dependency order: (1) epoch-0 guard in GroupCipher, (2) commitJson error propagation in joinGroup, (3) D1 consistency retry in invite-accept flow, (4) post-resync UI refresh in handleResync. All fixes are surgical — no new dependencies, no schema changes.

---

## Standard Stack

### Core (all already in project — zero new packages)

| Component | Version/Location | Purpose | Phase 6 Role |
|-----------|-----------------|---------|--------------|
| TreeKEM / MLSGroup | `packages/crypto/src/treekem.ts`, `mls-group.ts` | Core crypto primitives | REQ-6.1: processUpdatePath fix |
| TreeKEMManager | `packages/client/src/treekem-manager.ts` | Client-side tree orchestration | REQ-6.1, REQ-6.3: joinGroup fix |
| GroupCipher / IndexedDBKeyStore | `packages/crypto/src/group-cipher.ts`, `indexeddb-key-store.ts` | Key derivation + persistence | REQ-6.3: epoch-0 guard |
| Hono routes | `packages/server/src/routes/groups.ts` | API endpoints | REQ-6.2: 403 fix |
| useTreeKEM hook | `apps/web/hooks/useTreeKEM.ts` | React glue, joinGroupTree | REQ-6.4: 404 handling |
| chat/[groupId]/page.tsx | `apps/web/app/(chat)/chat/[groupId]/page.tsx` | handleResync, UI state | REQ-6.5: post-resync refresh |
| React Query (TanStack Query) | `apps/web` | Server state / cache | REQ-6.5: invalidateQueries |
| Zustand | `apps/web/stores/chat-client-store.ts` | treeEpochs state | REQ-6.5: setTreeEpoch after resync |

### No New Dependencies

This phase requires zero new npm packages.

---

## Architecture Patterns

### Code File Map

```
packages/crypto/src/
├── group-cipher.ts          # REQ-6.3: add epoch-0 guard in deriveGroupKey
├── indexeddb-key-store.ts   # REQ-6.3: optionally guard storeKey at epoch 0
└── treekem.ts               # REQ-6.1: processUpdatePath (READ ONLY — understand error)

packages/client/src/
└── treekem-manager.ts       # REQ-6.1: fix catch block in joinGroup (lines 88-114)

packages/server/src/routes/
└── groups.ts                # REQ-6.2: add retry/wait logic in invite-accept or members/messages endpoints

apps/web/
├── app/(chat)/chat/[groupId]/page.tsx  # REQ-6.5: post-resync UI refresh (handleResync)
└── hooks/useTreeKEM.ts                 # REQ-6.4: confirm 404 grace (already handled)
```

### Pattern 1: REQ-6.1 — The Double-Throw in joinGroup

**What:** `joinGroup` tries the commitJson path in a try/catch. If `MLSGroup.joinFromWelcome` throws `TreeKEMError: Cannot find decryption point in UpdatePath`, the catch block silently swallows it and falls through to the synthetic path. The synthetic path constructs a Welcome with `updatePath: '{"sender":0,"pathPublicKeys":[],"encryptedPathSecrets":[]}'`. `MLSGroup.joinFromWelcome` then calls `treekem.processUpdatePath(emptyUpdatePath)`. With an empty updatePath for a 2+ member tree, `senderCP` has copathNodes, but `isInSubtree(myNode, copathNode)` is still checked — since the empty updatePath has `sender: 0` and `encryptedPathSecrets: [[]]`, `decryptionLevel` is found but `encryptedSecrets` at that level is `[]`, so `findMyTargetNode` returns null and throws `TreeKEMError: No encrypted path secret found for our node`. Both paths fail; `handleResync` sees the outer throw and sets `resyncFailed=true`.

**Root cause in treekem.ts processUpdatePath (lines 226–237):**
```typescript
// Source: packages/crypto/src/treekem.ts:226-237
let decryptionLevel = -1;
for (let i = 0; i < senderCP.length; i++) {
  const copathNode = senderCP[i];
  if (this.isInSubtree(myNode, copathNode)) {
    decryptionLevel = i;
    break;
  }
}

if (decryptionLevel === -1) {
  throw new TreeKEMError('Cannot find decryption point in UpdatePath');
}
```

For the REAL commitJson path with a proper UpdatePath from the creator's addMember commit, `decryptionLevel` WILL be found because the creator encrypted path secrets to leaf 1's copath. The problem is that the `catch` block prevents the real path from working by swallowing legitimate crypto errors (like a stale welcome or wrong key) AND also by falling through to a guaranteed-fail synthetic path.

**Fix option A (recommended):** Remove the try/catch — let commitJson failures propagate. The synthetic fallback is now dead code for any group with a valid commit in the DB.

**Fix option B:** Keep try/catch but do NOT fall through — re-throw. The caller (`joinGroupTree`) can show a specific error to the user.

**Fix option C:** Keep try/catch but return early with a special error code instead of falling to synthetic path.

Recommendation: **Fix option A** — remove try/catch entirely in the commitJson path. The synthetic fallback exists for groups without commitJson (NULL in DB). When commitJson is present, it should either succeed or propagate the real error.

```typescript
// Source: packages/client/src/treekem-manager.ts lines 88-115
// BEFORE (problematic):
if (commitJson) {
  try {
    const commit: Commit = JSON.parse(commitJson);
    const welcome: Welcome = { ... };
    const group = await MLSGroup.joinFromWelcome(welcome, myKeyPair, this.cipher);
    this.groups.set(groupId, group);
    return;
  } catch {
    // PROBLEM: swallows real errors and falls to synthetic path
  }
}

// AFTER (fixed):
if (commitJson) {
  const commit: Commit = JSON.parse(commitJson);
  const welcome: Welcome = {
    groupId,
    epoch: commit.newEpoch,
    treeData: treeDataJson,
    commit,
    leafIndex: myLeafIndex,
    groupContext: {
      groupId,
      epoch: commit.newEpoch,
      treeHash: '',
      transcriptHash: commit.transcriptHash,
    },
  };
  const group = await MLSGroup.joinFromWelcome(welcome, myKeyPair, this.cipher);
  this.groups.set(groupId, group);
  return;
  // No catch — let errors propagate to caller (handleResync) which shows user feedback
}
// Synthetic fallback only reached when commitJson is falsy (null/undefined)
```

### Pattern 2: REQ-6.2 — D1 Read-Replica Lag on 403

**What:** After `POST /api/invites/:code/accept` inserts the new member row, the client immediately calls `GET /api/groups/:id/members` and `GET /api/groups/:id/messages`. Both check `group_members` for membership. If the read hits a D1 replica that hasn't propagated the write yet, the membership check returns 0 rows → 403.

**Why tree-state doesn't 403:** `joinGroupTree` is called from the invite page with a `Promise.race([joinGroupTree(result.groupId), timeout(5000)])`. The navigation to `/chat/:groupId` happens AFTER this completes (at minimum the timeout). By the time the chat page loads and fetches members/messages, enough time has passed for D1 to replicate.

**Confirmed by code inspection:** All three endpoints use identical membership check:
```typescript
// Source: packages/server/src/routes/groups.ts
const membership = await db.query<{ id: string }>(
  'SELECT id FROM group_members WHERE group_id = ? AND user_id = ?',
  [groupId, user.id],
);
if (membership.length === 0) {
  return c.json({ error: 'Not a member of this group' }, 403);
}
```

**Fix options:**

Option A (recommended): Add retry logic client-side — if members/messages returns 403 immediately after invite-accept, retry up to 3 times with exponential backoff. This is the correct pattern for eventual-consistency systems.

Option B: On the server, in `GET /members` and `GET /messages`, return 202 with empty data instead of 403 if the group exists but the user is not (yet) a member. Drawback: breaks security contract — non-members get data.

Option C: Use React Query's `retry` option for the members and messages queries.

Recommendation: **Option C** — leverage React Query's built-in retry for membership-related 403 errors. Both `useMembers` and `useMessages` use React Query. Set `retry: (count, error) => count < 3 && error.message.includes('403')` or similar.

**Current useMessages / useMembers pattern:**
```typescript
// The queries use React Query. React Query default retry is 3 times for all errors.
// The issue is that 403 IS retried but React Query's default exponential backoff
// (1s, 2s, 4s) may be long enough to show the error before success.
// Check if React Query retries 403 by default — it does retry ALL errors by default.
```

Actually, React Query retries ALL errors by default (3 times). The 403 might be resolved by the time the 3rd retry fires. The symptom "403 for newly joined members" suggests the retries aren't configured or the retry delay exceeds the user's patience. The fix is to ensure `useMessages` and `useMembers` retry on 403 with a short delay.

### Pattern 3: REQ-6.3 — Epoch-0 Key Guard

**What:** The synthetic Welcome fallback in `joinGroup` creates:
```typescript
// Source: packages/client/src/treekem-manager.ts lines 117-168
const welcome: Welcome = {
  epoch: 0,   // <-- epoch 0 is the uninitialised state
  ...
};
const group = await MLSGroup.joinFromWelcome(welcome, myKeyPair, this.cipher);
```

`MLSGroup.joinFromWelcome` (mls-group.ts line 146):
```typescript
await cipher.deriveGroupKey(groupId, welcome.epoch, groupSecret);
// welcome.epoch = 0 → stores a key at epoch 0
```

`GroupCipher.deriveGroupKey` (group-cipher.ts lines 56–86) runs HKDF and then:
```typescript
await this.keyStore.storeKey(groupId, epoch, rawKey);
// epoch = 0 → IndexedDB record: "groupId:0" = [garbage AES key from empty tree secret]
```

Later, if a message with `epoch: 0` arrives (sent before TreeKEM was initialized), `cipher.decrypt` calls `getKey(groupId, 0)` which finds this garbage key and tries to decrypt → produces garbage or fails with AES-GCM auth tag error.

**Fix in GroupCipher.deriveGroupKey:**
```typescript
// Source: packages/crypto/src/group-cipher.ts
async deriveGroupKey(
  groupId: GroupId,
  epoch: number,
  sharedSecret: Uint8Array,
): Promise<Uint8Array> {
  // Guard: epoch 0 is the uninitialised state — never store a key there
  if (epoch === 0) {
    throw new GroupCipherError(
      'Cannot derive key at epoch 0: epoch 0 is the uninitialised state',
    );
  }
  // ... existing HKDF logic
}
```

**Additional guard in joinGroup synthetic path:** The synthetic fallback should not call `MLSGroup.joinFromWelcome` with epoch=0 at all (since it would now throw). Instead, the synthetic path should construct a minimal MLSGroup WITHOUT calling `cipher.deriveGroupKey`. Since the synthetic path is only used for pre-migration groups without commitJson, and those groups have the creator at leaf 0 with no other members, the key should be derived from the real epoch during the first `processCommit`.

**Alternative approach:** Keep the synthetic path but skip key derivation at epoch 0. The `MLSGroup.joinFromWelcome` could be modified to skip key derivation when `welcome.epoch === 0`. This is more contained.

Recommendation: Add the guard in `GroupCipher.deriveGroupKey` (throws on epoch=0). This is the safest defense-in-depth approach. Then update the synthetic Welcome in `joinGroup` to use `epoch: 1` with a matching `newEpoch: 1` in the commit — but this produces a meaningless key at epoch 1. Better: remove the `deriveGroupKey` call entirely from the synthetic path by making `MLSGroup.joinFromWelcome` optionally skip key derivation.

Simplest correct fix: Guard in `GroupCipher.deriveGroupKey` to throw on epoch=0, then update the synthetic Welcome in `joinGroup` to pass `epoch: 1` (matching the actual first valid epoch). This ensures the synthetic group starts at epoch 1 and is compatible with `processCommit` calls from epoch 1.

Wait — the synthetic path is a dead path for groups WITH commitJson. For groups WITHOUT commitJson (pre-migration owners), they ARE the committer at epoch 1 already. Their tree has epoch 1. The synthetic welcome with `epoch: 0` is wrong — it should match the server epoch. But the server epoch is not known in the synthetic path. The cleanest fix is:

**Best fix for REQ-6.3:** Add guard in `GroupCipher.deriveGroupKey` that refuses epoch=0 with a clear error. The synthetic Welcome then fails at key derivation, which is fine because: (a) owners already have their own key from `initGroup`, (b) non-owners should use the commitJson path. The synthetic path is purely a backward compatibility shim that should not store keys.

### Pattern 4: REQ-6.4 — 404 Tree-State Handling

**Current state:** `client.getTreeState(groupId)` returns `null` on 404. `joinGroupTree` has:
```typescript
// Source: apps/web/hooks/useTreeKEM.ts lines 147-148
const treeState = await client.getTreeState(groupId);
if (!treeState) return;  // ← already handles 404 gracefully
```

This is already correct — the function returns without throwing, `hasTree(groupId)` remains false, and `useTreeKEMAutoInit` just sees the promise resolve (no throw). The UI does NOT break.

**Remaining concern:** Does `client.getTreeState` actually return null on 404? Let's verify this in the client:

```typescript
// Need to inspect packages/client/src/client.ts getTreeState implementation
// to confirm 404 → null behavior
```

**Action for planner:** Include a task to verify `client.getTreeState` returns null on 404 (not throws). If it throws, add a 404 catch. This is a verification task, not necessarily a code change.

### Pattern 5: REQ-6.5 — Post-Resync UI Refresh

**Current handleResync (page.tsx lines 512-535):**
```typescript
// Source: apps/web/app/(chat)/chat/[groupId]/page.tsx:512
async function handleResync() {
  if (!groupId || encryptionSyncing) return;
  setEncryptionSyncing(true);
  setResyncFailed(false);
  try {
    treekemManager.clearTree(groupId as GroupId);
    await joinGroupTree(groupId as GroupId);
    const joinedEpoch = treekemManager.getEpoch(groupId as GroupId);
    if (treekemManager.hasTree(groupId as GroupId) && joinedEpoch === 0) {
      setResyncFailed(true);
    }
  } catch (err) {
    console.error('[TreeKEM] Resync failed:', err);
    setResyncFailed(true);
  } finally {
    setEncryptionSyncing(false);
    refetch();  // ← refetches messages, but NOT members, and NOT treeEpochs
  }
}
```

**Problem:** After a successful resync:
1. `treeEpochs[groupId]` in Zustand is NOT updated — the send path checks `treekemManager.getEpoch()` directly, but the UI `encryptionEpoch` variable reads from `treeEpochs`. If `treeEpochs` shows 0, the UI may still show "encryption not ready" even though the tree is now at epoch N.
2. `useMembers` is not refetched — if the resync succeeded, members might have changed.
3. `refetch()` only refreshes the messages query. The message list may be stale.

**Fix:** After successful resync (before `setEncryptionSyncing(false)`), call `setTreeEpoch(groupId, treekemManager.getEpoch(groupId))` to update Zustand. Also call `queryClient.invalidateQueries(messagesQueryKey(groupId))` for messages (already done via `refetch()`), and `queryClient.invalidateQueries(['members', groupId])` for members.

```typescript
// After successful joinGroupTree:
const newEpoch = treekemManager.getEpoch(groupId as GroupId);
if (treekemManager.hasTree(groupId as GroupId) && newEpoch === 0) {
  setResyncFailed(true);
} else {
  // Update Zustand treeEpochs so UI reflects new encryption state
  setTreeEpoch(groupId as GroupId, newEpoch);
}
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| D1 retry on 403 | Custom retry loop | React Query `retry` option | React Query already retries; configure per-query, not globally |
| Epoch-0 key guard | Runtime checks scattered everywhere | Guard at the derivation point (`GroupCipher.deriveGroupKey`) | Single source of truth — prevents epoch-0 keys from ever being stored |
| Post-resync state sync | Custom event system | Zustand `setTreeEpoch` + React Query `invalidateQueries` | Both already exist in project |

**Key insight:** All required primitives exist. This phase is purely about removing incorrect behavior (swallowed exceptions, unguarded epoch-0 key storage, missing state updates) rather than adding new capabilities.

---

## Common Pitfalls

### Pitfall 1: Removing the Catch but Not Understanding Why commitJson Fails

**What goes wrong:** Developer removes the try/catch in `joinGroup` and the error still throws — "Cannot find decryption point in UpdatePath" — because the real root cause was a stale private key (user regenerated identity key) or a commitJson from a different member's commit.
**Why it happens:** The commitJson path reconstructs a Welcome and calls `processUpdatePath`. If the commit's `encryptedPathSecrets` were encrypted for the user's OLD public key, but the user has a NEW identity key (different from what was in the tree at commit time), ECDH derivation will produce the wrong shared secret → decryptPathSecret will fail → TreeKEMError.
**How to avoid:** After removing the catch, document that "Cannot find decryption point" from `joinGroup` means the commitJson is stale relative to the user's current identity key. The UI should show "Re-invite required" rather than "Resync failed".
**Warning signs:** Error still appears after the fix → user rotated identity key → must re-invite.

### Pitfall 2: Epoch-0 Guard Breaks the Owner's initGroup Flow

**What goes wrong:** Adding a guard `if (epoch === 0) throw` in `GroupCipher.deriveGroupKey` breaks `MLSGroup.create()` if it tries to call `deriveGroupKey` at epoch 0.
**Why it happens:** Looking at `MLSGroup.create` (mls-group.ts lines 91–116): it uses `newEpoch = 1`, calls `cipher.deriveGroupKey(groupId, newEpoch, groupSecret)` with `newEpoch = 1`. So the creator never stores at epoch 0 — only the synthetic fallback does. The guard is safe.
**How to avoid:** Verify all call sites of `deriveGroupKey` use epoch >= 1. There are 3 call sites: `MLSGroup.create` (epoch 1), `MLSGroup.joinFromWelcome` (welcome.epoch which comes from commit.newEpoch, always >= 1 for real commits), `MLSGroup.processCommit` (commit.newEpoch, always >= 1). The synthetic Welcome with `epoch: 0` is the only epoch-0 call site.
**Warning signs:** TypeScript compiles but `initGroup` throws at runtime → check `MLSGroup.create` epoch value.

### Pitfall 3: D1 Retry on 403 Hides Real Authorization Bugs

**What goes wrong:** Adding `retry: 3` for 403 errors means real authorization failures (non-member trying to access a group) also get retried, masking the error for 3x the time.
**Why it happens:** React Query's retry applies to all errors matching the predicate.
**How to avoid:** Only retry 403 in a narrow context — e.g., only in the first N seconds after invite acceptance. Alternatively, use a query option that only retries on the first render of the chat page after invite acceptance (detect via router state or a flag).
**Warning signs:** Non-member sees a delayed 403 after 3 retries instead of immediate feedback.

### Pitfall 4: setTreeEpoch in handleResync Called Before hasTree Check

**What goes wrong:** Calling `setTreeEpoch(groupId, treekemManager.getEpoch(groupId))` before verifying `treekemManager.hasTree(groupId)` — if `joinGroupTree` returned early (no tree state on server), `getEpoch` returns 0 and Zustand is set to 0.
**Why it happens:** `joinGroupTree` returns without setting the tree if `treeState` is null (404). After the call, `hasTree` is false and `getEpoch` returns 0.
**How to avoid:** Only call `setTreeEpoch` when `treekemManager.hasTree(groupId)` is true AND the epoch is > 0.

### Pitfall 5: The Synthetic Fallback Is Still Needed

**What goes wrong:** Developer removes the entire synthetic fallback from `joinGroup`, breaking groups that were created before Phase 5 migration (no `commit_json` in DB).
**Why it happens:** Assuming all groups have commitJson after Phase 5.
**How to avoid:** The synthetic path is only reached when `commitJson` is falsy. It must remain. Only the try/catch AROUND the commitJson path should be removed.

---

## Code Examples

### REQ-6.1: Fixed joinGroup (remove try/catch around commitJson path)

```typescript
// Source: packages/client/src/treekem-manager.ts
// Replace lines 88-114 with:
async joinGroup(
  groupId: GroupId,
  treeDataJson: string,
  myLeafIndex: LeafIndex,
  myKeyPair: ECKeyPair,
  commitJson?: string,
): Promise<void> {
  if (commitJson) {
    // Real recovery path: reconstruct Welcome from server-persisted Commit.
    // No catch — if the commit's UpdatePath cannot be decrypted with our current
    // identity key, it means the key was rotated and re-invite is required.
    const commit: Commit = JSON.parse(commitJson);
    const welcome: Welcome = {
      groupId,
      epoch: commit.newEpoch,
      treeData: treeDataJson,
      commit,
      leafIndex: myLeafIndex,
      groupContext: {
        groupId,
        epoch: commit.newEpoch,
        treeHash: '',
        transcriptHash: commit.transcriptHash,
      },
    };
    const group = await MLSGroup.joinFromWelcome(welcome, myKeyPair, this.cipher);
    this.groups.set(groupId, group);
    return;
  }
  // Synthetic fallback — only reached when server has no commitJson (pre-migration groups)
  // ... (existing synthetic path unchanged)
}
```

### REQ-6.3: Epoch-0 Guard in GroupCipher

```typescript
// Source: packages/crypto/src/group-cipher.ts
// Add at the top of deriveGroupKey method:
async deriveGroupKey(
  groupId: GroupId,
  epoch: number,
  sharedSecret: Uint8Array,
): Promise<Uint8Array> {
  if (epoch === 0) {
    throw new GroupCipherError(
      'Cannot derive key at epoch 0: epoch 0 is the uninitialised state. ' +
      'Check that MLSGroup.create() or joinFromWelcome() is called with epoch >= 1.',
    );
  }
  // ... existing HKDF logic unchanged
}
```

### REQ-6.5: Post-Resync Epoch State Update

```typescript
// Source: apps/web/app/(chat)/chat/[groupId]/page.tsx
// Destructure setTreeEpoch from useChatClientStore (already available in component)
const setTreeEpoch = useChatClientStore((state) => state.setTreeEpoch);

async function handleResync() {
  if (!groupId || encryptionSyncing) return;
  setEncryptionSyncing(true);
  setResyncFailed(false);
  try {
    treekemManager.clearTree(groupId as GroupId);
    await joinGroupTree(groupId as GroupId);
    const joinedEpoch = treekemManager.getEpoch(groupId as GroupId);
    if (treekemManager.hasTree(groupId as GroupId) && joinedEpoch === 0) {
      setResyncFailed(true);
    } else if (treekemManager.hasTree(groupId as GroupId)) {
      // Update Zustand so UI encryptionEpoch reflects new state
      setTreeEpoch(groupId as GroupId, joinedEpoch);
    }
  } catch (err) {
    console.error('[TreeKEM] Resync failed:', err);
    setResyncFailed(true);
  } finally {
    setEncryptionSyncing(false);
    refetch();
    queryClient.invalidateQueries({ queryKey: ['members', groupId] });
  }
}
```

### REQ-6.2: React Query Retry for Post-Invite 403

```typescript
// Source: apps/web/hooks/useMessages.ts and useMembers.ts
// Add retry option that handles D1 replication lag:
useQuery({
  queryKey: messagesQueryKey(groupId),
  queryFn: () => client.getMessages(groupId),
  retry: (failureCount, error) => {
    // Retry up to 3 times on 403 (D1 replication lag after invite-accept)
    if (failureCount < 3 && error?.message?.includes('403')) return true;
    return false;
  },
  retryDelay: (attemptIndex) => Math.min(500 * 2 ** attemptIndex, 3000),
});
```

---

## Root Cause Analysis (Specific Questions from Brief)

### Q1: Does leaf_index COUNT query give correct leafIndex=1 for second member?

**Answer: YES — but with a subtle correctness constraint.** (HIGH confidence)

```typescript
// Source: packages/server/src/routes/groups.ts:274-279
const memberCountRows = await db.query<{ count: number }>(
  'SELECT COUNT(*) as count FROM group_members WHERE group_id = ?',
  [invite.group_id],
);
const leafIndex = memberCountRows[0]?.count ?? 0;
```

For a group with one member (the creator), COUNT returns 1. The new joiner gets `leafIndex = 1`. This is correct: creator is leaf 0 (inserted WITHOUT leaf_index at POST /api/groups), new member is leaf 1. The COUNT-before-INSERT pattern gives the 0-based index. **Constraint:** This is only correct if invite codes are single-use (enforced by `UPDATE invites SET used = 1`) and there are no concurrent accepts. The existing `if (existingMembership.length > 0) return 400` prevents double-joins.

### Q2: Why does 403 occur on members/messages but NOT on tree-state?

**Answer: Timing/D1 replication lag.** (MEDIUM confidence — cannot inspect Cloudflare D1 internals, but the pattern matches)

All three endpoints use identical membership SQL. The tree-state endpoint is called AFTER `joinGroupTree`, which is wrapped in a `Promise.race` with 5s timeout. By the time the user navigates to `/chat/:groupId`, at minimum several hundred milliseconds have passed. Members/messages are fetched by React Query on initial mount of the chat page — immediately after navigation, which is immediately after the 5s race. If tree-state is called at T+0 and members/messages at T+5000ms, D1 has had 5 seconds to propagate the write.

Wait — re-reading the invite page: `joinGroupTree` is called in a `Promise.race` with 5s timeout. The function itself will call `getTreeState` which takes network time. The `router.replace` happens AFTER the race. So navigation to chat happens after at minimum `getTreeState` response time (~100-500ms). But members/messages are still fetched immediately on mount. A 5 second race means navigation could happen at T+5s if `joinGroupTree` takes that long. The 403 suggests it's happening at T < 1s.

The correct explanation: after `acceptInvite.mutateAsync` returns, the invite-page calls `joinGroupTree` concurrently (in the `run` async function). `joinGroupTree` calls `getTreeState` which reads from `group_members` — this read might also 403. But the existing `joinGroupTree` has `if (!treeState) return` for 404, not for 403. Actually `getTreeState` hits the tree-state endpoint which also checks membership — if it 403s, `getTreeState` would throw. Looking at the invite page, if `joinGroupTree` throws/times out, `setState('success')` and `router.replace` still happen. So navigation occurs whether or not tree-state succeeded.

**Revised explanation:** The invite-accept response triggers concurrent navigation and queries. Members/messages hit D1 read replicas before the write propagates. The fix is React Query retry.

### Q3: Is commit_json stored at invite-accept the correct commit for reconstruction?

**Answer: NO — commit_json is stored at tree-update time, not invite-accept time.** (HIGH confidence)

The `commit_json` in `group_tree_state` is stored when the GROUP CREATOR posts a tree-update (their addMember commit). This happens AFTER the new member accepts the invite. The sequence is:
1. New member accepts invite → `group_members` INSERT
2. Server broadcasts `memberJoined` event to existing members
3. Existing member (creator) receives `memberJoined` via WebSocket → calls `addMemberToTree` → posts tree-update
4. Server stores `commit_json` from creator's addMember commit

So `commit_json` is the creator's addMember commit, which IS the correct commit for the new member's Welcome reconstruction. The `encryptedPathSecrets` in this commit ARE encrypted for the new member's public key (stored at their leaf in the tree). This should work correctly.

**Potential staleness issue:** If multiple members are added and the creator posts multiple commits, only the LAST commit_json is stored (upsert on conflict). A member who joined several commits ago may have a commit_json from a more recent commit that doesn't include their path secrets. This is the "missed commits" scenario — out of scope for Phase 6.

### Q4: What happens with treeState.welcome present vs absent?

**Current joinGroupTree flow (useTreeKEM.ts lines 150-167):**

```typescript
if (treeState.welcome) {
  try {
    await treekemManager.joinFromWelcome(groupId, treeState.welcome, keyPair);
    setTreeEpoch(groupId, treekemManager.getEpoch(groupId));
    return;
  } catch {
    // Welcome decryption failed — fall through to joinGroup
  }
}

await treekemManager.joinGroup(
  groupId,
  treeState.treeData,
  treeState.leafIndex ?? 0,
  keyPair,
  treeState.commitJson,
);
```

The `treeState.welcome` is a one-time Welcome stored in `pending_welcomes` and deleted on first read. If the creator posted the tree-update (with Welcome) AND the new member's `getTreeState` fetches it, `treeState.welcome` is present and should be the CORRECT Welcome (encrypted for the member's exact public key at exactly the right epoch).

**The welcome path is NOT broken** — it uses `treekemManager.joinFromWelcome` which takes the serialized welcome JSON. This Welcome was generated by `MLSGroup.commit` and contains correctly encrypted path secrets for the new member.

**The fallback to joinGroup happens when:**
- `treeState.welcome` is absent (already consumed, or creator hadn't posted tree-update yet)
- `treeState.welcome` is present but `joinFromWelcome` throws (stale welcome, wrong key)

The second case is the problematic one — if the welcome decryption fails and falls through to `joinGroup` with `commitJson`, the `commitJson` path's try/catch then also fails, and the synthetic path is reached. Fix REQ-6.1 (removing try/catch) prevents the double-fallback.

### Q5: What does the epoch-0 key store path do?

**Answer:** The synthetic Welcome in `joinGroup` (lines 117-170 of treekem-manager.ts) creates a Welcome with `epoch: 0` and a commit with `newEpoch: 0`. `MLSGroup.joinFromWelcome` (mls-group.ts line 146) calls `cipher.deriveGroupKey(groupId, welcome.epoch, groupSecret)` — storing a key at epoch 0. This key is derived from the tree's root secret AFTER processing an empty UpdatePath. The root secret comes from `treekem.deriveGroupSecret()` which reads the root node's `pathSecret`. After `processUpdatePath` with an empty path (`pathPublicKeys: []`), the root node's pathSecret is NULL → `deriveGroupSecret` would throw `TreeKEMInvalidStateError: Root node has no path secret`. Wait — actually with the empty updatePath the root's pathSecret is not set by processUpdatePath. But wait, with an empty UpdatePath (`sender:0, pathPublicKeys:[], encryptedPathSecrets:[[]]`), `processUpdatePath` finds `decryptionLevel = -1` for a 2-member tree (or handles the single-member edge case) and would throw.

**Actually for the synthetic path:** The code at lines 143-170 does NOT process the updatePath through normal `joinFromWelcome`. It first deserializes the tree and injects the key, then calls `MLSGroup.joinFromWelcome` with the synthetic Welcome which processes the empty updatePath. For a 2-member tree (creator + new member), `senderCP` for sender=0 would be [node 2 (leaf 1)]. `isInSubtree(myNode=2, copathNode=2)` is true for the new member at leaf 1. `decryptionLevel = 0`. `encryptedSecrets = encryptedPathSecrets[1]` = `[]` (empty because pathPublicKeys is empty). `findMyTargetNode` returns null → throws `TreeKEMError: No encrypted path secret found for our node`.

So the synthetic path THROWS rather than storing a key at epoch 0. The epoch-0 key storage bug might actually be in a DIFFERENT path than expected. Let me reconsider.

**Actually the epoch-0 key is stored by the SINGLE-MEMBER case:** When the creator initializes with `MLSGroup.create`, the tree is 1-member. `update()` for single member returns an UpdatePath with `pathPublicKeys: [newLeafKey.publicKey]` and `encryptedPathSecrets: [[]]`. `processUpdatePath` for single member: `senderDP` is empty (no parents), so the loop over `senderCP` doesn't run, `decryptionLevel = -1`, throw. Wait, but `MLSGroup.create` doesn't call `joinFromWelcome` — it uses `MLSGroup.create` which sets up the tree directly.

**Revised epoch-0 analysis:** The epoch-0 key issue from MEMORY.md says "epoch=0 passed to cipher.encrypt throws GroupCipherError (no key stored at epoch 0)". This matches the SEND path guard. The epoch-0 KEY STORE issue is: the synthetic fallback fallback creates a Welcome with `epoch: 0`, then if `joinFromWelcome` somehow succeeds (single-member tree), it calls `deriveGroupKey(groupId, 0, ...)`. For a 1-member group, `processUpdatePath` with `sender:0, pathPublicKeys:[], encryptedPathSecrets:[[]]` would proceed: `senderDP = []` (root IS the leaf for 1-member tree), no `senderCP` to iterate, `decryptionLevel = -1`. Wait, but for 1-member `numLeaves=1`, `senderDP = directPath(0, 1)` which for a 1-node tree should be empty. The loop doesn't run, `decryptionLevel = -1`, throws.

So actually the synthetic path ALWAYS throws for multi-member trees and ALSO throws for single-member trees via the empty UpdatePath. The `deriveGroupKey` at epoch 0 may never actually be reached. The REQ-6.3 guard is still valuable as defense-in-depth to prevent future regressions, even if the current code doesn't reach it.

**The real epoch-0 issue** from the ROADMAP may be: when `treekemManager.getEpoch(groupId)` returns 0 (because `joinFromWelcome` threw and the group was never set in the groups Map), `handleSendMessage` computes `epoch = rawEpoch > 0 ? rawEpoch : undefined`. So send uses `undefined` epoch → server stores `epoch: 0`. On the receive side, the message has `epoch: 0`, and `cipher.decrypt` calls `getKey(groupId, 0)` → returns null → throws `GroupCipherError: No key found for group X epoch 0`. This is NOT a key storage issue — it's that the message is stored with epoch 0 because encryption was bypassed. The REQ-6.3 guard at the SEND level is already implemented (`rawEpoch > 0`). REQ-6.3 may also require NOT sending with epoch=undefined when encryption should be active (fail the send instead of silently downgrading to plaintext).

---

## State of the Art

| Old Behavior | New Behavior | Phase | Impact |
|---|---|---|---|
| `joinGroup` try/catch swallows commitJson failures silently | commitJson failures propagate to caller | Phase 6 | handleResync shows specific error; UI can guide user to re-invite |
| Synthetic Welcome has epoch=0; may store garbage key at epoch 0 | `deriveGroupKey` throws on epoch=0 | Phase 6 | No garbage keys at epoch 0; IndexedDB stays clean |
| 403 on members/messages for newly joined members (D1 lag) | React Query retries on 403 with backoff | Phase 6 | Members see their messages after invite-accept |
| handleResync doesn't update treeEpochs Zustand state | setTreeEpoch called after successful resync | Phase 6 | UI shows correct encryption state after resync |

---

## Open Questions

1. **Does `client.getTreeState` return null on 404, or throw?**
   - What we know: `joinGroupTree` has `if (!treeState) return` suggesting it expects null for 404
   - What's unclear: Not verified — need to read `packages/client/src/client.ts` getTreeState implementation
   - Recommendation: Planner should include a task to read `client.ts` getTreeState and confirm 404 → null (not throw); add catch if needed

2. **Does the Welcome path (`treeState.welcome`) actually fail for newly invited members?**
   - What we know: The welcome is stored in `pending_welcomes` by the creator's tree-update. It's consumed on first `getTreeState`. The timing depends on whether the creator processed `memberJoined` and posted the tree-update before the new member calls `getTreeState`.
   - What's unclear: If the new member calls `getTreeState` before the creator posts the tree-update (race condition), `treeState.welcome` is absent → falls to commitJson path. This may be the common case.
   - Recommendation: The commitJson path fix (REQ-6.1) covers this case.

3. **Is the `handleResync` refetch + invalidation sufficient to show new messages?**
   - What we know: `refetch()` in `useMessages` re-fetches from server. After resync, the member can decrypt new messages (epoch N key now available).
   - What's unclear: Whether existing undecrypted messages in the React Query cache need to be re-processed through the cipher. The cache has `encryptedPayload` + `nonce` + `epoch` — these are the raw server values, not decrypted. Decryption happens in the message rendering component (or the useMessages transform). If decryption is done at render time, a refetch + re-render after resync will automatically decrypt with the new key.
   - Recommendation: Planner should check where decryption happens — in `useMessages` queryFn, or in the rendering component. If in queryFn, `refetch()` is sufficient. If in render, just re-render (no refetch needed).

---

## Manual Testing Steps

Per CLAUDE.md — provide steps for manual testing where applicable.

### Testing REQ-6.1 (processUpdatePath fix)

1. Start dev server (`wrangler dev`)
2. Register Alice and Bob in two separate browser windows
3. Alice creates a group and initializes TreeKEM
4. Alice invites Bob; Bob accepts
5. Wait for Alice to post tree-update (observable in Network tab as POST /tree-update)
6. In Alice's browser, send an encrypted message (epoch > 0)
7. Reload Bob's browser tab
8. Observe: Bob's `useTreeKEMAutoInit` calls `joinGroupTree` → `getTreeState` → `joinGroup` with commitJson
9. Expected: No "Cannot find decryption point" error in Bob's console; Bob can read Alice's message
10. Trigger resync via Alice's "Resync encryption" button (after clearing Alice's tree in devtools)
11. Expected: Resync succeeds (no catch swallowing); `encryptionSyncing` returns to false; Alice can send again

### Testing REQ-6.2 (403 fix)

1. Register a new user (Charlie) in a fresh browser
2. Alice creates a group and invites Charlie
3. Immediately after Charlie accepts the invite, open DevTools Network tab
4. Observe: `GET /api/groups/:id/members` and `GET /api/groups/:id/messages` may initially return 403
5. Expected: React Query retries automatically; within 3 seconds, members and messages load correctly
6. Verify: No persistent 403 errors; Charlie sees the group members list and message history

### Testing REQ-6.3 (epoch-0 guard)

1. In browser devtools console: `treekemManager.cipher.deriveGroupKey('test-group', 0, new Uint8Array(32))`
2. Expected: Throws `GroupCipherError: Cannot derive key at epoch 0`
3. Verify: Check IndexedDB in Application tab — no entry with key `test-group:0`
4. Verify: Sending a message when epoch is 0 uses `undefined` epoch (no encryption); message is stored with `epoch: 0` on server; other members see it as unencrypted message (lock icon)

### Testing REQ-6.4 (404 tree-state grace)

1. Create a group but do NOT initialize TreeKEM (skip `initGroupTree`)
2. As a second user, join the group
3. Second user calls `getTreeState` → server returns 404 (no tree state)
4. Expected: No error thrown, no broken UI state; the group chat loads without encryption error

### Testing REQ-6.5 (post-resync UI refresh)

1. Alice and Bob are in an encrypted group (epoch N)
2. Bob's tree state diverges (simulate by clearing Bob's in-memory tree via devtools)
3. Bob clicks "Resync encryption" button in the send-failure banner
4. Expected after resync:
   - `encryptionSyncing` returns to false (button disappears)
   - `treeEpochs[groupId]` in Zustand shows epoch N (not 0)
   - Message list refreshes and shows decrypted messages
   - Bob can send a new message without page reload

---

## Sources

### Primary (HIGH confidence)

- Direct code inspection: `packages/crypto/src/treekem.ts` — `processUpdatePath` lines 195–276
- Direct code inspection: `packages/crypto/src/mls-group.ts` — `joinFromWelcome` lines 123–156, `create` lines 66–117
- Direct code inspection: `packages/client/src/treekem-manager.ts` — `joinGroup` lines 81–171, `clearTree` lines 311–313
- Direct code inspection: `packages/crypto/src/group-cipher.ts` — `deriveGroupKey` lines 56–86
- Direct code inspection: `packages/crypto/src/indexeddb-key-store.ts` — `storeKey`, `deleteAllGroupKeys`
- Direct code inspection: `packages/server/src/routes/groups.ts` — membership check pattern, all endpoints
- Direct code inspection: `apps/web/hooks/useTreeKEM.ts` — `joinGroupTree` lines 132–170
- Direct code inspection: `apps/web/app/(chat)/chat/[groupId]/page.tsx` — `handleResync` lines 512–535
- Direct code inspection: `apps/web/app/invite/[code]/page.tsx` — invite accept + joinGroupTree flow
- Direct code inspection: `apps/web/hooks/useTreeKEMAutoInit.ts` — auto-init on mount

### Secondary (MEDIUM confidence)

- Cloudflare D1 documentation pattern: Read-replica eventual consistency — multiple sources confirm D1 uses read replicas that may lag behind writes by up to several seconds. The membership query pattern matches this known behavior.
- React Query retry behavior: `retry: 3` is the default for all errors; `retryDelay` defaults to exponential backoff starting at 1s. Source: TanStack Query documentation (training knowledge, requires verification if behavior changed).

### Tertiary (LOW confidence — flag for validation)

- None required for this phase.

---

## Metadata

**Confidence breakdown:**
- Root cause analysis (REQ-6.1, 6.3): HIGH — derived from direct line-by-line code inspection of all relevant files
- Root cause analysis (REQ-6.2): MEDIUM — D1 replication lag inferred from behavioral pattern, cannot inspect D1 internals
- Root cause analysis (REQ-6.4): HIGH — `if (!treeState) return` is clearly in the code
- Root cause analysis (REQ-6.5): HIGH — `setTreeEpoch` is missing from `handleResync`, verified by reading page.tsx
- Fix strategies: HIGH — all fixes are internal to project code, no external API changes

**Research date:** 2026-02-28
**Valid until:** 2026-03-28 (stable internal codebase; valid until someone modifies the files above)
