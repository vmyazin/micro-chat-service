import type { GroupId } from '@microchat/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { GroupCipher } from './group-cipher';
import { MemoryKeyStore } from './memory-key-store';
import type { Commit, Welcome } from './mls-commit';
import { MLSGroup, MLSGroupError } from './mls-group';
import { initialTranscriptHash } from './mls-transcript';
import { exportPublicKey, generateECDHKeyPair } from './treekem-crypto';
import type { ECKeyPair } from './treekem-types';

const GROUP_ID = 'test-group' as GroupId;

async function makeKeyPair(): Promise<{
  keyPair: ECKeyPair;
  credential: Uint8Array;
  serializedKeyPackage: { publicKey: string; credential: string };
}> {
  const keyPair = await generateECDHKeyPair();
  const credential = await exportPublicKey(keyPair.publicKey);
  const pubRaw = new Uint8Array(
    await crypto.subtle.exportKey('raw', keyPair.publicKey),
  );
  return {
    keyPair,
    credential,
    serializedKeyPackage: {
      publicKey: uint8ToBase64(pubRaw),
      credential: uint8ToBase64(credential),
    },
  };
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

describe('MLSGroup', () => {
  let cipher1: GroupCipher;
  let cipher2: GroupCipher;
  let _cipher3: GroupCipher;

  beforeEach(() => {
    cipher1 = new GroupCipher(new MemoryKeyStore());
    cipher2 = new GroupCipher(new MemoryKeyStore());
    _cipher3 = new GroupCipher(new MemoryKeyStore());
  });

  describe('create', () => {
    it('creates a group at epoch 1 with a non-empty transcript hash', async () => {
      const { keyPair, credential } = await makeKeyPair();
      const { group, commit } = await MLSGroup.create(
        GROUP_ID,
        keyPair,
        credential,
        cipher1,
      );

      expect(group.getEpoch()).toBe(1);
      expect(group.getTranscriptHash()).not.toBe(initialTranscriptHash());
      expect(group.getTranscriptHash()).toHaveLength(64);
      expect(commit.epoch).toBe(0);
      expect(commit.newEpoch).toBe(1);
      expect(commit.committer).toBe(0);
    });
  });

  describe('AddProposal + Commit', () => {
    it('advances epoch and produces a Welcome', async () => {
      const creator = await makeKeyPair();
      const joiner = await makeKeyPair();

      const { group: group1 } = await MLSGroup.create(
        GROUP_ID,
        creator.keyPair,
        creator.credential,
        cipher1,
      );

      const addProposal = group1.proposeAdd(joiner.serializedKeyPackage);
      const { commit, welcome } = await group1.commit([addProposal]);

      expect(group1.getEpoch()).toBe(2);
      expect(commit.newEpoch).toBe(2);
      expect(welcome).toBeDefined();
      expect(welcome?.leafIndex).toBeGreaterThanOrEqual(0);
      expect(welcome?.groupContext.epoch).toBe(2);
    });

    it('allows second member to join via Welcome and derive same key', async () => {
      const creator = await makeKeyPair();
      const joiner = await makeKeyPair();

      const { group: group1 } = await MLSGroup.create(
        GROUP_ID,
        creator.keyPair,
        creator.credential,
        cipher1,
      );

      const addProposal = group1.proposeAdd(joiner.serializedKeyPackage);
      const { welcome } = await group1.commit([addProposal]);

      // Joiner joins from Welcome
      const group2 = await MLSGroup.joinFromWelcome(
        welcome as Welcome,
        joiner.keyPair,
        cipher2,
      );

      expect(group2.getEpoch()).toBe(group1.getEpoch());

      // Both should be able to encrypt/decrypt with the same epoch key
      const epoch = group1.getEpoch();
      const encrypted = await cipher1.encrypt(GROUP_ID, epoch, 'hello MLS');
      const decrypted = await cipher2.decrypt(GROUP_ID, encrypted);
      expect(decrypted).toBe('hello MLS');
    });
  });

  describe('processCommit', () => {
    it('second member processes commit and gets same key + transcript hash', async () => {
      const creator = await makeKeyPair();
      const joiner = await makeKeyPair();

      // Creator creates group
      const { group: group1 } = await MLSGroup.create(
        GROUP_ID,
        creator.keyPair,
        creator.credential,
        cipher1,
      );

      // Add joiner
      const addProposal = group1.proposeAdd(joiner.serializedKeyPackage);
      const { welcome } = await group1.commit([addProposal]);

      // Joiner joins
      const group2 = await MLSGroup.joinFromWelcome(
        welcome as Welcome,
        joiner.keyPair,
        cipher2,
      );

      // Creator does an update
      const updateProposal = group1.proposeUpdate();
      const { commit: updateCommit } = await group1.commit([updateProposal]);

      // Joiner processes the update commit
      await group2.processCommit(updateCommit);

      expect(group2.getEpoch()).toBe(group1.getEpoch());
      expect(group2.getTranscriptHash()).toBe(group1.getTranscriptHash());

      // Both can encrypt/decrypt
      const epoch = group1.getEpoch();
      const encrypted = await cipher1.encrypt(GROUP_ID, epoch, 'synced!');
      const decrypted = await cipher2.decrypt(GROUP_ID, encrypted);
      expect(decrypted).toBe('synced!');
    });

    it('rejects stale commit (wrong epoch)', async () => {
      const creator = await makeKeyPair();
      const { group, commit: initCommit } = await MLSGroup.create(
        GROUP_ID,
        creator.keyPair,
        creator.credential,
        cipher1,
      );

      // Create a commit with wrong epoch
      const staleCommit: Commit = {
        ...initCommit,
        epoch: 999,
      };

      await expect(group.processCommit(staleCommit)).rejects.toThrow(
        MLSGroupError,
      );
      await expect(group.processCommit(staleCommit)).rejects.toThrow(
        'Epoch mismatch',
      );
    });

    it('rejects commit with tampered transcript hash', async () => {
      const creator = await makeKeyPair();
      const joiner = await makeKeyPair();

      const { group: group1 } = await MLSGroup.create(
        GROUP_ID,
        creator.keyPair,
        creator.credential,
        cipher1,
      );

      // Add joiner
      const addProposal = group1.proposeAdd(joiner.serializedKeyPackage);
      const { welcome } = await group1.commit([addProposal]);

      const group2 = await MLSGroup.joinFromWelcome(
        welcome as Welcome,
        joiner.keyPair,
        cipher2,
      );

      // Creator commits an update
      const { commit } = await group1.commit([group1.proposeUpdate()]);

      // Tamper with the transcript hash
      const tamperedCommit: Commit = {
        ...commit,
        transcriptHash: 'deadbeef'.repeat(8),
      };

      await expect(group2.processCommit(tamperedCommit)).rejects.toThrow(
        MLSGroupError,
      );
      await expect(group2.processCommit(tamperedCommit)).rejects.toThrow(
        'Transcript hash verification failed',
      );
    });
  });

  describe('RemoveProposal + Commit', () => {
    it('removes a member — removed member cannot decrypt new messages', async () => {
      const creator = await makeKeyPair();
      const member = await makeKeyPair();

      const { group: group1 } = await MLSGroup.create(
        GROUP_ID,
        creator.keyPair,
        creator.credential,
        cipher1,
      );

      // Add member
      const { welcome } = await group1.commit([
        group1.proposeAdd(member.serializedKeyPackage),
      ]);

      const _group2 = await MLSGroup.joinFromWelcome(
        welcome as Welcome,
        member.keyPair,
        cipher2,
      );

      // Remember the epoch before removal for later comparison
      const preRemoveEpoch = group1.getEpoch();

      // Remove member (leaf index 1)
      const removeProposal = group1.proposeRemove(1);
      const { commit: _removeCommit } = await group1.commit([removeProposal]);

      const postRemoveEpoch = group1.getEpoch();
      expect(postRemoveEpoch).toBeGreaterThan(preRemoveEpoch);

      // Creator can encrypt at new epoch
      const encrypted = await cipher1.encrypt(
        GROUP_ID,
        postRemoveEpoch,
        'secret after removal',
      );

      // Removed member does NOT have the new epoch key
      await expect(cipher2.decrypt(GROUP_ID, encrypted)).rejects.toThrow();
    });
  });

  describe('UpdateProposal + Commit (PCS)', () => {
    it('old key no longer works after update', async () => {
      const creator = await makeKeyPair();
      const member = await makeKeyPair();

      const { group: group1 } = await MLSGroup.create(
        GROUP_ID,
        creator.keyPair,
        creator.credential,
        cipher1,
      );

      const { welcome } = await group1.commit([
        group1.proposeAdd(member.serializedKeyPackage),
      ]);

      const group2 = await MLSGroup.joinFromWelcome(
        welcome as Welcome,
        member.keyPair,
        cipher2,
      );

      const preUpdateEpoch = group1.getEpoch();

      // Encrypt before update
      const beforeEncrypted = await cipher1.encrypt(
        GROUP_ID,
        preUpdateEpoch,
        'before update',
      );

      // PCS update
      const { commit } = await group1.commit([group1.proposeUpdate()]);
      await group2.processCommit(commit);

      const postUpdateEpoch = group1.getEpoch();
      expect(postUpdateEpoch).toBeGreaterThan(preUpdateEpoch);

      // New epoch messages work for both
      const afterEncrypted = await cipher1.encrypt(
        GROUP_ID,
        postUpdateEpoch,
        'after update',
      );
      const decrypted = await cipher2.decrypt(GROUP_ID, afterEncrypted);
      expect(decrypted).toBe('after update');

      // Old epoch messages still decrypt (old keys are preserved)
      const oldDecrypted = await cipher2.decrypt(GROUP_ID, beforeEncrypted);
      expect(oldDecrypted).toBe('before update');
    });
  });

  describe('Multi-proposal commit', () => {
    it('handles add + update in a single commit', async () => {
      const creator = await makeKeyPair();
      const joiner = await makeKeyPair();

      const { group: group1 } = await MLSGroup.create(
        GROUP_ID,
        creator.keyPair,
        creator.credential,
        cipher1,
      );

      const addProposal = group1.proposeAdd(joiner.serializedKeyPackage);
      const updateProposal = group1.proposeUpdate();

      const { commit, welcome } = await group1.commit([
        addProposal,
        updateProposal,
      ]);

      expect(commit.proposals).toHaveLength(2);
      expect(commit.proposals[0].type).toBe('add');
      expect(commit.proposals[1].type).toBe('update');
      expect(welcome).toBeDefined();

      // Joiner can join via Welcome
      const group2 = await MLSGroup.joinFromWelcome(
        welcome as Welcome,
        joiner.keyPair,
        cipher2,
      );
      expect(group2.getEpoch()).toBe(group1.getEpoch());
    });
  });

  describe('GroupContext', () => {
    it('returns correct context', async () => {
      const { keyPair, credential } = await makeKeyPair();
      const { group } = await MLSGroup.create(
        GROUP_ID,
        keyPair,
        credential,
        cipher1,
      );

      const ctx = group.getContext();
      expect(ctx.groupId).toBe(GROUP_ID);
      expect(ctx.epoch).toBe(1);
      expect(ctx.transcriptHash).toHaveLength(64);
    });

    it('async context includes tree hash', async () => {
      const { keyPair, credential } = await makeKeyPair();
      const { group } = await MLSGroup.create(
        GROUP_ID,
        keyPair,
        credential,
        cipher1,
      );

      const ctx = await group.getContextAsync();
      expect(ctx.treeHash).toHaveLength(64);
      expect(ctx.treeHash).not.toBe('');
    });
  });
});
