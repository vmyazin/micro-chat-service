import type { GroupId } from '@microchat/shared';
import type { KeyStore, KeyMetadata, StoredKey } from './key-store';

export class MemoryKeyStore implements KeyStore {
  private store = new Map<string, StoredKey>();

  private makeKey(groupId: GroupId, epoch: number): string {
    return `${groupId}:${epoch}`;
  }

  async storeKey(groupId: GroupId, epoch: number, key: Uint8Array): Promise<void> {
    const storageKey = this.makeKey(groupId, epoch);
    const metadata: KeyMetadata = {
      groupId,
      epoch,
      createdAt: new Date(),
    };
    this.store.set(storageKey, { key, metadata });
    console.log(`[KeyStore] Stored key for group ${groupId}, epoch ${epoch}`);
  }

  async getKey(groupId: GroupId, epoch: number): Promise<StoredKey | null> {
    const storageKey = this.makeKey(groupId, epoch);
    const stored = this.store.get(storageKey);
    if (stored) {
      console.log(`[KeyStore] Retrieved key for group ${groupId}, epoch ${epoch}`);
      return stored;
    }
    console.log(`[KeyStore] Key not found for group ${groupId}, epoch ${epoch}`);
    return null;
  }

  async deleteKey(groupId: GroupId, epoch: number): Promise<boolean> {
    const storageKey = this.makeKey(groupId, epoch);
    const deleted = this.store.delete(storageKey);
    console.log(`[KeyStore] ${deleted ? 'Deleted' : 'Not found'} key for group ${groupId}, epoch ${epoch}`);
    return deleted;
  }

  async deleteAllGroupKeys(groupId: GroupId): Promise<number> {
    const prefix = `${groupId}:`;
    let count = 0;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        count++;
      }
    }
    console.log(`[KeyStore] Deleted ${count} keys for group ${groupId}`);
    return count;
  }
}
