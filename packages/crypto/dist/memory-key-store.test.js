"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const memory_key_store_1 = require("./memory-key-store");
(0, vitest_1.describe)('MemoryKeyStore', () => {
    let store;
    const groupId = 'group-123';
    const testKey = new Uint8Array([1, 2, 3, 4, 5]);
    (0, vitest_1.beforeEach)(() => {
        store = new memory_key_store_1.MemoryKeyStore();
    });
    (0, vitest_1.describe)('storeKey', () => {
        (0, vitest_1.it)('stores a key with metadata', async () => {
            await store.storeKey(groupId, 1, testKey);
            const result = await store.getKey(groupId, 1);
            (0, vitest_1.expect)(result).not.toBeNull();
            (0, vitest_1.expect)(result.key).toEqual(testKey);
            (0, vitest_1.expect)(result.metadata.groupId).toBe(groupId);
            (0, vitest_1.expect)(result.metadata.epoch).toBe(1);
            (0, vitest_1.expect)(result.metadata.createdAt).toBeInstanceOf(Date);
        });
        (0, vitest_1.it)('overwrites key for same group and epoch', async () => {
            const newKey = new Uint8Array([9, 8, 7, 6, 5]);
            await store.storeKey(groupId, 1, testKey);
            await store.storeKey(groupId, 1, newKey);
            const result = await store.getKey(groupId, 1);
            (0, vitest_1.expect)(result.key).toEqual(newKey);
        });
    });
    (0, vitest_1.describe)('getKey', () => {
        (0, vitest_1.it)('returns null for non-existent key', async () => {
            const result = await store.getKey(groupId, 999);
            (0, vitest_1.expect)(result).toBeNull();
        });
        (0, vitest_1.it)('returns stored key with correct metadata', async () => {
            await store.storeKey(groupId, 5, testKey);
            const result = await store.getKey(groupId, 5);
            (0, vitest_1.expect)(result).not.toBeNull();
            (0, vitest_1.expect)(result.metadata.epoch).toBe(5);
        });
    });
    (0, vitest_1.describe)('deleteKey', () => {
        (0, vitest_1.it)('deletes an existing key and returns true', async () => {
            await store.storeKey(groupId, 1, testKey);
            const deleted = await store.deleteKey(groupId, 1);
            (0, vitest_1.expect)(deleted).toBe(true);
            (0, vitest_1.expect)(await store.getKey(groupId, 1)).toBeNull();
        });
        (0, vitest_1.it)('returns false for non-existent key', async () => {
            const deleted = await store.deleteKey(groupId, 999);
            (0, vitest_1.expect)(deleted).toBe(false);
        });
    });
    (0, vitest_1.describe)('deleteAllGroupKeys', () => {
        (0, vitest_1.it)('deletes all keys for a group and returns count', async () => {
            await store.storeKey(groupId, 1, testKey);
            await store.storeKey(groupId, 2, testKey);
            await store.storeKey(groupId, 3, testKey);
            const count = await store.deleteAllGroupKeys(groupId);
            (0, vitest_1.expect)(count).toBe(3);
            (0, vitest_1.expect)(await store.getKey(groupId, 1)).toBeNull();
            (0, vitest_1.expect)(await store.getKey(groupId, 2)).toBeNull();
            (0, vitest_1.expect)(await store.getKey(groupId, 3)).toBeNull();
        });
        (0, vitest_1.it)('returns 0 for group with no keys', async () => {
            const count = await store.deleteAllGroupKeys('no-keys');
            (0, vitest_1.expect)(count).toBe(0);
        });
        (0, vitest_1.it)('does not delete keys from other groups', async () => {
            const otherGroup = 'other-group';
            await store.storeKey(groupId, 1, testKey);
            await store.storeKey(otherGroup, 1, testKey);
            await store.deleteAllGroupKeys(groupId);
            (0, vitest_1.expect)(await store.getKey(groupId, 1)).toBeNull();
            (0, vitest_1.expect)(await store.getKey(otherGroup, 1)).not.toBeNull();
        });
    });
});
//# sourceMappingURL=memory-key-store.test.js.map