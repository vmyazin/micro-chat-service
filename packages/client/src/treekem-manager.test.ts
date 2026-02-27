import type { Commit, ECKeyPair, KeyPackage, Welcome } from '@microchat/crypto';
import {
  exportPublicKey,
  GroupCipher,
  generateECDHKeyPair,
  MemoryKeyStore,
} from '@microchat/crypto';
import type { GroupId } from '@microchat/shared';
import { beforeEach, describe, expect, it } from 'vitest';
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

    it('returns a serialized commit as a string', async () => {
      const kp = await makeKeyPackage();
      const update = await manager.initGroup(
        GROUP_ID,
        kp.keyPair,
        kp.keyPackage.credential,
        [],
      );

      expect(typeof update.commit).toBe('string');
      // It should be valid JSON containing a Commit
      const commit = JSON.parse(update.commit) as Commit;
      expect(commit.epoch).toBe(0);
      expect(commit.newEpoch).toBe(1);
      expect(commit.committer).toBe(0);
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
      expect(rawKey?.length).toBe(32);
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
      await expect(manager.update('unknown' as GroupId)).rejects.toThrow(
        'No MLS group state',
      );
    });
  });

  describe('two managers: commit-based sync', () => {
    it('second manager can join via welcome and derive same key', async () => {
      const creator = await makeKeyPackage();
      const m1 = await makeKeyPackage();

      // Creator initializes
      await manager.initGroup(
        GROUP_ID,
        creator.keyPair,
        creator.keyPackage.credential,
        [],
      );

      // Add member 1
      const addResult = await manager.addMember(GROUP_ID, m1.keyPackage);

      // Member 1 joins from Welcome
      const m1KeyStore = new MemoryKeyStore();
      const m1Cipher = new GroupCipher(m1KeyStore);
      const m1Manager = new TreeKEMManager(m1Cipher);

      expect(addResult.welcome).toBeDefined();
      await m1Manager.joinFromWelcome(
        GROUP_ID,
        addResult.welcome as string,
        m1.keyPair,
      );

      // Both should have the same epoch
      expect(manager.getEpoch(GROUP_ID)).toBe(m1Manager.getEpoch(GROUP_ID));

      // Both should have derived the same key
      const epoch = manager.getEpoch(GROUP_ID);
      const creatorKey = await cipher.getRawKey(GROUP_ID, epoch);
      const m1Key = await m1Cipher.getRawKey(GROUP_ID, epoch);
      expect(creatorKey).toEqual(m1Key);
    });

    it('encrypt/decrypt works across managers after sync', async () => {
      const creator = await makeKeyPackage();
      const m1 = await makeKeyPackage();

      await manager.initGroup(
        GROUP_ID,
        creator.keyPair,
        creator.keyPackage.credential,
        [],
      );

      const addResult = await manager.addMember(GROUP_ID, m1.keyPackage);

      const m1KeyStore = new MemoryKeyStore();
      const m1Cipher = new GroupCipher(m1KeyStore);
      const m1Manager = new TreeKEMManager(m1Cipher);

      await m1Manager.joinFromWelcome(
        GROUP_ID,
        addResult.welcome as string,
        m1.keyPair,
      );

      // Creator encrypts
      const epoch = manager.getEpoch(GROUP_ID);
      const encrypted = await cipher.encrypt(
        GROUP_ID,
        epoch,
        'hello from creator',
      );

      // Member 1 decrypts
      const decrypted = await m1Cipher.decrypt(GROUP_ID, encrypted);
      expect(decrypted).toBe('hello from creator');
    });

    it('processCommit syncs epoch and key', async () => {
      const creator = await makeKeyPackage();
      const m1 = await makeKeyPackage();

      await manager.initGroup(
        GROUP_ID,
        creator.keyPair,
        creator.keyPackage.credential,
        [],
      );

      // Add and join
      const addResult = await manager.addMember(GROUP_ID, m1.keyPackage);
      const m1KeyStore = new MemoryKeyStore();
      const m1Cipher = new GroupCipher(m1KeyStore);
      const m1Manager = new TreeKEMManager(m1Cipher);
      await m1Manager.joinFromWelcome(
        GROUP_ID,
        addResult.welcome as string,
        m1.keyPair,
      );

      // Creator does an update
      const updateResult = await manager.update(GROUP_ID);

      // Member 1 processes the commit
      await m1Manager.processCommit(GROUP_ID, updateResult.commit);

      // Both at same epoch
      expect(manager.getEpoch(GROUP_ID)).toBe(m1Manager.getEpoch(GROUP_ID));

      // Both can encrypt/decrypt
      const epoch = manager.getEpoch(GROUP_ID);
      const encrypted = await cipher.encrypt(GROUP_ID, epoch, 'synced!');
      const decrypted = await m1Cipher.decrypt(GROUP_ID, encrypted);
      expect(decrypted).toBe('synced!');
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
      const addResult = await manager.addMember(GROUP_ID, newMember.keyPackage);

      expect(addResult.epoch).toBe(2);
      expect(addResult.newLeafIndex).toBeDefined();
      expect(manager.getEpoch(GROUP_ID)).toBe(2);
    });

    it('produces a Welcome message for the new member', async () => {
      const creator = await makeKeyPackage();

      await manager.initGroup(
        GROUP_ID,
        creator.keyPair,
        creator.keyPackage.credential,
        [],
      );

      const newMember = await makeKeyPackage();
      const addResult = await manager.addMember(GROUP_ID, newMember.keyPackage);

      expect(addResult.welcome).toBeDefined();
      const welcome = JSON.parse(addResult.welcome as string) as Welcome;
      expect(welcome.groupId).toBe(GROUP_ID);
      expect(welcome.epoch).toBe(2);
      expect(welcome.leafIndex).toBeGreaterThanOrEqual(0);
    });

    it('new member can join via Welcome and decrypt messages', async () => {
      const creator = await makeKeyPackage();

      await manager.initGroup(
        GROUP_ID,
        creator.keyPair,
        creator.keyPackage.credential,
        [],
      );

      const newMember = await makeKeyPackage();
      const addResult = await manager.addMember(GROUP_ID, newMember.keyPackage);

      const nmKeyStore = new MemoryKeyStore();
      const nmCipher = new GroupCipher(nmKeyStore);
      const nmManager = new TreeKEMManager(nmCipher);

      await nmManager.joinFromWelcome(
        GROUP_ID,
        addResult.welcome as string,
        newMember.keyPair,
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
        [],
      );

      // Add member first
      await manager.addMember(GROUP_ID, m1.keyPackage);

      const removeResult = await manager.removeMember(GROUP_ID, 1);
      expect(removeResult.epoch).toBe(3);
      expect(manager.getEpoch(GROUP_ID)).toBe(3);
    });

    it('removed member cannot decrypt new messages', async () => {
      const creator = await makeKeyPackage();
      const m1 = await makeKeyPackage();

      await manager.initGroup(
        GROUP_ID,
        creator.keyPair,
        creator.keyPackage.credential,
        [],
      );

      // Add member 1 and let them join
      const addResult = await manager.addMember(GROUP_ID, m1.keyPackage);
      const m1KeyStore = new MemoryKeyStore();
      const m1Cipher = new GroupCipher(m1KeyStore);
      const m1Manager = new TreeKEMManager(m1Cipher);
      await m1Manager.joinFromWelcome(
        GROUP_ID,
        addResult.welcome as string,
        m1.keyPair,
      );

      // Creator removes member 1 and advances epoch
      const removeResult = await manager.removeMember(GROUP_ID, 1);

      // Creator encrypts at new epoch
      const encrypted = await cipher.encrypt(
        GROUP_ID,
        removeResult.epoch,
        'secret after removal',
      );

      // Member 1 doesn't have the new epoch key — should fail
      await expect(m1Cipher.decrypt(GROUP_ID, encrypted)).rejects.toThrow();
    });
  });

  describe('processCommit', () => {
    it('throws for unknown groups', async () => {
      await expect(
        manager.processCommit('unknown' as GroupId, '{}'),
      ).rejects.toThrow('No MLS group state');
    });
  });

  describe('getContext', () => {
    it('returns context for an initialized group', async () => {
      const kp = await makeKeyPackage();
      await manager.initGroup(
        GROUP_ID,
        kp.keyPair,
        kp.keyPackage.credential,
        [],
      );

      const ctx = manager.getContext(GROUP_ID);
      expect(ctx).toBeDefined();
      expect(ctx?.groupId).toBe(GROUP_ID);
      expect(ctx?.epoch).toBe(1);
      expect(ctx?.transcriptHash).toHaveLength(64);
    });

    it('returns undefined for unknown groups', () => {
      expect(manager.getContext('unknown' as GroupId)).toBeUndefined();
    });
  });

  describe('multiple groups', () => {
    it('manages independent trees for different groups', async () => {
      const groupA = 'group-a' as GroupId;
      const groupB = 'group-b' as GroupId;

      const kpA = await makeKeyPackage();
      const kpB = await makeKeyPackage();

      await manager.initGroup(
        groupA,
        kpA.keyPair,
        kpA.keyPackage.credential,
        [],
      );
      await manager.initGroup(
        groupB,
        kpB.keyPair,
        kpB.keyPackage.credential,
        [],
      );

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
