import { describe, it, expect, beforeEach } from 'vitest';
import type { GroupId } from '@microchat/shared';
import { CryptoErasureService, CryptoErasureError } from './crypto-erasure';
import { MemoryKeyStore } from './memory-key-store';

describe('CryptoErasureService', () => {
  let keyStore: MemoryKeyStore;
  let erasureService: CryptoErasureService;
  const testGroupId = 'group-123' as GroupId;

  beforeEach(() => {
    keyStore = new MemoryKeyStore();
    erasureService = new CryptoErasureService(keyStore);
  });

  describe('eraseGroup', () => {
    it('deletes all keys for a group and returns audit entry', async () => {
      await keyStore.storeKey(testGroupId, 1, new Uint8Array([1, 2, 3]));
      await keyStore.storeKey(testGroupId, 2, new Uint8Array([4, 5, 6]));

      const auditEntry = await erasureService.eraseGroup(testGroupId);

      expect(auditEntry.groupId).toBe(testGroupId);
      expect(auditEntry.keyCount).toBe(2);
      expect(auditEntry.timestamp).toBeInstanceOf(Date);
    });

    it('returns keyCount 0 for group with no keys', async () => {
      const auditEntry = await erasureService.eraseGroup(testGroupId);

      expect(auditEntry.keyCount).toBe(0);
    });

    it('marks group as erased', async () => {
      expect(erasureService.isErased(testGroupId)).toBe(false);

      await erasureService.eraseGroup(testGroupId);

      expect(erasureService.isErased(testGroupId)).toBe(true);
    });
  });

  describe('isErased', () => {
    it('returns false for non-erased group', () => {
      expect(erasureService.isErased(testGroupId)).toBe(false);
    });

    it('returns true for erased group', async () => {
      await erasureService.eraseGroup(testGroupId);
      expect(erasureService.isErased(testGroupId)).toBe(true);
    });
  });

  describe('assertNotErased', () => {
    it('does not throw for non-erased group', () => {
      expect(() => erasureService.assertNotErased(testGroupId)).not.toThrow();
    });

    it('throws CryptoErasureError for erased group', async () => {
      await erasureService.eraseGroup(testGroupId);

      expect(() => erasureService.assertNotErased(testGroupId)).toThrow(
        CryptoErasureError
      );
    });

    it('includes groupId in error', async () => {
      await erasureService.eraseGroup(testGroupId);

      try {
        erasureService.assertNotErased(testGroupId);
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(CryptoErasureError);
        expect((e as CryptoErasureError).groupId).toBe(testGroupId);
        expect((e as CryptoErasureError).message).toContain(testGroupId);
      }
    });
  });

  describe('CryptoErasureError', () => {
    it('has correct name and message', () => {
      const error = new CryptoErasureError(testGroupId);
      expect(error.name).toBe('CryptoErasureError');
      expect(error.message).toBe(`Keys for group ${testGroupId} have been erased`);
      expect(error.groupId).toBe(testGroupId);
    });

    it('accepts custom message', () => {
      const error = new CryptoErasureError(testGroupId, 'Custom message');
      expect(error.message).toBe('Custom message');
    });
  });

  describe('attempting to decrypt after erasure', () => {
    it('fails to get keys after erasure', async () => {
      await keyStore.storeKey(testGroupId, 1, new Uint8Array([1, 2, 3]));

      await erasureService.eraseGroup(testGroupId);

      const key = await keyStore.getKey(testGroupId, 1);
      expect(key).toBeNull();
    });
  });
});
