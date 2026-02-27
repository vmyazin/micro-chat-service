import type { GroupId } from '@microchat/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { GroupCipher } from './group-cipher';
import { MemoryKeyStore } from './memory-key-store';
import { TreeKEM } from './treekem';
import { generateECDHKeyPair, exportPublicKey } from './treekem-crypto';
import type { ECKeyPair, KeyPackage, RatchetTree } from './treekem-types';

/** Create a KeyPackage from a fresh ECDH key pair. */
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

/**
 * Create a TreeKEM instance for a joining member who received the
 * tree state and UpdatePath from the creator.
 */
function createRecipientTreeKEM(
  tree: RatchetTree,
  leafIndex: number,
  recipientKeyPair: ECKeyPair,
): TreeKEM {
  // Clone tree structure (shallow - shares CryptoKey references which is fine)
  const clonedNodes = tree.nodes.map((node) => {
    if (!node) return null;
    if (node.type === 'leaf') {
      return { ...node, keyPair: node.keyPair ? { ...node.keyPair } : null };
    }
    return {
      ...node,
      keyPair: node.keyPair ? { ...node.keyPair } : null,
      pathSecret: node.pathSecret ? new Uint8Array(node.pathSecret) : null,
      unmergedLeaves: [...node.unmergedLeaves],
    };
  });

  // Set the recipient's private key at their leaf
  const recipientNode = clonedNodes[leafIndex * 2];
  if (recipientNode && recipientNode.type === 'leaf') {
    recipientNode.keyPair = recipientKeyPair;
  }

  // Clear private keys and path secrets that this member shouldn't have
  for (const node of clonedNodes) {
    if (!node) continue;
    if (node.type === 'leaf' && node.index !== leafIndex) {
      if (node.keyPair) {
        node.keyPair = {
          publicKey: node.keyPair.publicKey,
          privateKey: null as unknown as CryptoKey,
        };
      }
    }
    if (node.type === 'parent') {
      if (node.keyPair) {
        node.keyPair = {
          publicKey: node.keyPair.publicKey,
          privateKey: null as unknown as CryptoKey,
        };
      }
      node.pathSecret = null;
    }
  }

  const clonedTree: RatchetTree = {
    nodes: clonedNodes,
    numLeaves: tree.numLeaves,
  };

  return new TreeKEM(clonedTree, leafIndex);
}

describe('TreeKEM', () => {
  describe('createGroup', () => {
    it('creates a tree with correct number of leaves', async () => {
      const creator = await makeKeyPackage();
      const member1 = await makeKeyPackage();

      const { treekem } = await TreeKEM.createGroup(
        creator.keyPair,
        creator.keyPackage.credential,
        [member1.keyPackage],
      );

      expect(treekem.getTree().numLeaves).toBe(2);
      expect(treekem.getMemberCount()).toBe(2);
    });

    it('creator is at leaf 0', async () => {
      const creator = await makeKeyPackage();
      const { treekem } = await TreeKEM.createGroup(
        creator.keyPair,
        creator.keyPackage.credential,
        [],
      );
      expect(treekem.getMyLeafIndex()).toBe(0);
    });

    it('returns an UpdatePath', async () => {
      const creator = await makeKeyPackage();
      const member1 = await makeKeyPackage();

      const { updatePath } = await TreeKEM.createGroup(
        creator.keyPair,
        creator.keyPackage.credential,
        [member1.keyPackage],
      );

      expect(updatePath.sender).toBe(0);
      expect(updatePath.pathPublicKeys.length).toBeGreaterThan(0);
    });
  });

  describe('update', () => {
    it('generates a valid UpdatePath', async () => {
      const creator = await makeKeyPackage();
      const member1 = await makeKeyPackage();

      const { treekem } = await TreeKEM.createGroup(
        creator.keyPair,
        creator.keyPackage.credential,
        [member1.keyPackage],
      );

      const updatePath = await treekem.update();
      expect(updatePath.sender).toBe(0);
      expect(updatePath.pathPublicKeys.length).toBeGreaterThan(0);
    });

    it('after update, deriveGroupSecret returns 32 bytes', async () => {
      const creator = await makeKeyPackage();
      const member1 = await makeKeyPackage();

      const { treekem } = await TreeKEM.createGroup(
        creator.keyPair,
        creator.keyPackage.credential,
        [member1.keyPackage],
      );

      const secret = await treekem.deriveGroupSecret();
      expect(secret.length).toBe(32);
    });
  });

  describe('two-member group', () => {
    it('both members derive the same group secret', async () => {
      const creator = await makeKeyPackage();
      const member1 = await makeKeyPackage();

      // Creator creates the group and performs initial update
      const { treekem: creatorTK, updatePath } = await TreeKEM.createGroup(
        creator.keyPair,
        creator.keyPackage.credential,
        [member1.keyPackage],
      );

      // Member 1 creates their view and processes the UpdatePath
      const member1TK = createRecipientTreeKEM(
        creatorTK.getTree(),
        1,
        member1.keyPair,
      );
      await member1TK.processUpdatePath(updatePath);

      // Both should derive the same group secret
      const creatorSecret = await creatorTK.deriveGroupSecret();
      const member1Secret = await member1TK.deriveGroupSecret();

      expect(creatorSecret).toEqual(member1Secret);
      expect(creatorSecret.length).toBe(32);
    });

    it('group secret changes after each update (forward secrecy)', async () => {
      const creator = await makeKeyPackage();
      const member1 = await makeKeyPackage();

      const { treekem: creatorTK, updatePath: up1 } =
        await TreeKEM.createGroup(
          creator.keyPair,
          creator.keyPackage.credential,
          [member1.keyPackage],
        );

      const member1TK = createRecipientTreeKEM(
        creatorTK.getTree(),
        1,
        member1.keyPair,
      );
      await member1TK.processUpdatePath(up1);

      const secret1 = await creatorTK.deriveGroupSecret();

      // Creator updates again
      const up2 = await creatorTK.update();
      await member1TK.processUpdatePath(up2);

      const secret2 = await creatorTK.deriveGroupSecret();
      const secret2m = await member1TK.deriveGroupSecret();

      // Secrets should differ between epochs
      expect(secret1).not.toEqual(secret2);
      // But both members agree on the new secret
      expect(secret2).toEqual(secret2m);
    });
  });

  describe('four-member group', () => {
    it('all members derive the same secret after creator update', async () => {
      const creator = await makeKeyPackage();
      const m1 = await makeKeyPackage();
      const m2 = await makeKeyPackage();
      const m3 = await makeKeyPackage();

      const { treekem: creatorTK, updatePath } = await TreeKEM.createGroup(
        creator.keyPair,
        creator.keyPackage.credential,
        [m1.keyPackage, m2.keyPackage, m3.keyPackage],
      );

      const tk1 = createRecipientTreeKEM(creatorTK.getTree(), 1, m1.keyPair);
      const tk2 = createRecipientTreeKEM(creatorTK.getTree(), 2, m2.keyPair);
      const tk3 = createRecipientTreeKEM(creatorTK.getTree(), 3, m3.keyPair);

      await tk1.processUpdatePath(updatePath);
      await tk2.processUpdatePath(updatePath);
      await tk3.processUpdatePath(updatePath);

      const s0 = await creatorTK.deriveGroupSecret();
      const s1 = await tk1.deriveGroupSecret();
      const s2 = await tk2.deriveGroupSecret();
      const s3 = await tk3.deriveGroupSecret();

      expect(s0).toEqual(s1);
      expect(s0).toEqual(s2);
      expect(s0).toEqual(s3);
    });
  });

  describe('addMember', () => {
    it('adds a member and all agree on group secret', async () => {
      const creator = await makeKeyPackage();
      const m1 = await makeKeyPackage();

      // Start with a 2-member group
      const { treekem: creatorTK, updatePath: up1 } =
        await TreeKEM.createGroup(
          creator.keyPair,
          creator.keyPackage.credential,
          [m1.keyPackage],
        );

      const tk1 = createRecipientTreeKEM(creatorTK.getTree(), 1, m1.keyPair);
      await tk1.processUpdatePath(up1);

      // Add a third member
      const m2 = await makeKeyPackage();
      const { updatePath: up2, newLeafIndex } = await creatorTK.addMember(
        m2.keyPackage,
      );

      expect(newLeafIndex).toBe(2);
      expect(creatorTK.getMemberCount()).toBe(3);

      // Existing member processes the update
      // First sync the tree structure (new leaf was added)
      const tk1Updated = createRecipientTreeKEM(
        creatorTK.getTree(),
        1,
        m1.keyPair,
      );
      await tk1Updated.processUpdatePath(up2);

      // New member processes the update
      const tk2 = createRecipientTreeKEM(
        creatorTK.getTree(),
        2,
        m2.keyPair,
      );
      await tk2.processUpdatePath(up2);

      const s0 = await creatorTK.deriveGroupSecret();
      const s1 = await tk1Updated.deriveGroupSecret();
      const s2 = await tk2.deriveGroupSecret();

      expect(s0).toEqual(s1);
      expect(s0).toEqual(s2);
    });
  });

  describe('removeMember', () => {
    it('blanks the removed member and ancestors', async () => {
      const creator = await makeKeyPackage();
      const m1 = await makeKeyPackage();
      const m2 = await makeKeyPackage();

      const { treekem: creatorTK, updatePath: up1 } =
        await TreeKEM.createGroup(
          creator.keyPair,
          creator.keyPackage.credential,
          [m1.keyPackage, m2.keyPackage],
        );

      // Remove member 1
      creatorTK.removeMember(1);

      // After remove, the leaf should be blanked
      const tree = creatorTK.getTree();
      const leafNode = tree.nodes[2]; // leaf index 1 = node index 2
      expect(leafNode).not.toBeNull();
      if (leafNode?.type === 'leaf') {
        expect(leafNode.keyPair).toBeNull();
        expect(leafNode.credential).toBeNull();
      }
    });

    it('after remove + update, remaining members agree on new secret', async () => {
      const creator = await makeKeyPackage();
      const m1 = await makeKeyPackage();
      const m2 = await makeKeyPackage();

      const { treekem: creatorTK, updatePath: up1 } =
        await TreeKEM.createGroup(
          creator.keyPair,
          creator.keyPackage.credential,
          [m1.keyPackage, m2.keyPackage],
        );

      const tk2 = createRecipientTreeKEM(creatorTK.getTree(), 2, m2.keyPair);
      await tk2.processUpdatePath(up1);

      const oldSecret = await creatorTK.deriveGroupSecret();

      // Remove member 1, then update
      creatorTK.removeMember(1);
      const up2 = await creatorTK.update();

      // Member 2 processes the update (needs updated tree structure)
      const tk2Updated = createRecipientTreeKEM(
        creatorTK.getTree(),
        2,
        m2.keyPair,
      );
      await tk2Updated.processUpdatePath(up2);

      const newSecret0 = await creatorTK.deriveGroupSecret();
      const newSecret2 = await tk2Updated.deriveGroupSecret();

      // New secret should differ from old
      expect(newSecret0).not.toEqual(oldSecret);
      // Remaining members agree
      expect(newSecret0).toEqual(newSecret2);
    });

    it('cannot remove self', async () => {
      const creator = await makeKeyPackage();
      const m1 = await makeKeyPackage();

      const { treekem: creatorTK } = await TreeKEM.createGroup(
        creator.keyPair,
        creator.keyPackage.credential,
        [m1.keyPackage],
      );

      expect(() => creatorTK.removeMember(0)).toThrow('Cannot remove self');
    });
  });

  describe('deriveGroupSecret', () => {
    it('returns 32 bytes', async () => {
      const creator = await makeKeyPackage();
      const m1 = await makeKeyPackage();

      const { treekem } = await TreeKEM.createGroup(
        creator.keyPair,
        creator.keyPackage.credential,
        [m1.keyPackage],
      );

      const secret = await treekem.deriveGroupSecret();
      expect(secret.length).toBe(32);
    });

    it('changes after every update', async () => {
      const creator = await makeKeyPackage();
      const m1 = await makeKeyPackage();

      const { treekem } = await TreeKEM.createGroup(
        creator.keyPair,
        creator.keyPackage.credential,
        [m1.keyPackage],
      );

      const s1 = await treekem.deriveGroupSecret();
      await treekem.update();
      const s2 = await treekem.deriveGroupSecret();
      await treekem.update();
      const s3 = await treekem.deriveGroupSecret();

      expect(s1).not.toEqual(s2);
      expect(s2).not.toEqual(s3);
      expect(s1).not.toEqual(s3);
    });
  });

  describe('integration with GroupCipher', () => {
    it('TreeKEM group secret feeds into GroupCipher for encrypt/decrypt', async () => {
      const groupId = 'test-group' as GroupId;
      const epoch = 1;

      const creator = await makeKeyPackage();
      const m1 = await makeKeyPackage();

      const { treekem: creatorTK, updatePath } = await TreeKEM.createGroup(
        creator.keyPair,
        creator.keyPackage.credential,
        [m1.keyPackage],
      );

      const member1TK = createRecipientTreeKEM(
        creatorTK.getTree(),
        1,
        m1.keyPair,
      );
      await member1TK.processUpdatePath(updatePath);

      // Both derive the same group secret
      const groupSecret = await creatorTK.deriveGroupSecret();

      // Creator sets up GroupCipher
      const creatorKeyStore = new MemoryKeyStore();
      const creatorCipher = new GroupCipher(creatorKeyStore);
      await creatorCipher.deriveGroupKey(groupId, epoch, groupSecret);

      // Member 1 sets up GroupCipher with the same derived secret
      const m1Secret = await member1TK.deriveGroupSecret();
      const m1KeyStore = new MemoryKeyStore();
      const m1Cipher = new GroupCipher(m1KeyStore);
      await m1Cipher.deriveGroupKey(groupId, epoch, m1Secret);

      // Creator encrypts
      const encrypted = await creatorCipher.encrypt(
        groupId,
        epoch,
        'Hello from TreeKEM!',
      );

      // Member 1 decrypts
      const decrypted = await m1Cipher.decrypt(groupId, encrypted);
      expect(decrypted).toBe('Hello from TreeKEM!');
    });

    it('old ciphertext cannot be decrypted with new epoch key', async () => {
      const groupId = 'test-group' as GroupId;

      const creator = await makeKeyPackage();
      const m1 = await makeKeyPackage();

      const { treekem: creatorTK, updatePath: up1 } =
        await TreeKEM.createGroup(
          creator.keyPair,
          creator.keyPackage.credential,
          [m1.keyPackage],
        );

      // Epoch 1: encrypt a message
      const secret1 = await creatorTK.deriveGroupSecret();
      const ks1 = new MemoryKeyStore();
      const cipher1 = new GroupCipher(ks1);
      await cipher1.deriveGroupKey(groupId, 1, secret1);
      const encrypted = await cipher1.encrypt(groupId, 1, 'epoch 1 message');

      // Epoch 2: TreeKEM update
      await creatorTK.update();
      const secret2 = await creatorTK.deriveGroupSecret();
      const ks2 = new MemoryKeyStore();
      const cipher2 = new GroupCipher(ks2);
      await cipher2.deriveGroupKey(groupId, 2, secret2);

      // Old ciphertext cannot be decrypted with epoch 2 key
      await expect(
        cipher2.decrypt(groupId, { ...encrypted, epoch: 2 }),
      ).rejects.toThrow();
    });
  });
});
