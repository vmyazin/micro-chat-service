import type { GroupId } from '@microchat/shared';
import type { KeyMetadata, KeyStore, StoredKey } from './key-store';

const DB_NAME = 'microchat-keys';
const STORE_NAME = 'group-keys';
const DB_VERSION = 1;

export class IndexedDBKeyStore implements KeyStore {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private openDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = (event) => {
        resolve((event.target as IDBOpenDBRequest).result);
      };

      request.onerror = (event) => {
        reject((event.target as IDBOpenDBRequest).error);
      };
    });

    return this.dbPromise;
  }

  private makeKey(groupId: GroupId, epoch: number): string {
    return `${groupId}:${epoch}`;
  }

  async storeKey(groupId: GroupId, epoch: number, key: Uint8Array): Promise<void> {
    if (typeof indexedDB === 'undefined') return;

    const db = await this.openDB();
    const storageKey = this.makeKey(groupId, epoch);
    const metadata: KeyMetadata = { groupId, epoch, createdAt: new Date() };
    const record: StoredKey = { key, metadata };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(record, storageKey);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getKey(groupId: GroupId, epoch: number): Promise<StoredKey | null> {
    if (typeof indexedDB === 'undefined') return null;

    const db = await this.openDB();
    const storageKey = this.makeKey(groupId, epoch);

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(storageKey);
      req.onsuccess = () => resolve((req.result as StoredKey) ?? null);
      req.onerror = () => reject(req.error);
    });
  }

  async deleteKey(groupId: GroupId, epoch: number): Promise<boolean> {
    if (typeof indexedDB === 'undefined') return false;

    const existing = await this.getKey(groupId, epoch);
    if (!existing) return false;

    const db = await this.openDB();
    const storageKey = this.makeKey(groupId, epoch);

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(storageKey);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async deleteAllGroupKeys(groupId: GroupId): Promise<number> {
    if (typeof indexedDB === 'undefined') return 0;

    const db = await this.openDB();
    const prefix = `${groupId}:`;

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.openCursor();
      let count = 0;

      req.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          if (typeof cursor.key === 'string' && cursor.key.startsWith(prefix)) {
            cursor.delete();
            count++;
          }
          cursor.continue();
        } else {
          resolve(count);
        }
      };

      req.onerror = () => reject(req.error);
    });
  }
}
