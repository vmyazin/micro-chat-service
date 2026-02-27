import { describe, expect, it } from 'vitest';
import { TreeKEMDecryptionError } from './treekem-errors';
import {
  decryptPathSecret,
  derivePathSecret,
  deriveRootSecret,
  ecdhAgree,
  encryptPathSecret,
  exportPublicKey,
  generateECDHKeyPair,
} from './treekem-crypto';

describe('treekem-crypto', () => {
  describe('generateECDHKeyPair', () => {
    it('produces a key pair with public and private keys', async () => {
      const kp = await generateECDHKeyPair();
      expect(kp.publicKey).toBeDefined();
      expect(kp.privateKey).toBeDefined();
      expect(kp.publicKey.algorithm.name).toBe('ECDH');
      expect(kp.privateKey.algorithm.name).toBe('ECDH');
    });

    it('generates unique key pairs', async () => {
      const kp1 = await generateECDHKeyPair();
      const kp2 = await generateECDHKeyPair();
      const raw1 = await exportPublicKey(kp1.publicKey);
      const raw2 = await exportPublicKey(kp2.publicKey);
      expect(raw1).not.toEqual(raw2);
    });
  });

  describe('ecdhAgree', () => {
    it('two parties derive the same shared secret', async () => {
      const alice = await generateECDHKeyPair();
      const bob = await generateECDHKeyPair();

      const secretAB = await ecdhAgree(alice.privateKey, bob.publicKey);
      const secretBA = await ecdhAgree(bob.privateKey, alice.publicKey);

      expect(secretAB).toEqual(secretBA);
      expect(secretAB.length).toBe(32);
    });

    it('different key pairs produce different shared secrets', async () => {
      const alice = await generateECDHKeyPair();
      const bob = await generateECDHKeyPair();
      const carol = await generateECDHKeyPair();

      const secretAB = await ecdhAgree(alice.privateKey, bob.publicKey);
      const secretAC = await ecdhAgree(alice.privateKey, carol.publicKey);

      expect(secretAB).not.toEqual(secretAC);
    });
  });

  describe('encryptPathSecret / decryptPathSecret', () => {
    it('roundtrips: encrypt then decrypt recovers original secret', async () => {
      const target = await generateECDHKeyPair();
      const pathSecret = crypto.getRandomValues(new Uint8Array(32));

      const encrypted = await encryptPathSecret(
        pathSecret,
        target.publicKey,
        4,
      );
      const decrypted = await decryptPathSecret(encrypted, target.privateKey);

      expect(decrypted).toEqual(pathSecret);
    });

    it('decryption with wrong key fails', async () => {
      const target = await generateECDHKeyPair();
      const wrong = await generateECDHKeyPair();
      const pathSecret = crypto.getRandomValues(new Uint8Array(32));

      const encrypted = await encryptPathSecret(
        pathSecret,
        target.publicKey,
        0,
      );

      await expect(
        decryptPathSecret(encrypted, wrong.privateKey),
      ).rejects.toThrow(TreeKEMDecryptionError);
    });

    it('different encryptions produce different ciphertexts', async () => {
      const target = await generateECDHKeyPair();
      const pathSecret = crypto.getRandomValues(new Uint8Array(32));

      const e1 = await encryptPathSecret(pathSecret, target.publicKey, 0);
      const e2 = await encryptPathSecret(pathSecret, target.publicKey, 0);

      expect(e1.ciphertext).not.toEqual(e2.ciphertext);
    });

    it('stores the target node index', async () => {
      const target = await generateECDHKeyPair();
      const pathSecret = crypto.getRandomValues(new Uint8Array(32));

      const encrypted = await encryptPathSecret(
        pathSecret,
        target.publicKey,
        42,
      );
      expect(encrypted.targetNode).toBe(42);
    });
  });

  describe('derivePathSecret', () => {
    it('is deterministic', async () => {
      const input = crypto.getRandomValues(new Uint8Array(32));
      const s1 = await derivePathSecret(input, 'test-info');
      const s2 = await derivePathSecret(input, 'test-info');
      expect(s1).toEqual(s2);
    });

    it('different inputs produce different outputs', async () => {
      const input1 = crypto.getRandomValues(new Uint8Array(32));
      const input2 = crypto.getRandomValues(new Uint8Array(32));
      const s1 = await derivePathSecret(input1, 'test-info');
      const s2 = await derivePathSecret(input2, 'test-info');
      expect(s1).not.toEqual(s2);
    });

    it('different info strings produce different outputs', async () => {
      const input = crypto.getRandomValues(new Uint8Array(32));
      const s1 = await derivePathSecret(input, 'info-a');
      const s2 = await derivePathSecret(input, 'info-b');
      expect(s1).not.toEqual(s2);
    });
  });

  describe('deriveRootSecret', () => {
    it('is deterministic', async () => {
      const rootPathSecret = crypto.getRandomValues(new Uint8Array(32));
      const s1 = await deriveRootSecret(rootPathSecret);
      const s2 = await deriveRootSecret(rootPathSecret);
      expect(s1).toEqual(s2);
    });

    it('returns 32 bytes', async () => {
      const rootPathSecret = crypto.getRandomValues(new Uint8Array(32));
      const secret = await deriveRootSecret(rootPathSecret);
      expect(secret.length).toBe(32);
    });
  });

  describe('exportPublicKey', () => {
    it('exports the public key as bytes', async () => {
      const kp = await generateECDHKeyPair();
      const raw = await exportPublicKey(kp.publicKey);
      expect(raw).toBeInstanceOf(Uint8Array);
      // P-256 uncompressed point: 65 bytes (0x04 || x || y)
      expect(raw.length).toBe(65);
    });
  });
});
