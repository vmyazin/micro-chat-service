import { describe, it, expect, beforeEach } from 'vitest';
import type { GroupId } from '@microchat/shared';
import { MemoryKeyStore } from './memory-key-store';

describe('MemoryKeyStore', () => {
  let store: MemoryKeyStore;
  const groupId = 'group-123' as GroupId;
  const testKey = new Uint8Array([1, 2, 3, 4, 5]);

  beforeEach(() => {
    store = new MemoryKeyStore();
  });

  describe('storeKey', () => {
    it('stores a key with metadata', async () => {
      await store.storeKey(groupId, 1, testKey);
      const result = await store.getKey(groupId, 1);

      expect(result).not.toBeNull();
      expect(result!.key).toEqual(testKey);
      expect(result!.metadata.groupId).toBe(groupId);
      expect(result!.metadata.epoch).toBe(1);
      expect(result!.metadata.createdAt).toBeInstanceOf(Date);
    });

    it('overwrites key for same group and epoch', async () => {
      const newKey = new Uint8Array([9, 8, 7, 6, 5]);
      await store.storeKey(groupId, 1, testKey);
      await store.storeKey(groupId, 1, newKey);

      const result = await store.getKey(groupId, 1);
      expect(result!.key).toEqual(newKey);
    });
  });

  describe('getKey', () => {
    it('returns null for non-existent key', async () => {
      const result = await store.getKey(groupId, 999);
      expect(result).toBeNull();
    });

    it('returns stored key with correct metadata', async () => {
      await store.storeKey(groupId, 5, testKey);
      const result = await store.getKey(groupId, 5);

      expect(result).not.toBeNull();
      expect(result!.metadata.epoch).toBe(5);
    });
  });

  describe('deleteKey', () => {
    it('deletes an existing key and returns true', async () => {
      await store.storeKey(groupId, 1, testKey);
      const deleted = await store.deleteKey(groupId, 1);

      expect(deleted).toBe(true);
      expect(await store.getKey(groupId, 1)).toBeNull();
    });

    it('returns false for non-existent key', async () => {
      const deleted = await store.deleteKey(groupId, 999);
      expect(deleted).toBe(false);
    });
  });

  describe('deleteAllGroupKeys', () => {
    it('deletes all keys for a group and returns count', async () => {
      await store.storeKey(groupId, 1, testKey);
      await store.storeKey(groupId, 2, testKey);
      await store.storeKey(groupId, 3, testKey);

      const count = await store.deleteAllGroupKeys(groupId);

      expect(count).toBe(3);
      expect(await store.getKey(groupId, 1)).toBeNull();
      expect(await store.getKey(groupId, 2)).toBeNull();
      expect(await store.getKey(groupId, 3)).toBeNull();
    });

    it('returns 0 for group with no keys', async () => {
      const count = await store.deleteAllGroupKeys('no-keys' as GroupId);
      expect(count).toBe(0);
    });

    it('does not delete keys from other groups', async () => {
      const otherGroup = 'other-group' as GroupId;
      await store.storeKey(groupId, 1, testKey);
      await store.storeKey(otherGroup, 1, testKey);

      await store.deleteAllGroupKeys(groupId);

      expect(await store.getKey(groupId, 1)).toBeNull();
      expect(await store.getKey(otherGroup, 1)).not.toBeNull();
    });
  });
});
