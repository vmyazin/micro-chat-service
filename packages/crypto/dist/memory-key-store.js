"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryKeyStore = void 0;
class MemoryKeyStore {
    store = new Map();
    makeKey(groupId, epoch) {
        return `${groupId}:${epoch}`;
    }
    async storeKey(groupId, epoch, key) {
        const storageKey = this.makeKey(groupId, epoch);
        const metadata = {
            groupId,
            epoch,
            createdAt: new Date(),
        };
        this.store.set(storageKey, { key, metadata });
        console.log(`[KeyStore] Stored key for group ${groupId}, epoch ${epoch}`);
    }
    async getKey(groupId, epoch) {
        const storageKey = this.makeKey(groupId, epoch);
        const stored = this.store.get(storageKey);
        if (stored) {
            console.log(`[KeyStore] Retrieved key for group ${groupId}, epoch ${epoch}`);
            return stored;
        }
        console.log(`[KeyStore] Key not found for group ${groupId}, epoch ${epoch}`);
        return null;
    }
    async deleteKey(groupId, epoch) {
        const storageKey = this.makeKey(groupId, epoch);
        const deleted = this.store.delete(storageKey);
        console.log(`[KeyStore] ${deleted ? 'Deleted' : 'Not found'} key for group ${groupId}, epoch ${epoch}`);
        return deleted;
    }
    async deleteAllGroupKeys(groupId) {
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
exports.MemoryKeyStore = MemoryKeyStore;
//# sourceMappingURL=memory-key-store.js.map