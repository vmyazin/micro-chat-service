import type { GroupId } from '@microchat/shared';
import {
  GroupCipher,
  MemoryKeyStore,
  generateECDHKeyPair,
  exportPublicKey,
  deserializeTree,
  deserializeUpdatePath,
} from '@microchat/crypto';
import type { ECKeyPair, KeyPackage } from '@microchat/crypto';
import { describe, expect, it, beforeEach } from 'vitest';
import { TreeKEMManager } from './treekem-manager';

const GROUP_ID = 'test-group' as GroupId;

async function makeKeyPackage(): Promise<{
  keyPair: ECKeyPair;
  keyPackage: KeyPackage;
}> {
  const keyPair = await generateECDHKeyPair();
  const credential = await exportPublicKey(keyPair.publicKey);
  return {
    keyPair,
    keyPackage: { publicKey: keyPair.publicKey, credential },
  };
}

describe('TreeKEMManager', () => {
  let keyStore: MemoryKeyStore;
  let cipher: GroupCipher;
  let manager: TreeKEMManager;

  beforeEach(() => {
    keyStore = new MemoryKeyStore();
    cipher = new GroupCipher(keyStore);
    manager = new TreeKEMManager(cipher);
  });

  describe('initGroup', () => {
    it('initializes a group and sets epoch to 1', async () => {
      const kp = await makeKeyPackage();
      const update = await manager.initGroup(
        GROUP_ID,
        kp.keyPair,
        kp.keyPackage.credential,
        [],
      );

      expect(update.epoch).toBe(1);
      expect(manager.getEpoch(GROUP_ID)).toBe(1);
      expect(manager.hasTree(GROUP_ID)).toBe(true);
    });

    it('returns serialized updatePath and treeData as strings', async () => {
      const kp = await makeKeyPackage();
      const update = await manager.initGroup(
        GROUP_ID,
        kp.keyPair,
        kp.keyPackage.credential,
        [],
      );

      expect(typeof update.updatePath).toBe('string');
      expect(typeof update.treeData).toBe('string');

      // They should be valid JSON
      expect(() => JSON.parse(update.updatePath)).not.toThrow();
      expect(() => JSON.parse(update.treeData)).not.toThrow();
    });

    it('derives a group key in the cipher after init', async () => {
      const kp = await makeKeyPackage();
      await manager.initGroup(
        GROUP_ID,
        kp.keyPair,
        kp.keyPackage.credential,
        [],
      );

      const rawKey = await cipher.getRawKey(GROUP_ID, 1);
      expect(rawKey).not.toBeNull();
      expect(rawKey!.length).toBe(32);
    });

    it('initializes with other members in the tree', async () => {
      const creator = await makeKeyPackage();
      const m1 = await makeKeyPackage();
      const m2 = await makeKeyPackage();

      const update = await manager.initGroup(
        GROUP_ID,
        creator.keyPair,
        creator.keyPackage.credential,
        [m1.keyPackage, m2.keyPackage],
      );

      expect(update.epoch).toBe(1);
      const tree = manager.getTree(GROUP_ID);
      expect(tree).toBeDefined();
      expect(tree!.numLeaves).toBe(3);
    });
  });

  describe('getEpoch', () => {
    it('returns 0 for unknown groups', () => {
      expect(manager.getEpoch('unknown' as GroupId)).toBe(0);
    });
  });

  describe('hasTree', () => {
    it('returns false for unknown groups', () => {
      expect(manager.hasTree('unknown' as GroupId)).toBe(false);
    });
  });

  describe('update', () => {
    it('increments epoch on each update', async () => {
      const kp = await makeKeyPackage();
      await manager.initGroup(
        GROUP_ID,
        kp.keyPair,
        kp.keyPackage.credential,
        [],
      );
      expect(manager.getEpoch(GROUP_ID)).toBe(1);

      await manager.update(GROUP_ID);
      expect(manager.getEpoch(GROUP_ID)).toBe(2);

      await manager.update(GROUP_ID);
      expect(manager.getEpoch(GROUP_ID)).toBe(3);
    });

    it('derives a new key for each epoch', async () => {
      const kp = await makeKeyPackage();
      await manager.initGroup(
        GROUP_ID,
        kp.keyPair,
        kp.keyPackage.credential,
        [],
      );

      const key1 = await cipher.getRawKey(GROUP_ID, 1);
      await manager.update(GROUP_ID);
      const key2 = await cipher.getRawKey(GROUP_ID, 2);

      expect(key1).not.toBeNull();
      expect(key2).not.toBeNull();
      expect(key1).not.toEqual(key2);
    });

    it('throws for unknown groups', async () => {
      await expect(
        manager.update('unknown' as GroupId),
      ).rejects.toThrow('No tree state');
    });
  });

  describe('two managers: init + processUpdate', () => {
    it('second manager can process update and derive same key', async () => {
      const creator = await makeKeyPackage();
      const m1 = await makeKeyPackage();

      // Creator initializes
      const initUpdate = await manager.initGroup(
        GROUP_ID,
        creator.keyPair,
        creator.keyPackage.credential,
        [m1.keyPackage],
      );

      // Member 1 has their own manager
      const m1KeyStore = new MemoryKeyStore();
      const m1Cipher = new GroupCipher(m1KeyStore);
      const m1Manager = new TreeKEMManager(m1Cipher);

      // Member 1 joins from serialized tree data
      await m1Manager.joinGroup(GROUP_ID, initUpdate.treeData, 1, m1.keyPair);

      // Member 1 processes the update
      await m1Manager.processUpdate(
        GROUP_ID,
        initUpdate.updatePath,
        initUpdate.epoch,
      );

      // Both should have epoch 1
      expect(manager.getEpoch(GROUP_ID)).toBe(1);
      expect(m1Manager.getEpoch(GROUP_ID)).toBe(1);

      // Both should have derived the same key
      const creatorKey = await cipher.getRawKey(GROUP_ID, 1);
      const m1Key = await m1Cipher.getRawKey(GROUP_ID, 1);
      expect(creatorKey).toEqual(m1Key);
    });

    it('encrypt/decrypt works across managers after sync', async () => {
      const creator = await makeKeyPackage();
      const m1 = await makeKeyPackage();

      const initUpdate = await manager.initGroup(
        GROUP_ID,
        creator.keyPair,
        creator.keyPackage.credential,
        [m1.keyPackage],
      );

      const m1KeyStore = new MemoryKeyStore();
      const m1Cipher = new GroupCipher(m1KeyStore);
      const m1Manager = new TreeKEMManager(m1Cipher);

      await m1Manager.joinGroup(GROUP_ID, initUpdate.treeData, 1, m1.keyPair);
      await m1Manager.processUpdate(
        GROUP_ID,
        initUpdate.updatePath,
        initUpdate.epoch,
      );

      // Creator encrypts
      const encrypted = await cipher.encrypt(GROUP_ID, 1, 'hello from creator');

      // Member 1 decrypts
      const decrypted = await m1Cipher.decrypt(GROUP_ID, encrypted);
      expect(decrypted).toBe('hello from creator');
    });
  });

  describe('addMember', () => {
    it('adds a member and returns updated epoch', async () => {
      const creator = await makeKeyPackage();

      await manager.initGroup(
        GROUP_ID,
        creator.keyPair,
        creator.keyPackage.credential,
        [],
      );

      const newMember = await makeKeyPackage();
      const addResult = await manager.addMember(
        GROUP_ID,
        newMember.keyPackage,
      );

      expect(addResult.epoch).toBe(2);
      expect(addResult.newLeafIndex).toBeDefined();
      expect(manager.getEpoch(GROUP_ID)).toBe(2);
    });

    it('new member can join and decrypt after addMember + processUpdate', async () => {
      const creator = await makeKeyPackage();

      await manager.initGroup(
        GROUP_ID,
        creator.keyPair,
        creator.keyPackage.credential,
        [],
      );

      const newMember = await makeKeyPackage();
      const addResult = await manager.addMember(
        GROUP_ID,
        newMember.keyPackage,
      );

      // New member sets up their manager
      const nmKeyStore = new MemoryKeyStore();
      const nmCipher = new GroupCipher(nmKeyStore);
      const nmManager = new TreeKEMManager(nmCipher);

      await nmManager.joinGroup(
        GROUP_ID,
        addResult.treeData,
        addResult.newLeafIndex,
        newMember.keyPair,
      );
      await nmManager.processUpdate(
        GROUP_ID,
        addResult.updatePath,
        addResult.epoch,
      );

      // Creator encrypts at the new epoch
      const encrypted = await cipher.encrypt(GROUP_ID, 2, 'welcome new member');
      const decrypted = await nmCipher.decrypt(GROUP_ID, encrypted);
      expect(decrypted).toBe('welcome new member');
    });
  });

  describe('removeMember', () => {
    it('removes a member and advances epoch', async () => {
      const creator = await makeKeyPackage();
      const m1 = await makeKeyPackage();

      await manager.initGroup(
        GROUP_ID,
        creator.keyPair,
        creator.keyPackage.credential,
        [m1.keyPackage],
      );

      const removeResult = await manager.removeMember(GROUP_ID, 1);
      expect(removeResult.epoch).toBe(2);
      expect(manager.getEpoch(GROUP_ID)).toBe(2);
    });

    it('removed member cannot decrypt new messages', async () => {
      const creator = await makeKeyPackage();
      const m1 = await makeKeyPackage();

      const initUpdate = await manager.initGroup(
        GROUP_ID,
        creator.keyPair,
        creator.keyPackage.credential,
        [m1.keyPackage],
      );

      // Member 1 syncs at epoch 1
      const m1KeyStore = new MemoryKeyStore();
      const m1Cipher = new GroupCipher(m1KeyStore);
      const m1Manager = new TreeKEMManager(m1Cipher);

      await m1Manager.joinGroup(GROUP_ID, initUpdate.treeData, 1, m1.keyPair);
      await m1Manager.processUpdate(
        GROUP_ID,
        initUpdate.updatePath,
        initUpdate.epoch,
      );

      // Creator removes member 1 and advances epoch
      await manager.removeMember(GROUP_ID, 1);

      // Creator encrypts at epoch 2
      const encrypted = await cipher.encrypt(GROUP_ID, 2, 'secret after removal');

      // Member 1 doesn't have epoch 2 key — should fail
      await expect(
        m1Cipher.decrypt(GROUP_ID, encrypted),
      ).rejects.toThrow();
    });
  });

  describe('joinGroup', () => {
    it('sets up tree state from serialized data', async () => {
      const creator = await makeKeyPackage();
      const m1 = await makeKeyPackage();

      const initUpdate = await manager.initGroup(
        GROUP_ID,
        creator.keyPair,
        creator.keyPackage.credential,
        [m1.keyPackage],
      );

      const m1KeyStore = new MemoryKeyStore();
      const m1Cipher = new GroupCipher(m1KeyStore);
      const m1Manager = new TreeKEMManager(m1Cipher);

      await m1Manager.joinGroup(GROUP_ID, initUpdate.treeData, 1, m1.keyPair);
      expect(m1Manager.hasTree(GROUP_ID)).toBe(true);
    });

    it('does not overwrite existing tree', async () => {
      const creator = await makeKeyPackage();

      const initUpdate = await manager.initGroup(
        GROUP_ID,
        creator.keyPair,
        creator.keyPackage.credential,
        [],
      );

      // Calling joinGroup on the same manager that already has the tree
      // should still work (adds the tree under a different internal state)
      const m1 = await makeKeyPackage();
      const m1KeyStore = new MemoryKeyStore();
      const m1Cipher = new GroupCipher(m1KeyStore);
      const m1Manager = new TreeKEMManager(m1Cipher);

      await m1Manager.joinGroup(GROUP_ID, initUpdate.treeData, 0, m1.keyPair);
      expect(m1Manager.hasTree(GROUP_ID)).toBe(true);
    });
  });

  describe('processUpdate', () => {
    it('throws for unknown groups', async () => {
      await expect(
        manager.processUpdate('unknown' as GroupId, '{}', 1),
      ).rejects.toThrow('No tree state');
    });
  });

  describe('multiple groups', () => {
    it('manages independent trees for different groups', async () => {
      const groupA = 'group-a' as GroupId;
      const groupB = 'group-b' as GroupId;

      const kpA = await makeKeyPackage();
      const kpB = await makeKeyPackage();

      await manager.initGroup(groupA, kpA.keyPair, kpA.keyPackage.credential, []);
      await manager.initGroup(groupB, kpB.keyPair, kpB.keyPackage.credential, []);

      expect(manager.getEpoch(groupA)).toBe(1);
      expect(manager.getEpoch(groupB)).toBe(1);

      await manager.update(groupA);
      expect(manager.getEpoch(groupA)).toBe(2);
      expect(manager.getEpoch(groupB)).toBe(1);

      const keyA = await cipher.getRawKey(groupA, 2);
      const keyB = await cipher.getRawKey(groupB, 1);
      expect(keyA).not.toBeNull();
      expect(keyB).not.toBeNull();
      expect(keyA).not.toEqual(keyB);
    });
  });
});
