"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const crypto_erasure_1 = require("./crypto-erasure");
const memory_key_store_1 = require("./memory-key-store");
(0, vitest_1.describe)('CryptoErasureService', () => {
    let keyStore;
    let erasureService;
    const testGroupId = 'group-123';
    (0, vitest_1.beforeEach)(() => {
        keyStore = new memory_key_store_1.MemoryKeyStore();
        erasureService = new crypto_erasure_1.CryptoErasureService(keyStore);
    });
    (0, vitest_1.describe)('eraseGroup', () => {
        (0, vitest_1.it)('deletes all keys for a group and returns audit entry', async () => {
            await keyStore.storeKey(testGroupId, 1, new Uint8Array([1, 2, 3]));
            await keyStore.storeKey(testGroupId, 2, new Uint8Array([4, 5, 6]));
            const auditEntry = await erasureService.eraseGroup(testGroupId);
            (0, vitest_1.expect)(auditEntry.groupId).toBe(testGroupId);
            (0, vitest_1.expect)(auditEntry.keyCount).toBe(2);
            (0, vitest_1.expect)(auditEntry.timestamp).toBeInstanceOf(Date);
        });
        (0, vitest_1.it)('returns keyCount 0 for group with no keys', async () => {
            const auditEntry = await erasureService.eraseGroup(testGroupId);
            (0, vitest_1.expect)(auditEntry.keyCount).toBe(0);
        });
        (0, vitest_1.it)('marks group as erased', async () => {
            (0, vitest_1.expect)(erasureService.isErased(testGroupId)).toBe(false);
            await erasureService.eraseGroup(testGroupId);
            (0, vitest_1.expect)(erasureService.isErased(testGroupId)).toBe(true);
        });
    });
    (0, vitest_1.describe)('isErased', () => {
        (0, vitest_1.it)('returns false for non-erased group', () => {
            (0, vitest_1.expect)(erasureService.isErased(testGroupId)).toBe(false);
        });
        (0, vitest_1.it)('returns true for erased group', async () => {
            await erasureService.eraseGroup(testGroupId);
            (0, vitest_1.expect)(erasureService.isErased(testGroupId)).toBe(true);
        });
    });
    (0, vitest_1.describe)('assertNotErased', () => {
        (0, vitest_1.it)('does not throw for non-erased group', () => {
            (0, vitest_1.expect)(() => erasureService.assertNotErased(testGroupId)).not.toThrow();
        });
        (0, vitest_1.it)('throws CryptoErasureError for erased group', async () => {
            await erasureService.eraseGroup(testGroupId);
            (0, vitest_1.expect)(() => erasureService.assertNotErased(testGroupId)).toThrow(crypto_erasure_1.CryptoErasureError);
        });
        (0, vitest_1.it)('includes groupId in error', async () => {
            await erasureService.eraseGroup(testGroupId);
            try {
                erasureService.assertNotErased(testGroupId);
                vitest_1.expect.fail('Should have thrown');
            }
            catch (e) {
                (0, vitest_1.expect)(e).toBeInstanceOf(crypto_erasure_1.CryptoErasureError);
                (0, vitest_1.expect)(e.groupId).toBe(testGroupId);
                (0, vitest_1.expect)(e.message).toContain(testGroupId);
            }
        });
    });
    (0, vitest_1.describe)('CryptoErasureError', () => {
        (0, vitest_1.it)('has correct name and message', () => {
            const error = new crypto_erasure_1.CryptoErasureError(testGroupId);
            (0, vitest_1.expect)(error.name).toBe('CryptoErasureError');
            (0, vitest_1.expect)(error.message).toBe(`Keys for group ${testGroupId} have been erased`);
            (0, vitest_1.expect)(error.groupId).toBe(testGroupId);
        });
        (0, vitest_1.it)('accepts custom message', () => {
            const error = new crypto_erasure_1.CryptoErasureError(testGroupId, 'Custom message');
            (0, vitest_1.expect)(error.message).toBe('Custom message');
        });
    });
    (0, vitest_1.describe)('attempting to decrypt after erasure', () => {
        (0, vitest_1.it)('fails to get keys after erasure', async () => {
            await keyStore.storeKey(testGroupId, 1, new Uint8Array([1, 2, 3]));
            await erasureService.eraseGroup(testGroupId);
            const key = await keyStore.getKey(testGroupId, 1);
            (0, vitest_1.expect)(key).toBeNull();
        });
    });
});
//# sourceMappingURL=crypto-erasure.test.js.map