import { describe, expect, it } from 'vitest';
import { GroupCipher } from './group-cipher';
import { MemoryKeyStore } from './memory-key-store';
import { TreeKEM } from './treekem';
import { exportPublicKey, generateECDHKeyPair } from './treekem-crypto';
import {
  deserializeTree,
  deserializeUpdatePath,
  serializeTree,
  serializeUpdatePath,
} from './treekem-serialization';
import type { ECKeyPair, KeyPackage, RatchetTree } from './treekem-types';

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

describe('treekem-serialization', () => {
  describe('serializeTree / deserializeTree', () => {
    it('roundtrips a single-member tree', async () => {
      const creator = await makeKeyPackage();
      const { treekem } = await TreeKEM.createGroup(
        creator.keyPair,
        creator.keyPackage.credential,
        [],
      );

      const json = await serializeTree(treekem.getTree());
      expect(typeof json).toBe('string');

      const restored = await deserializeTree(json);
      expect(restored.numLeaves).toBe(1);
      expect(restored.nodes.length).toBe(treekem.getTree().nodes.length);
    });

    it('roundtrips a multi-member tree preserving structure', async () => {
      const creator = await makeKeyPackage();
      const m1 = await makeKeyPackage();
      const m2 = await makeKeyPackage();

      const { treekem } = await TreeKEM.createGroup(
        creator.keyPair,
        creator.keyPackage.credential,
        [m1.keyPackage, m2.keyPackage],
      );

      const original = treekem.getTree();
      const json = await serializeTree(original);
      const restored = await deserializeTree(json);

      expect(restored.numLeaves).toBe(original.numLeaves);
      expect(restored.nodes.length).toBe(original.nodes.length);

      // Verify node types are preserved
      for (let i = 0; i < original.nodes.length; i++) {
        const orig = original.nodes[i];
        const rest = restored.nodes[i];
        if (orig === null) {
          expect(rest).toBeNull();
        } else {
          expect(rest).not.toBeNull();
          expect(rest?.type).toBe(orig.type);
        }
      }
    });

    it('preserves public keys through roundtrip', async () => {
      const creator = await makeKeyPackage();
      const m1 = await makeKeyPackage();

      const { treekem } = await TreeKEM.createGroup(
        creator.keyPair,
        creator.keyPackage.credential,
        [m1.keyPackage],
      );

      const original = treekem.getTree();
      const json = await serializeTree(original);
      const restored = await deserializeTree(json);

      // Compare the raw public key bytes at leaf 0
      const origLeaf = original.nodes[0];
      const restLeaf = restored.nodes[0];

      if (origLeaf?.type === 'leaf' && restLeaf?.type === 'leaf') {
        const origRaw = await exportPublicKey(origLeaf.keyPair?.publicKey);
        const restRaw = await exportPublicKey(restLeaf.keyPair?.publicKey);
        expect(restRaw).toEqual(origRaw);
      }
    });

    it('strips private keys and path secrets', async () => {
      const creator = await makeKeyPackage();
      const m1 = await makeKeyPackage();

      const { treekem } = await TreeKEM.createGroup(
        creator.keyPair,
        creator.keyPackage.credential,
        [m1.keyPackage],
      );

      const json = await serializeTree(treekem.getTree());
      const parsed = JSON.parse(json);

      // No node should contain privateKey or pathSecret fields
      for (const node of parsed.nodes) {
        if (node === null) continue;
        expect(node).not.toHaveProperty('privateKey');
        expect(node).not.toHaveProperty('pathSecret');
      }
    });

    it('preserves credentials as base64', async () => {
      const creator = await makeKeyPackage();

      const { treekem } = await TreeKEM.createGroup(
        creator.keyPair,
        creator.keyPackage.credential,
        [],
      );

      const original = treekem.getTree();
      const json = await serializeTree(original);
      const restored = await deserializeTree(json);

      const origLeaf = original.nodes[0];
      const restLeaf = restored.nodes[0];

      if (origLeaf?.type === 'leaf' && restLeaf?.type === 'leaf') {
        expect(restLeaf.credential).toEqual(origLeaf.credential);
      }
    });

    it('handles blanked leaves (removed members)', async () => {
      const creator = await makeKeyPackage();
      const m1 = await makeKeyPackage();
      const m2 = await makeKeyPackage();

      const { treekem } = await TreeKEM.createGroup(
        creator.keyPair,
        creator.keyPackage.credential,
        [m1.keyPackage, m2.keyPackage],
      );

      // Remove member 1 (blanks the leaf)
      treekem.removeMember(1);

      const json = await serializeTree(treekem.getTree());
      const restored = await deserializeTree(json);

      // Leaf at index 1 (node index 2) should have null keyPair and credential
      const blankedLeaf = restored.nodes[2];
      expect(blankedLeaf).not.toBeNull();
      if (blankedLeaf?.type === 'leaf') {
        expect(blankedLeaf.keyPair).toBeNull();
        expect(blankedLeaf.credential).toBeNull();
      }
    });

    it('deserialized tree can be used to create a working TreeKEM instance', async () => {
      const creator = await makeKeyPackage();
      const m1 = await makeKeyPackage();

      const { treekem: creatorTK, updatePath } = await TreeKEM.createGroup(
        creator.keyPair,
        creator.keyPackage.credential,
        [m1.keyPackage],
      );

      // Serialize and deserialize the tree
      const json = await serializeTree(creatorTK.getTree());
      const restoredTree = await deserializeTree(json);

      // Create a new TreeKEM for member 1 from the deserialized tree
      // Insert member 1's private key
      const leaf1 = restoredTree.nodes[2]; // leaf index 1 = node index 2
      if (leaf1?.type === 'leaf') {
        leaf1.keyPair = m1.keyPair;
      }

      const restoredTK = new TreeKEM(restoredTree, 1);
      await restoredTK.processUpdatePath(updatePath);

      // Both should derive the same group secret
      const creatorSecret = await creatorTK.deriveGroupSecret();
      const restoredSecret = await restoredTK.deriveGroupSecret();
      expect(restoredSecret).toEqual(creatorSecret);
    });
  });

  describe('serializeUpdatePath / deserializeUpdatePath', () => {
    it('roundtrips an UpdatePath from a two-member group', async () => {
      const creator = await makeKeyPackage();
      const m1 = await makeKeyPackage();

      const { updatePath } = await TreeKEM.createGroup(
        creator.keyPair,
        creator.keyPackage.credential,
        [m1.keyPackage],
      );

      const json = await serializeUpdatePath(updatePath);
      expect(typeof json).toBe('string');

      const restored = await deserializeUpdatePath(json);
      expect(restored.sender).toBe(updatePath.sender);
      expect(restored.pathPublicKeys.length).toBe(
        updatePath.pathPublicKeys.length,
      );
      expect(restored.encryptedPathSecrets.length).toBe(
        updatePath.encryptedPathSecrets.length,
      );
    });

    it('roundtrips an UpdatePath from a four-member group', async () => {
      const creator = await makeKeyPackage();
      const m1 = await makeKeyPackage();
      const m2 = await makeKeyPackage();
      const m3 = await makeKeyPackage();

      const { updatePath } = await TreeKEM.createGroup(
        creator.keyPair,
        creator.keyPackage.credential,
        [m1.keyPackage, m2.keyPackage, m3.keyPackage],
      );

      const json = await serializeUpdatePath(updatePath);
      const restored = await deserializeUpdatePath(json);

      expect(restored.sender).toBe(0);
      expect(restored.pathPublicKeys.length).toBe(
        updatePath.pathPublicKeys.length,
      );

      // Verify public keys match
      for (let i = 0; i < updatePath.pathPublicKeys.length; i++) {
        const origRaw = await exportPublicKey(updatePath.pathPublicKeys[i]);
        const restRaw = await exportPublicKey(restored.pathPublicKeys[i]);
        expect(restRaw).toEqual(origRaw);
      }
    });

    it('deserialized UpdatePath can be processed by a recipient', async () => {
      const creator = await makeKeyPackage();
      const m1 = await makeKeyPackage();

      const { treekem: creatorTK, updatePath } = await TreeKEM.createGroup(
        creator.keyPair,
        creator.keyPackage.credential,
        [m1.keyPackage],
      );

      // Serialize and deserialize the UpdatePath
      const json = await serializeUpdatePath(updatePath);
      const restoredUP = await deserializeUpdatePath(json);

      // Member 1 processes the deserialized UpdatePath
      const tree = creatorTK.getTree();
      const clonedNodes = tree.nodes.map((node) => {
        if (!node) return null;
        if (node.type === 'leaf') {
          return {
            ...node,
            keyPair: node.keyPair ? { ...node.keyPair } : null,
          };
        }
        return {
          ...node,
          keyPair: node.keyPair ? { ...node.keyPair } : null,
          pathSecret: null,
          unmergedLeaves: [...node.unmergedLeaves],
        };
      });
      const leaf1 = clonedNodes[2];
      if (leaf1?.type === 'leaf') {
        leaf1.keyPair = m1.keyPair;
      }
      // Strip private keys from other nodes
      for (const node of clonedNodes) {
        if (!node) continue;
        if (node.type === 'leaf' && node.index !== 1 && node.keyPair) {
          node.keyPair = {
            publicKey: node.keyPair.publicKey,
            privateKey: null as unknown as CryptoKey,
          };
        }
        if (node.type === 'parent' && node.keyPair) {
          node.keyPair = {
            publicKey: node.keyPair.publicKey,
            privateKey: null as unknown as CryptoKey,
          };
        }
      }

      const m1TK = new TreeKEM(
        { nodes: clonedNodes, numLeaves: tree.numLeaves } as RatchetTree,
        1,
      );
      await m1TK.processUpdatePath(restoredUP);

      // Both derive the same secret
      const creatorSecret = await creatorTK.deriveGroupSecret();
      const m1Secret = await m1TK.deriveGroupSecret();
      expect(m1Secret).toEqual(creatorSecret);
    });

    it('preserves encrypted path secret nonces and ciphertexts', async () => {
      const creator = await makeKeyPackage();
      const m1 = await makeKeyPackage();

      const { updatePath } = await TreeKEM.createGroup(
        creator.keyPair,
        creator.keyPackage.credential,
        [m1.keyPackage],
      );

      const json = await serializeUpdatePath(updatePath);
      const restored = await deserializeUpdatePath(json);

      for (let i = 0; i < updatePath.encryptedPathSecrets.length; i++) {
        expect(restored.encryptedPathSecrets[i].length).toBe(
          updatePath.encryptedPathSecrets[i].length,
        );
        for (let j = 0; j < updatePath.encryptedPathSecrets[i].length; j++) {
          const orig = updatePath.encryptedPathSecrets[i][j];
          const rest = restored.encryptedPathSecrets[i][j];
          expect(rest.targetNode).toBe(orig.targetNode);
          expect(rest.ciphertext).toEqual(orig.ciphertext);
          expect(rest.nonce).toEqual(orig.nonce);
        }
      }
    });
  });

  describe('end-to-end serialization flow', () => {
    it('full flow: serialize tree + updatePath, deserialize, process, derive same secret', async () => {
      const creator = await makeKeyPackage();
      const m1 = await makeKeyPackage();
      const m2 = await makeKeyPackage();

      const { treekem: creatorTK, updatePath } = await TreeKEM.createGroup(
        creator.keyPair,
        creator.keyPackage.credential,
        [m1.keyPackage, m2.keyPackage],
      );

      // Simulate sending over the wire: serialize both
      const treeJson = await serializeTree(creatorTK.getTree());
      const upJson = await serializeUpdatePath(updatePath);

      // Member 2 receives and deserializes
      const restoredTree = await deserializeTree(treeJson);
      const restoredUP = await deserializeUpdatePath(upJson);

      // Insert m2's private key at leaf 2 (node index 4)
      const leaf2 = restoredTree.nodes[4];
      if (leaf2?.type === 'leaf') {
        leaf2.keyPair = m2.keyPair;
      }

      // Strip all other private keys
      for (const node of restoredTree.nodes) {
        if (!node) continue;
        if (node.type === 'leaf' && node.index !== 2 && node.keyPair) {
          node.keyPair = {
            publicKey: node.keyPair.publicKey,
            privateKey: null as unknown as CryptoKey,
          };
        }
        if (node.type === 'parent' && node.keyPair) {
          node.keyPair = {
            publicKey: node.keyPair.publicKey,
            privateKey: null as unknown as CryptoKey,
          };
        }
      }

      const m2TK = new TreeKEM(restoredTree, 2);
      await m2TK.processUpdatePath(restoredUP);

      const creatorSecret = await creatorTK.deriveGroupSecret();
      const m2Secret = await m2TK.deriveGroupSecret();
      expect(m2Secret).toEqual(creatorSecret);
    });

    it('serialized tree + GroupCipher: encrypt on creator, decrypt on joiner via deserialized state', async () => {
      const creator = await makeKeyPackage();
      const m1 = await makeKeyPackage();

      const { treekem: creatorTK, updatePath } = await TreeKEM.createGroup(
        creator.keyPair,
        creator.keyPackage.credential,
        [m1.keyPackage],
      );

      // Creator derives key and encrypts
      const groupId = 'ser-test' as import('@microchat/shared').GroupId;
      const epoch = 1;
      const creatorSecret = await creatorTK.deriveGroupSecret();
      const creatorKS = new MemoryKeyStore();
      const creatorCipher = new GroupCipher(creatorKS);
      await creatorCipher.deriveGroupKey(groupId, epoch, creatorSecret);
      const encrypted = await creatorCipher.encrypt(
        groupId,
        epoch,
        'encrypted via serialized tree',
      );

      // Simulate wire: serialize tree + updatePath
      const treeJson = await serializeTree(creatorTK.getTree());
      const upJson = await serializeUpdatePath(updatePath);

      // Member 1 reconstructs from serialized data
      const restoredTree = await deserializeTree(treeJson);
      const restoredUP = await deserializeUpdatePath(upJson);

      const leaf1 = restoredTree.nodes[2];
      if (leaf1?.type === 'leaf') {
        leaf1.keyPair = m1.keyPair;
      }
      for (const node of restoredTree.nodes) {
        if (!node) continue;
        if (node.type === 'leaf' && node.index !== 1 && node.keyPair) {
          node.keyPair = {
            publicKey: node.keyPair.publicKey,
            privateKey: null as unknown as CryptoKey,
          };
        }
        if (node.type === 'parent' && node.keyPair) {
          node.keyPair = {
            publicKey: node.keyPair.publicKey,
            privateKey: null as unknown as CryptoKey,
          };
        }
      }

      const m1TK = new TreeKEM(restoredTree, 1);
      await m1TK.processUpdatePath(restoredUP);

      const m1Secret = await m1TK.deriveGroupSecret();
      const m1KS = new MemoryKeyStore();
      const m1Cipher = new GroupCipher(m1KS);
      await m1Cipher.deriveGroupKey(groupId, epoch, m1Secret);

      const decrypted = await m1Cipher.decrypt(groupId, encrypted);
      expect(decrypted).toBe('encrypted via serialized tree');
    });
  });
});
