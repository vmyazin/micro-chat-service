# Phase 4: TreeKEM UI Integration - Research

**Researched:** 2026-02-27
**Domain:** React async crypto lifecycle, TreeKEM epoch state management, group key protocol wiring
**Confidence:** HIGH — based on direct code inspection of all integration points

---

## Summary

**What is actually done vs what is actually missing — this is the central finding of this research.**

After reading all integration points directly, the roadmap success criteria (the four bullet points) are all nominally implemented as of commit `51a141a`. Quick Task 1 fixed epoch-0 for voice/image sends. `useWebSocket` already dispatches `treeUpdate` to `handleTreeUpdate`. `NewGroupDialog` calls `initGroupTree` after creation. The invite page calls `joinGroupTree` after accepting. The auto-join path in `page.tsx` does not call `joinGroupTree` (gap).

However, three quality-critical gaps remain that don't prevent compilation but cause silent failures in production:

1. **Fire-and-forget tree init**: Both `NewGroupDialog` and the invite page call `initGroupTree`/`joinGroupTree` as `.catch(console.error)` without awaiting. They navigate immediately. If tree init takes longer than navigation (it involves crypto key generation + a network request), the user sends their first message with epoch 0.

2. **MemoryKeyStore for message keys**: `chat-client-store.ts` uses `MemoryKeyStore` for the `messageCipher`. Every page refresh loses all derived group keys. Epoch > 0 messages from the current session cannot be decrypted after reload.

3. **IndexedDBKeyStore does not exist**: The project MEMORY.md mentions it as a target, but inspection of `packages/crypto/src/` confirms no `IndexedDBKeyStore` file exists. Only `MemoryKeyStore` is implemented. Creating `IndexedDBKeyStore` is a prerequisite for fixing gap #2.

**Primary recommendation:** Three tasks in priority order: (1) Create `IndexedDBKeyStore` implementing the `KeyStore` interface with IndexedDB persistence, (2) Switch `chat-client-store.ts` to use it, (3) Await `initGroupTree`/`joinGroupTree` before navigation in `NewGroupDialog` and the invite page.

---

## Current State Audit (HIGH confidence — from direct code inspection)

### Integration Points: What Is and Is Not Done

| Integration Point | File | Status | Issue |
|-------------------|------|--------|-------|
| Text sends pass epoch | `chat/[groupId]/page.tsx:427` | Done | None |
| Voice sends pass epoch | `chat/[groupId]/page.tsx:435` | Done (Quick Task 1) | None |
| Image sends pass epoch | `chat/[groupId]/page.tsx:463` | Done (Quick Task 1) | None |
| `useWebSocket` handles `treeUpdate` | `useWebSocket.ts:123` | Done | `handleTreeUpdate(event).catch(console.error)` — silent failure |
| `NewGroupDialog` calls `initGroupTree` | `NewGroupDialog.tsx:56` | Done but broken | **Fire-and-forget**: `initGroupTree(result.groupId).catch(console.error)` |
| Invite page calls `joinGroupTree` | `invite/[code]/page.tsx:31` | Done but broken | **Fire-and-forget**: races with `router.replace(...)` |
| GroupSettings "Rotate Keys" | `GroupSettings.tsx:122` | Done | Falls back to `initGroupTree` if no tree; works correctly (awaited) |
| `useSendMessage` accepts epoch param | `useSendMessage.ts:18` | Done | None |
| Message keys survive page refresh | `chat-client-store.ts:25` | **NOT done** | `MemoryKeyStore` — keys lost on reload |
| `IndexedDBKeyStore` implementation | `packages/crypto/src/` | **NOT done** | Does not exist — must be created |
| Join after URL-share (direct URL) | `page.tsx:144-151` | Partial | `useJoinGroup.mutate()` — never calls `joinGroupTree` |
| Invite Welcome message wiring | `invite/[code]/page.tsx:31` | **NOT done** | `AcceptInviteResult` has no `welcome` field; always uses legacy fetch path |

### Key Files and Their Roles

```
apps/web/
├── hooks/useTreeKEM.ts              # initGroupTree, joinGroupTree, handleTreeUpdate — API is correct
├── hooks/useWebSocket.ts            # dispatches treeUpdate events — wired, fire-and-forget
├── hooks/useCreateGroup.ts          # does NOT call initGroupTree — correct, NewGroupDialog does it
├── hooks/useAcceptInvite.ts         # does NOT call joinGroupTree — correct, invite page does it
├── hooks/useJoinGroup.ts            # auto-join from error — does NOT call joinGroupTree (gap)
├── components/NewGroupDialog.tsx    # calls initGroupTree fire-and-forget after createGroup (broken)
├── app/invite/[code]/page.tsx       # calls joinGroupTree fire-and-forget before router.replace (broken)
├── app/(chat)/chat/[groupId]/page.tsx  # auto-join on error; sends with epoch from getEpoch()
└── stores/chat-client-store.ts      # MemoryKeyStore for messages — keys not persisted (gap)

packages/crypto/src/
├── key-store.ts       # KeyStore interface (storeKey, getKey, deleteKey, deleteAllGroupKeys)
├── memory-key-store.ts  # only implementation — in-memory, ephemeral
└── [no IndexedDB impl]  # IndexedDBKeyStore does NOT exist — must be created
```

### KeyStore Interface (for IndexedDBKeyStore implementation)

```typescript
// Source: packages/crypto/src/key-store.ts
export interface KeyStore {
  storeKey(groupId: GroupId, epoch: number, key: Uint8Array): Promise<void>;
  getKey(groupId: GroupId, epoch: number): Promise<StoredKey | null>;
  deleteKey(groupId: GroupId, epoch: number): Promise<boolean>;
  deleteAllGroupKeys(groupId: GroupId): Promise<number>;
}

export interface StoredKey {
  key: Uint8Array;
  metadata: KeyMetadata;
}

export interface KeyMetadata {
  groupId: GroupId;
  epoch: number;
  createdAt: Date;
}
```

---

## Standard Stack

No new npm dependencies needed. All required browser APIs are available natively.

### Core (already installed)

| Library | Version | Purpose | Role in Phase |
|---------|---------|---------|---------------|
| `zustand` | existing | Global state (`treekemManager` lives here) | Read `treekemManager` from `useChatClientStore` |
| `@tanstack/react-query` | existing | Mutation lifecycle (`useMutation`) | `onSuccess` callbacks — where tree init belongs |
| `next/navigation` | existing | Router for page transitions | Must await tree init before `router.push/replace` |
| `@microchat/crypto` | existing | `MemoryKeyStore`, `GroupCipher`, `KeyStore` interface | Create `IndexedDBKeyStore` here; switch `messageCipher` |
| `@microchat/client` | existing | `TreeKEMManager`, `MicroChatClient` | No changes to the manager API |

### Browser APIs Required (no npm install)

| API | Purpose | Availability |
|-----|---------|--------------|
| `indexedDB` | Persistent key storage | All modern browsers, Node 20+ (for tests via fake-indexeddb) |
| `crypto.subtle` | Already used throughout | Same as current usage |

### Testing IndexedDB in Vitest

The crypto package uses vitest. IndexedDB is not available in Node.js. Use `fake-indexeddb` for tests:

```bash
pnpm --filter @microchat/crypto add -D fake-indexeddb
```

In the test file:
```typescript
import 'fake-indexeddb/auto'; // polyfills global indexedDB
import { IndexedDBKeyStore } from './indexed-db-key-store';
```

This is the standard pattern for testing IndexedDB code in Node/vitest environments.

---

## Architecture Patterns

### Pattern 1: IndexedDBKeyStore Implementation

**What:** Implement the `KeyStore` interface using `indexedDB` for persistence. Keys survive page refresh, tab close, and browser restart (until explicitly cleared).

**Key design decisions:**
- Store name: `'microchat-message-keys'` (matches MEMORY.md reference)
- Object store name: `'keys'`
- Key path: compound `[groupId, epoch]`
- Value: `{ key: Uint8Array, groupId, epoch, createdAt: ISO string }`
- DB version: `1`

**IndexedDB opening pattern (lazy initialization):**
```typescript
// Source: standard IndexedDB pattern — MDN Web Docs
// packages/crypto/src/indexed-db-key-store.ts
export class IndexedDBKeyStore implements KeyStore {
  private dbPromise: Promise<IDBDatabase> | null = null;

  constructor(private readonly dbName: string = 'microchat-message-keys') {}

  private getDB(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(this.dbName, 1);
        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains('keys')) {
            db.createObjectStore('keys', { keyPath: ['groupId', 'epoch'] });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
    return this.dbPromise;
  }

  async storeKey(groupId: GroupId, epoch: number, key: Uint8Array): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('keys', 'readwrite');
      const store = tx.objectStore('keys');
      store.put({ groupId, epoch, key, createdAt: new Date().toISOString() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getKey(groupId: GroupId, epoch: number): Promise<StoredKey | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('keys', 'readonly');
      const store = tx.objectStore('keys');
      const request = store.get([groupId, epoch]);
      request.onsuccess = () => {
        const record = request.result;
        if (!record) { resolve(null); return; }
        resolve({
          key: record.key,
          metadata: {
            groupId: record.groupId,
            epoch: record.epoch,
            createdAt: new Date(record.createdAt),
          },
        });
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteKey(groupId: GroupId, epoch: number): Promise<boolean> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('keys', 'readwrite');
      const store = tx.objectStore('keys');
      const getReq = store.get([groupId, epoch]);
      getReq.onsuccess = () => {
        if (!getReq.result) { resolve(false); return; }
        store.delete([groupId, epoch]);
        tx.oncomplete = () => resolve(true);
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  async deleteAllGroupKeys(groupId: GroupId): Promise<number> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('keys', 'readwrite');
      const store = tx.objectStore('keys');
      // IndexedDB cursor to delete all entries for a groupId
      let count = 0;
      const request = store.openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          if (cursor.value.groupId === groupId) {
            cursor.delete();
            count++;
          }
          cursor.continue();
        }
      };
      tx.oncomplete = () => resolve(count);
      tx.onerror = () => reject(tx.error);
    });
  }
}
```

**Note on `deleteAllGroupKeys` efficiency:** The cursor scan works but is O(N) across all keys. For this app's scale (small number of groups × small number of epochs), this is acceptable. A compound index on `groupId` would make this O(log N + k) but adds complexity.

### Pattern 2: Await Async Crypto Before Navigation

**What:** Tree init is async (ECDH key generation + HTTP POST). Don't navigate until it completes.

**Current broken pattern (NewGroupDialog.tsx:56):**
```typescript
// WRONG: fire-and-forget before onClose and router.push
initGroupTree(result.groupId).catch(console.error);
setGroupName('');
onGroupCreated?.(result.groupId);
onClose();
router.push(`/chat/${result.groupId}`);
```

**Correct pattern:**
```typescript
// CORRECT: await before navigation
// The existing createGroup.isPending spinner covers this wait
await initGroupTree(result.groupId);
setGroupName('');
onGroupCreated?.(result.groupId);
onClose();
router.push(`/chat/${result.groupId}`);
```

**Current broken pattern (invite/[code]/page.tsx:31):**
```typescript
// WRONG: joinGroupTree races with router.replace
joinGroupTree(result.groupId, result.leafIndex ?? 0).catch(console.error);
setState('success');
router.replace(`/chat/${result.groupId}`);
```

**Correct pattern:**
```typescript
// CORRECT: await join before navigating
await joinGroupTree(result.groupId, result.leafIndex ?? 0);
setState('success');
router.replace(`/chat/${result.groupId}`);
```

The invite page uses `.then(...).catch(...)` chaining, so the fix is converting the `.then` callback to `async`:
```typescript
acceptInvite
  .mutateAsync(code)
  .then(async (result) => {
    await joinGroupTree(result.groupId, result.leafIndex ?? 0);
    setState('success');
    router.replace(`/chat/${result.groupId}`);
  })
  .catch((err) => {
    setState('error');
    setError(err instanceof Error ? err.message : 'Failed to accept invite');
  });
```

### Pattern 3: Switch chat-client-store to IndexedDBKeyStore

**Location:** `apps/web/stores/chat-client-store.ts:25-26`

**Change:**
```typescript
// BEFORE
import { GroupCipher, MemoryKeyStore } from '@microchat/crypto';
const messageKeyStore = new MemoryKeyStore();

// AFTER
import { GroupCipher, IndexedDBKeyStore } from '@microchat/crypto';
const messageKeyStore = new IndexedDBKeyStore('microchat-message-keys');
```

The rest of the store is unchanged — `GroupCipher` accepts any `KeyStore` implementation.

**Important:** `IndexedDBKeyStore` is a module-level singleton (same as `MemoryKeyStore` currently). IndexedDB handles concurrent access correctly for same-origin same-db-name.

### Pattern 4: Auto-Join Must Call joinGroupTree

**Location:** `apps/web/app/(chat)/chat/[groupId]/page.tsx:149`

**Current code:**
```typescript
joinAttemptedRef.current = true;
joinGroup.mutate(groupId as GroupId);
```

**Fix:** Switch to `mutateAsync` and chain `joinGroupTree`:
```typescript
joinAttemptedRef.current = true;
joinGroup
  .mutateAsync(groupId as GroupId)
  .then(() => joinGroupTree(groupId as GroupId, 0))
  .catch(console.error);
```

Note: `leafIndex=0` is imprecise here (direct URL join with no Welcome). The user will get the correct epoch from the next `treeUpdate` WebSocket event via `handleTreeUpdate → processCommit`. This is an acceptable degraded path.

### Anti-Patterns to Avoid

- **Fire-and-forget tree init before navigation:** User arrives at chat page with `getEpoch()` returning 0. First message uses epoch-0 fallback key.
- **MemoryKeyStore for long-lived message keys:** All derived group keys vanish on reload. Epoch > 0 messages show as undecryptable ciphertext.
- **Calling `initGroupTree` twice for same group:** No guard in `initGroupTree` — second call overwrites in-memory state with a fresh epoch-1 tree, invalidating all other members' epoch.
- **Not exporting IndexedDBKeyStore from index.ts:** After creating the file, must add `export * from './indexed-db-key-store';` to `packages/crypto/src/index.ts`.
- **Testing IndexedDBKeyStore in vitest without polyfill:** `indexedDB` is not available in Node. Must import `fake-indexeddb/auto` in test setup.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| IDB key serialization | Custom localStorage crypto key encoding | `IndexedDBKeyStore` storing `Uint8Array` directly | IDB stores binary natively; no base64 encoding needed (unlike localStorage) |
| IDB schema migration | Custom versioning logic | Standard IDB `onupgradeneeded` with version 1 | Single schema version for this app's needs |
| React async state during tree init | Custom loading state enum | Extend existing `createGroup.isPending` with local `useState` | One extra boolean state, not a state machine |

**Key insight:** IndexedDB natively stores `Uint8Array`, so no serialization is needed (unlike the identity key which uses localStorage and must base64-encode because localStorage is string-only).

---

## Common Pitfalls

### Pitfall 1: Fire-and-Forget Tree Init Causes Epoch-0 First Messages

**What goes wrong:** Creator sends first message before `initGroupTree` completes. `getEpoch(groupId)` returns 0. Message is encrypted with fallback key, not TreeKEM-derived key.

**Why it happens:** `initGroupTree` does: ECDH key generation (~5ms) + `crypto.subtle.exportKey` (~1ms) + `postTreeUpdate` HTTP request (~100-300ms). Dialog closes and router navigates in ~10ms. The first message can be sent before `postTreeUpdate` returns.

**How to avoid:** Await `initGroupTree` inside `handleSubmit` in `NewGroupDialog` before calling `onClose()` and `router.push()`. The existing spinner (`createGroup.isPending`) can be extended to cover this wait, or a separate loading boolean can be added.

**Warning signs:** Network tab shows `POST /api/groups/{id}/messages` with `epoch: 0` for the first message of a new group.

### Pitfall 2: Page Refresh Loses All Message Keys (MemoryKeyStore)

**What goes wrong:** User opens chat, receives messages, refreshes browser tab. All messages from before refresh show as encrypted ciphertext or trigger "Key not found" errors.

**Why it happens:** `MemoryKeyStore` stores derived group keys in a JavaScript `Map`. Map is cleared on page refresh. `IndexedDBKeyStore` persists to the browser's IndexedDB which survives refresh.

**How to avoid:** Implement and use `IndexedDBKeyStore`. This is a prerequisite for the phase.

**Warning signs:** `messageCipher.decrypt()` in `useWebSocket.ts:48` catches errors for messages that were recently visible. `[KeyStore] Key not found for group X, epoch Y` appears in console after refresh.

### Pitfall 3: Auto-Join Flow Never Initializes TreeKEM

**What goes wrong:** User navigates directly to `/chat/{groupId}` without an invite. The page auto-joins via `useJoinGroup` on the "Not a member" error. They join the server group but `treekemManager.hasTree(groupId)` is false. All their sends use epoch 0.

**Why it happens:** The auto-join path in `page.tsx` (line 149) calls `joinGroup.mutate()` which only does the HTTP join. It never calls `joinGroupTree`.

**How to avoid:** After successful join, call `joinGroupTree`. Use `joinGroup.mutateAsync().then(() => joinGroupTree(...))`.

**Warning signs:** User auto-joined via URL sends messages with `epoch: 0` in network requests.

### Pitfall 4: initGroupTree Has No Idempotency Guard

**What goes wrong:** If `initGroupTree` is called twice for the same group (React Strict Mode in dev, double-invocation from hot reload, or a bug), it calls `MLSGroup.create()` twice. The second call stores a new group with epoch 1, overwriting the in-memory state. If the first call already posted epoch 1 to the server, the second call will fail with 409 (epoch conflict) or succeed with epoch 2 while other members are at epoch 1.

**How to avoid:** Guard with `treekemManager.hasTree(groupId)` check before calling `initGroupTree`. `NewGroupDialog` calls it once-per-creation (acceptable), but any future code path should check first. `GroupSettings.handleRotateKeys` already shows the correct pattern (line 126).

**Warning signs:** Two `POST /api/groups/:id/tree-update` in network tab for same group, epochs 1 and 2.

### Pitfall 5: IndexedDB Not Available in vitest/Node Environment

**What goes wrong:** `IndexedDBKeyStore` tests fail immediately with `ReferenceError: indexedDB is not defined`.

**Why it happens:** Node.js does not ship `indexedDB`. The vitest test environment runs in Node.

**How to avoid:** Add `fake-indexeddb` as a dev dependency in `packages/crypto` and import it in the test file:
```typescript
import 'fake-indexeddb/auto';
```
This polyfills `global.indexedDB` for the test environment. The `fake-indexeddb` package is the standard solution used by all IndexedDB libraries for testing (Dexie, idb, localForage all use it).

**Warning signs:** `ReferenceError: indexedDB is not defined` in test output.

### Pitfall 6: joinGroupTree with leafIndex=0 Always

**What goes wrong:** `AcceptInviteResult.leafIndex` is optional (may be undefined). The fallback `?? 0` may be wrong if leaf 0 is already occupied by the creator.

**Why it happens:** `AcceptInviteResult` from server has `leafIndex?: number`. For a group with creator at leaf 0, the joiner should be at leaf 1. The legacy `joinGroup` path in `treekem-manager.ts` uses the provided leafIndex to place the joiner's key pair in the tree.

**Impact severity:** LOW. The joiner cannot decrypt messages sent before they joined (pre-shared forward secrecy — acceptable). The `handleTreeUpdate` path corrects the tree state on the next commit event. The main risk is the joiner sending messages with a wrong root secret, but the server epoch check (`postTreeUpdate` 409 guard) prevents them from posting mismatched commits.

**How to avoid:** Use `result.leafIndex ?? 0` only when Welcome path is unavailable (current situation). This is acceptable for the phase scope. Full fix requires server to return Welcome in AcceptInviteResult.

---

## Code Examples

### IndexedDBKeyStore Full Implementation Pattern

```typescript
// Target file: packages/crypto/src/indexed-db-key-store.ts
// Source: standard IndexedDB API pattern
import type { GroupId } from '@microchat/shared';
import type { KeyMetadata, KeyStore, StoredKey } from './key-store';

export class IndexedDBKeyStore implements KeyStore {
  private dbPromise: Promise<IDBDatabase> | null = null;

  constructor(private readonly dbName: string = 'microchat-message-keys') {}

  private getDB(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(this.dbName, 1);
        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains('keys')) {
            db.createObjectStore('keys', { keyPath: ['groupId', 'epoch'] });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
    return this.dbPromise;
  }

  async storeKey(groupId: GroupId, epoch: number, key: Uint8Array): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('keys', 'readwrite');
      tx.objectStore('keys').put({ groupId, epoch, key, createdAt: new Date().toISOString() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getKey(groupId: GroupId, epoch: number): Promise<StoredKey | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('keys', 'readonly');
      const req = tx.objectStore('keys').get([groupId, epoch]);
      req.onsuccess = () => {
        const r = req.result;
        if (!r) { resolve(null); return; }
        resolve({
          key: r.key,
          metadata: { groupId: r.groupId, epoch: r.epoch, createdAt: new Date(r.createdAt) },
        });
      };
      req.onerror = () => reject(req.error);
    });
  }

  async deleteKey(groupId: GroupId, epoch: number): Promise<boolean> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('keys', 'readwrite');
      const store = tx.objectStore('keys');
      const req = store.get([groupId, epoch]);
      req.onsuccess = () => {
        if (!req.result) { resolve(false); return; }
        store.delete([groupId, epoch]);
        tx.oncomplete = () => resolve(true);
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  async deleteAllGroupKeys(groupId: GroupId): Promise<number> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('keys', 'readwrite');
      const store = tx.objectStore('keys');
      let count = 0;
      const cursor = store.openCursor();
      cursor.onsuccess = () => {
        const c = cursor.result;
        if (c) {
          if (c.value.groupId === groupId) { c.delete(); count++; }
          c.continue();
        }
      };
      tx.oncomplete = () => resolve(count);
      tx.onerror = () => reject(tx.error);
    });
  }
}
```

### Adding IndexedDBKeyStore to crypto package exports

```typescript
// packages/crypto/src/index.ts — add this line:
export * from './indexed-db-key-store';
```

### Switching chat-client-store to IndexedDBKeyStore

```typescript
// apps/web/stores/chat-client-store.ts
// Change line 5-6:
import { GroupCipher, IndexedDBKeyStore } from '@microchat/crypto';
// (remove MemoryKeyStore import if no longer used)

// Change lines 25-26:
const messageKeyStore = new IndexedDBKeyStore('microchat-message-keys');
const messageCipher = new GroupCipher(messageKeyStore);
// treekemManager line stays the same — it uses messageCipher which now persists keys
```

### Correct Invite Page Pattern (async await)

```typescript
// apps/web/app/invite/[code]/page.tsx
acceptInvite
  .mutateAsync(code)
  .then(async (result) => {
    // Await ensures tree is initialized before chat page renders
    await joinGroupTree(result.groupId, result.leafIndex ?? 0);
    setState('success');
    router.replace(`/chat/${result.groupId}`);
  })
  .catch((err) => {
    setState('error');
    setError(err instanceof Error ? err.message : 'Failed to accept invite');
  });
```

### Correct NewGroupDialog Pattern (async await)

```typescript
// apps/web/components/NewGroupDialog.tsx
try {
  const result = await createGroup.mutateAsync(groupName.trim());
  // Clipboard write can race — keep as fire-and-forget
  navigator.clipboard.writeText(...).catch(console.error);

  // Await tree init before navigation
  await initGroupTree(result.groupId);

  setGroupName('');
  onGroupCreated?.(result.groupId);
  onClose();
  router.push(`/chat/${result.groupId}`);
} catch (err) {
  setLocalError(err instanceof Error ? err.message : t('failedCreateGroup'));
}
```

---

## State of the Art

| Old Approach | Current Approach | Status | Impact |
|--------------|------------------|--------|--------|
| `MemoryKeyStore` for message keys | `IndexedDBKeyStore` | Must implement + switch | Keys survive page refresh |
| Fire-and-forget tree init | Await before navigation | Must fix | Prevents epoch-0 first messages |
| No tree init on auto-join | Call `joinGroupTree` after `useJoinGroup` | Must fix | All join paths initialize crypto |
| Legacy `joinGroup` fallback path | Welcome-based join via `treeUpdate` | Out of scope for phase | Legacy path works; Welcome is future work |

---

## Open Questions

1. **Does `fake-indexeddb` need to be added to `packages/crypto/package.json`?**
   - What we know: `packages/crypto` uses vitest. `fake-indexeddb` is the standard vitest/Node polyfill for IndexedDB.
   - What's unclear: Is it already present? Check `cat packages/crypto/package.json | grep fake-indexeddb`.
   - Recommendation: Check before assuming — if not present, add as devDependency.

2. **Should `initGroupTree` add an idempotency guard?**
   - What we know: Currently no guard; calling twice overwrites group state.
   - What's unclear: Whether React Strict Mode double-invocation actually triggers this in practice (the `hasAttemptedRef` pattern prevents it in invite page, and `NewGroupDialog` only calls once per successful create).
   - Recommendation: Add `if (treekemManager.hasTree(groupId)) return;` at the top of `initGroupTree` in `useTreeKEM.ts` as defensive coding.

3. **Should the `handleTreeUpdate` error be surfaced to the user?**
   - What we know: Currently `.catch(console.error)` in `useWebSocket.ts:124`.
   - What's unclear: What the right UX is for a failed `treeUpdate` — the user cannot decrypt future messages if epoch is stuck.
   - Recommendation: Log the error; don't show UI toast (this is background key sync, not a user-initiated action). Out of scope for this phase.

---

## Testing Strategy

**Test framework:** Playwright for E2E, Vitest for unit tests in `packages/crypto`.

### Required Tests

| Test | Type | Location | Command |
|------|------|----------|---------|
| `IndexedDBKeyStore` — store and retrieve key | Unit | `packages/crypto/src/indexed-db-key-store.test.ts` | `pnpm --filter @microchat/crypto test` |
| `IndexedDBKeyStore` — key survives re-instantiation | Unit | same | same |
| `IndexedDBKeyStore` — deleteAllGroupKeys | Unit | same | same |
| E2E: first message from creator has epoch > 0 | E2E | `apps/web/e2e/` | `pnpm --filter @microchat/web exec playwright test` |

### Manual Test Protocol (per CLAUDE.md)

1. Start dev server: `pnpm dev`
2. Open browser DevTools → Network tab → filter by "messages"
3. Create a new group — watch for `POST /api/groups/*/tree-update` with `epoch: 1`
4. Send first message — verify `POST /api/groups/*/messages` request body has `epoch: 1` (not 0)
5. Open second browser window, accept invite link
6. Verify second browser shows `POST /api/groups/*/messages` with epoch >= 1 after joining
7. Refresh the first browser — verify old messages still display (IndexedDB keys survived)
8. Check DevTools → Application → IndexedDB → microchat-message-keys → keys table shows entries

---

## Sources

### Primary (HIGH confidence — direct code inspection)

- `/apps/web/hooks/useTreeKEM.ts` — full hook API, identity key pattern
- `/apps/web/components/NewGroupDialog.tsx` — fire-and-forget pattern confirmed
- `/apps/web/app/invite/[code]/page.tsx` — fire-and-forget pattern confirmed
- `/apps/web/app/(chat)/chat/[groupId]/page.tsx` — auto-join gap and message send paths
- `/apps/web/stores/chat-client-store.ts` — `MemoryKeyStore` confirmed in use
- `/apps/web/hooks/useWebSocket.ts` — `treeUpdate` dispatch confirmed
- `/packages/crypto/src/key-store.ts` — `KeyStore` interface (implementation target)
- `/packages/crypto/src/memory-key-store.ts` — reference implementation
- `/packages/crypto/src/index.ts` — exports (no IndexedDBKeyStore)
- `/packages/client/src/treekem-manager.ts` — `TreeKEMManager` API
- `/packages/client/src/group-client.ts` — `AcceptInviteResult` (no `welcome` field)
- `.planning/quick/1-treekem-ui-integration/1-SUMMARY.md` — Quick Task 1 scope

### Secondary (MEDIUM confidence)

- MEMORY.md — mentions `IndexedDBKeyStore` as intended target; **refuted** by source inspection
- FEATURES.md "TreeKEM UI Integration" — out-of-scope items confirmed (Welcome path, addMember)

### Tertiary (LOW confidence — not needed for this phase)

- IndexedDB spec / MDN: standard IDB Promise wrapper pattern; well-known; not verified against current spec

---

## Metadata

**Confidence breakdown:**
- Current state audit: HIGH — direct code inspection, not inference
- Integration gaps (fire-and-forget): HIGH — confirmed in source at specific line numbers
- IndexedDBKeyStore does not exist: HIGH — confirmed by listing `packages/crypto/src/` and checking `index.ts`
- Implementation approach for IndexedDBKeyStore: HIGH — `KeyStore` interface is well-defined; IDB pattern is stable
- Architecture patterns (await before nav): HIGH — straightforward async fix
- Welcome path complexity: MEDIUM — server side not fully inspected (out of scope)

**Research date:** 2026-02-27
**Valid until:** 2026-03-14 (30 days — stable codebase)

---

## Deep Dive: Race Condition Patterns

**Added:** 2026-02-28
**Scope:** Exact before/after for all three call sites; loading state mechanics; `useTreeKEM` API assessment; hook placement for auto-join.

### Findings from Direct Source Inspection (HIGH confidence)

Reading the four files in full revealed these precise facts that the earlier research inferred but did not confirm at line-level:

| File | Line | Actual Code | Consequence |
|------|------|-------------|-------------|
| `NewGroupDialog.tsx` | 56 | `initGroupTree(result.groupId).catch(console.error)` | No `await`. Execution continues to `onClose()` line 70, `router.push()` line 71 synchronously. |
| `NewGroupDialog.tsx` | 61-68 | `navigator.clipboard.writeText(inviteLink)` is `await`-ed inside an `if (!safariCopied)` block after line 56 | Clipboard write has `await` but tree init does not — inverted priority. |
| `invite/[code]/page.tsx` | 29-35 | `.then((result) => { joinGroupTree(...).catch(...); setState('success'); router.replace(...) })` | The `.then` callback is synchronous. `joinGroupTree` is launched but not awaited; `router.replace` fires immediately after. |
| `page.tsx` | 149 | `joinGroup.mutate(groupId as GroupId)` | Uses `.mutate()`, not `.mutateAsync()`. `.mutate()` returns `void` — cannot chain `.then()`. Must change to `.mutateAsync()` to chain `joinGroupTree`. |
| `useTreeKEM.ts` | 131 | `if (treekemManager.hasTree(groupId)) return;` | `joinGroupTree` already has idempotency guard. `initGroupTree` (line 104) does NOT. |
| `useTreeKEM.ts` | 104-123 | `initGroupTree` is a `useCallback` returning `Promise<void>` | Fully awaitable. No internal state changes to `useState` — safe to `await` inside a form submit handler. |
| `useTreeKEM.ts` | 129-154 | `joinGroupTree` is a `useCallback` returning `Promise<void>` | Fully awaitable. Same — safe to `await` inside `.then(async ...)`. |
| `page.tsx` | 144-152 | Auto-join lives inside a `useEffect`. `joinGroup` is from `useJoinGroup()` at line 68. | `useJoinGroup` is a `useMutation` hook. `joinGroup.mutate` is stable across renders. `joinGroup.mutateAsync` is also stable (same reference). |

### Call Site 1: NewGroupDialog — Exact Before/After

**Current `handleSubmit` (lines 37-75), annotated:**

```typescript
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  // ...validation...

  try {
    const createPromise = createGroup.mutateAsync(groupName.trim());

    // Safari clipboard path — fire-and-forget (correct, clipboard can race)
    let safariCopied = false;
    try {
      if (typeof window !== 'undefined' && window.ClipboardItem && navigator.clipboard?.write) {
        const item = new ClipboardItem({
          'text/plain': createPromise.then(result =>
            new Blob([`${window.location.origin}/chat/${result.groupId}`], { type: 'text/plain' })
          )
        });
        navigator.clipboard.write([item]).catch(console.error); // correct: fire-and-forget
        safariCopied = true;
      }
    } catch (e) { /* ignored */ }

    const result = await createPromise; // <-- awaited correctly

    // BUG: fire-and-forget — initGroupTree races with navigation below
    initGroupTree(result.groupId).catch(console.error); // LINE 56

    setGroupName('');
    onGroupCreated?.(result.groupId);

    if (!safariCopied) {
      try {
        const inviteLink = `${window.location.origin}/chat/${result.groupId}`;
        await navigator.clipboard.writeText(inviteLink); // awaited — but tree init is NOT
      } catch (clipboardError) {
        console.error('Failed to copy to clipboard', clipboardError);
      }
    }

    onClose();           // fires before tree init completes
    router.push(`/chat/${result.groupId}`); // fires before tree init completes
  } catch (err) {
    setLocalError(err instanceof Error ? err.message : t('failedCreateGroup'));
  }
}
```

**Fixed version — minimal diff:**

The fix is two changes: (a) add `await` before `initGroupTree`, (b) add a local `isInitializingTree` boolean to keep the submit button disabled during tree init. The clipboard `await` can be moved after tree init or kept before — order does not matter for correctness.

```typescript
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  if (!groupName.trim()) {
    setLocalError(t('enterGroupName'));
    return;
  }
  setLocalError(null);

  try {
    const createPromise = createGroup.mutateAsync(groupName.trim());

    // Safari clipboard — keep fire-and-forget (correct)
    let safariCopied = false;
    try {
      if (typeof window !== 'undefined' && window.ClipboardItem && navigator.clipboard?.write) {
        const item = new ClipboardItem({
          'text/plain': createPromise.then(result =>
            new Blob([`${window.location.origin}/chat/${result.groupId}`], { type: 'text/plain' })
          )
        });
        navigator.clipboard.write([item]).catch(console.error);
        safariCopied = true;
      }
    } catch (_e) { /* ignored */ }

    const result = await createPromise;

    // FIX: await tree init before navigation
    // createGroup.isPending remains true until createGroup.mutateAsync resolves,
    // but after that line the button needs to stay disabled.
    // Add a local isInitializingTree state OR rely on the fact that the button
    // has disabled={createGroup.isPending || !groupName.trim()} and the form
    // is still mounted/blocking until router.push fires.
    // Simplest approach: add setIsInitializingTree(true) before this line.
    await initGroupTree(result.groupId); // was: initGroupTree(...).catch(console.error)

    if (!safariCopied) {
      try {
        await navigator.clipboard.writeText(`${window.location.origin}/chat/${result.groupId}`);
      } catch (_e) { /* ignored */ }
    }

    setGroupName('');
    onGroupCreated?.(result.groupId);
    onClose();
    router.push(`/chat/${result.groupId}`);
  } catch (err) {
    setLocalError(err instanceof Error ? err.message : t('failedCreateGroup'));
  }
}
```

**Loading state question — does the user see a delay?**

Yes. `initGroupTree` takes ~100-400ms (key export + HTTP). The dialog stays open during this wait because `onClose()` is after the `await`. The submit button remains disabled because:
- `createGroup.isPending` stays `true` until `createGroup.mutateAsync` resolves
- After the `await createPromise` line, `createGroup.isPending` becomes `false`
- The user could theoretically click submit again between `await createPromise` and `await initGroupTree`

To prevent this, add one `useState` boolean:

```typescript
const [isInitializingTree, setIsInitializingTree] = useState(false);

// In handleSubmit, wrap the initGroupTree call:
setIsInitializingTree(true);
try {
  await initGroupTree(result.groupId);
} finally {
  setIsInitializingTree(false);
}

// In the submit button:
disabled={createGroup.isPending || isInitializingTree || !groupName.trim()}
```

The spinner already shows on `createGroup.isPending`. Since `isInitializingTree` immediately follows `createGroup.mutateAsync` resolving and the dialog closes on success, this gap is ~100-400ms with the dialog still visible. The spinner can be left as-is (it stops when `createGroup.isPending` becomes false) or explicitly extended. The simplest correct implementation: add `isInitializingTree` state, show spinner while either is true.

**What if `initGroupTree` fails?**

The `catch (err)` block at the bottom of `handleSubmit` catches it. `setLocalError(...)` will display the error. The group was already created on the server. The user sees the error, can try again, but the group exists. A retry of the full dialog would try to create a second group. This is acceptable for the phase scope — the error message should hint "Group created but encryption init failed; go to settings to initialize."

Alternatively, if `initGroupTree` throws, navigate anyway and let GroupSettings handle it. This is the "degraded mode" approach: navigate on group create success regardless of tree init outcome, show the "No key found" banner in the chat page, and let the user click "Initialize Encryption" in GroupSettings. This avoids the "second group" retry problem.

**Prescriptive recommendation:** Use the degraded mode approach in `NewGroupDialog`:

```typescript
const result = await createPromise;

// Best-effort tree init — failure is recoverable via GroupSettings
try {
  await initGroupTree(result.groupId);
} catch (treeErr) {
  console.error('[treekem] initGroupTree failed after group creation', treeErr);
  // Continue to navigate — GroupSettings "Rotate Keys" can recover
}

setGroupName('');
onGroupCreated?.(result.groupId);
onClose();
router.push(`/chat/${result.groupId}`);
```

This satisfies "await before navigate" while ensuring a failed tree init does not leave the user in the dialog without a group.

**Timeout:** No timeout is needed. `postTreeUpdate` uses the standard `fetch` which will timeout per browser defaults (2 minutes). A 5-second timeout is reasonable but adds complexity. Skip for this phase.

### Call Site 2: invite/[code]/page.tsx — Exact Before/After

**Current code (lines 22-43), annotated:**

```typescript
useEffect(() => {
  const code = params.code;
  if (!code || hasAttemptedRef.current) return;
  hasAttemptedRef.current = true;

  acceptInvite
    .mutateAsync(code)
    .then((result) => {
      // BUG: joinGroupTree is fire-and-forget
      joinGroupTree(result.groupId, result.leafIndex ?? 0).catch(console.error); // LINE 31
      setState('success'); // fires immediately
      router.replace(`/chat/${result.groupId}`); // navigates immediately
    })
    .catch((err) => {
      setState('error');
      setError(err instanceof Error ? err.message : 'Failed to accept invite');
    });
}, [params.code, router, acceptInvite.mutateAsync, joinGroupTree]);
```

**Fixed version — minimal diff:**

Convert the `.then` callback to `async`. Error in `joinGroupTree` should fall through to the outer `.catch`:

```typescript
acceptInvite
  .mutateAsync(code)
  .then(async (result) => {
    // Await tree join before navigating — prevents epoch-0 first message
    // joinGroupTree already has hasTree guard, so double-calls are safe
    try {
      await joinGroupTree(result.groupId, result.leafIndex ?? 0);
    } catch (treeErr) {
      console.error('[treekem] joinGroupTree failed on invite accept', treeErr);
      // Navigate anyway — tree can recover via next treeUpdate WebSocket event
    }
    setState('success');
    router.replace(`/chat/${result.groupId}`);
  })
  .catch((err) => {
    setState('error');
    setError(err instanceof Error ? err.message : 'Failed to accept invite');
  });
```

**What does the user see?** The invite page shows "Joining group... Accepting your invite" (the `state === 'loading'` UI) while both `acceptInvite.mutateAsync` and `joinGroupTree` complete. After both succeed, `setState('success')` shows "You're in! Redirecting..." briefly before `router.replace`. The added delay for `joinGroupTree` is ~100-400ms. This is invisible to the user given the page already shows a loading spinner.

**Navigate before or after tree init?** Navigate AFTER. The question was whether to navigate first and init in the background on the chat page. That approach has a problem: the chat page does not automatically call `joinGroupTree` on mount (there is no `useEffect` that checks `!treekemManager.hasTree(groupId)` and calls `joinGroupTree`). The auto-join path in `page.tsx` only fires on "Not a member" error — which doesn't apply here since `acceptInvite` already made the user a member. So navigating first and hoping tree init happens in the background does not work with the current architecture. The only reliable place to call `joinGroupTree` for the invite path is in the invite page's `.then` callback.

### Call Site 3: page.tsx Auto-Join — Exact Hook Placement

**Current code (lines 143-152), annotated:**

```typescript
// Auto-join group if not a member
const joinAttemptedRef = useRef(false);
useEffect(() => {
  if (groupId && error && error.message.includes('Not a member')) {
    if (!joinAttemptedRef.current) {
      joinAttemptedRef.current = true;
      joinGroup.mutate(groupId as GroupId); // LINE 149 — .mutate() returns void
    }
  }
}, [groupId, error, joinGroup.mutate]); // intentionally omit joinGroup to avoid loop
```

**The dependency array issue:** The comment says "intentionally omit joinGroup to avoid loop." This is because `joinGroup` is a TanStack Query mutation object — if it were in the deps, every re-render triggered by `joinGroup.isPending` changing would re-run the effect. The comment is correct. `joinGroup.mutate` is stable (same function reference) so it is safe to include.

**The `.mutate()` vs `.mutateAsync()` question:** `.mutate()` is `void`-returning — it cannot be chained. `.mutateAsync()` returns `Promise<result>`. Changing to `.mutateAsync()` inside a `useEffect` requires a wrapper:

```typescript
useEffect(() => {
  if (groupId && error && error.message.includes('Not a member')) {
    if (!joinAttemptedRef.current) {
      joinAttemptedRef.current = true;
      // Use mutateAsync so we can chain joinGroupTree
      joinGroup
        .mutateAsync(groupId as GroupId)
        .then(() => joinGroupTree(groupId as GroupId, 0))
        .catch(console.error);
    }
  }
}, [groupId, error, joinGroup.mutate, joinGroupTree]);
// joinGroupTree must be in deps since it's used inside the effect
```

**`joinGroupTree` in the dependency array:** `joinGroupTree` is a `useCallback` from `useTreeKEM`. Its deps are `[treekemManager, getClient, getIdentityKey]` — all stable (Zustand selectors and useCallback). So including it in deps does not cause infinite loops.

**Where does `useTreeKEM` need to be added in `page.tsx`?** The hook is not currently imported in `page.tsx`. It must be added:

```typescript
// apps/web/app/(chat)/chat/[groupId]/page.tsx
// Add import alongside other hook imports:
import { useTreeKEM } from '@/hooks/useTreeKEM';

// In ConversationPage():
const { joinGroupTree } = useTreeKEM();

// In the auto-join useEffect (lines 144-152):
useEffect(() => {
  if (groupId && error && error.message.includes('Not a member')) {
    if (!joinAttemptedRef.current) {
      joinAttemptedRef.current = true;
      joinGroup
        .mutateAsync(groupId as GroupId)
        .then(() => joinGroupTree(groupId as GroupId, 0))
        .catch(console.error);
    }
  }
}, [groupId, error, joinGroup.mutate, joinGroupTree]);
```

**`leafIndex=0` correctness for auto-join:** In the auto-join path (direct URL navigation), there is no `leafIndex` from the server. The user is joining a group they were not invited to (or were invited by sharing the chat URL, not the invite page). `leafIndex=0` will be wrong if the group creator occupies leaf 0. However, the next `treeUpdate` WebSocket event (which fires whenever any member updates the tree) will call `handleTreeUpdate`, which calls `treekemManager.processCommit()` and advances the epoch correctly. The user's first few sends may use epoch 0, but after the first background `treeUpdate` event they sync. This is the accepted degraded path.

### useTreeKEM API Assessment — What Needs to Change

**Current exports from `useTreeKEM.ts` line 178-184:**
```typescript
return {
  treekemManager,
  initGroupTree,
  joinGroupTree,
  handleTreeUpdate,
  getIdentityKey,
};
```

**Does the hook need new methods to support the fixes?** No. The three fixes (await in NewGroupDialog, await in invite page, add joinGroupTree to auto-join) use the existing API:
- `initGroupTree(groupId: GroupId): Promise<void>` — already correct
- `joinGroupTree(groupId: GroupId, leafIndex: number, welcomeJson?: string): Promise<void>` — already correct
- Both are stable `useCallback` refs — safe to use in `useEffect` dependency arrays and `.then()` chains

**Does `initGroupTree` need an idempotency guard?** Confirmed: no guard exists (line 104). Recommended addition:

```typescript
const initGroupTree = useCallback(
  async (groupId: GroupId) => {
    // Guard: skip if already initialized (prevents double-init from React Strict Mode)
    if (treekemManager.hasTree(groupId)) return;

    const keyPair = await getIdentityKey();
    // ... rest unchanged
  },
  [treekemManager, getClient, getIdentityKey],
);
```

**Why add it now?** The await pattern in NewGroupDialog means the function is called once and awaited. But if `NewGroupDialog` is ever refactored to call `initGroupTree` via `useEffect` instead of inside `handleSubmit`, Strict Mode double-invocation becomes a real risk. The guard costs one line and `hasTree` is O(1) Map lookup.

### Summary Decision Table

| Call Site | Current Pattern | Fix | Loading State Change | Error Handling |
|-----------|----------------|-----|---------------------|----------------|
| `NewGroupDialog.tsx:56` | `initGroupTree(...).catch(console.error)` — fire-and-forget | `await initGroupTree(...)` inside try/catch | Add `isInitializingTree` boolean to keep button disabled; or use degraded mode (navigate on createGroup success, skip await) | On failure: log error, navigate anyway (GroupSettings recovers) |
| `invite/[code]/page.tsx:31` | `.then((result) => { joinGroupTree(...).catch(); navigate() })` | `.then(async (result) => { await joinGroupTree(...); navigate() })` | None needed — invite page already shows spinner the whole time | On failure: log error, navigate anyway |
| `page.tsx:149` | `joinGroup.mutate(groupId)` — void, no chain | `joinGroup.mutateAsync(groupId).then(() => joinGroupTree(...)).catch(console.error)` | None — existing joinGroup.isPending spinner covers the join; tree init is fire-and-forget here (acceptable) | Silent `.catch(console.error)` — auto-join tree init failure is non-fatal |
| `useTreeKEM.ts:104` (initGroupTree) | No idempotency guard | Add `if (treekemManager.hasTree(groupId)) return;` | N/A | N/A |

### Manual Testing Steps for Race Condition Fixes (per CLAUDE.md)

1. **Test 1 — NewGroupDialog epoch check:**
   - Open DevTools Network tab, filter by `/api/groups`
   - Create a new group
   - Watch: `POST /api/groups` (create) fires first, then `POST /api/groups/{id}/tree-update` (epoch 1)
   - Immediately type a message in the new chat and send
   - Verify: `POST /api/groups/{id}/messages` request body shows `epoch: 1` (not `epoch: 0`)
   - Before fix: message arrives at chat page before tree-update completes, epoch is 0
   - After fix: dialog stays open until tree-update completes, first message has epoch 1

2. **Test 2 — Invite page epoch check:**
   - Open two browser windows (Alice and Bob)
   - Alice creates a group and copies the invite link
   - Bob opens the invite link in the second window
   - Watch Bob's Network tab: `POST /api/groups/{id}/accept-invite` fires, then `GET /api/groups/{id}/tree-state`
   - Bob types a message immediately after being redirected to chat
   - Verify: Bob's first message has `epoch >= 1` (not 0)
   - Before fix: Bob arrives at chat before `joinGroupTree` completes, epoch is 0
   - After fix: redirect waits for `joinGroupTree`, epoch is correct

3. **Test 3 — Auto-join tree init:**
   - Alice creates a group
   - Bob navigates directly to `/chat/{groupId}` (not via invite)
   - Bob sees "Not a member" briefly, then the join spinner
   - After joining, Bob sends a message
   - Verify: Bob's message has `epoch >= 1` (may be 0 if no treeUpdate has fired yet — this is the acceptable degraded path)
   - Note: This path does not have a waiting mechanism for tree init. epoch-0 on first message is expected and acceptable.