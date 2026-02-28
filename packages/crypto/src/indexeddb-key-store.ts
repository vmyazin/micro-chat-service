import type { GroupId } from '@microchat/shared';
import type { KeyMetadata, KeyStore, StoredKey } from './key-store';

const DB_NAME = 'microchat-keys';
const STORE_NAME = 'group-keys';
const DB_VERSION = 1;

interface IDBRecord {
  id: string;
  key: Uint8Array;
  groupId: string;
  epoch: number;
  createdAt: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
      req.onerror = (e) => reject((e.target as IDBOpenDBRequest).error);
    });
  }
  return dbPromise;
}

/** Reset singleton DB connection and delete the database. Used for test isolation. */
export async function _resetDbForTesting(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise.catch(() => null);
    db?.close();
    dbPromise = null;
  }
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
  });
}

export class IndexedDBKeyStore implements KeyStore {
  private makeId(groupId: GroupId, epoch: number): string {
    return `${groupId}:${epoch}`;
  }

  async storeKey(
    groupId: GroupId,
    epoch: number,
    key: Uint8Array,
  ): Promise<void> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const record: IDBRecord = {
        id: this.makeId(groupId, epoch),
        key,
        groupId,
        epoch,
        createdAt: new Date().toISOString(),
      };
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = (e) => reject((e.target as IDBRequest).error);
    });
  }

  async getKey(groupId: GroupId, epoch: number): Promise<StoredKey | null> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(this.makeId(groupId, epoch));
      req.onsuccess = (e) => {
        const record = (e.target as IDBRequest<IDBRecord | undefined>).result;
        if (!record) {
          resolve(null);
          return;
        }
        const metadata: KeyMetadata = {
          groupId: record.groupId as GroupId,
          epoch: record.epoch,
          createdAt: new Date(record.createdAt),
        };
        resolve({ key: record.key, metadata });
      };
      req.onerror = (e) => reject((e.target as IDBRequest).error);
    });
  }

  async deleteKey(groupId: GroupId, epoch: number): Promise<boolean> {
    const existing = await this.getKey(groupId, epoch);
    if (!existing) return false;
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(this.makeId(groupId, epoch));
      req.onsuccess = () => resolve(true);
      req.onerror = (e) => reject((e.target as IDBRequest).error);
    });
  }

  async deleteAllGroupKeys(groupId: GroupId): Promise<number> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const prefix = `${groupId}:`;
      let count = 0;
      const req = store.openCursor();
      req.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest<IDBCursorWithValue | null>)
          .result;
        if (!cursor) {
          resolve(count);
          return;
        }
        if ((cursor.key as string).startsWith(prefix)) {
          cursor.delete();
          count++;
        }
        cursor.continue();
      };
      req.onerror = (e) => reject((e.target as IDBRequest).error);
    });
  }
}
