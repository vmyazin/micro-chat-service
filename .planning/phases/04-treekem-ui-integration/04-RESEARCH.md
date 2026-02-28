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
