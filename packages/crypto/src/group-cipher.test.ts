import type { GroupId } from '@microchat/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { GroupCipher, GroupCipherError } from './group-cipher';
import { MemoryKeyStore } from './memory-key-store';

describe('GroupCipher', () => {
  let keyStore: MemoryKeyStore;
  let cipher: GroupCipher;
  const groupId = 'test-group' as GroupId;
  const epoch = 1;

  beforeEach(() => {
    keyStore = new MemoryKeyStore();
    cipher = new GroupCipher(keyStore);
  });

  describe('generateGroupKey', () => {
    it('generates a 256-bit key and stores it', async () => {
      const rawKey = await cipher.generateGroupKey(groupId, epoch);

      expect(rawKey).toBeInstanceOf(Uint8Array);
      expect(rawKey.length).toBe(32); // 256 bits

      const stored = await keyStore.getKey(groupId, epoch);
      expect(stored).not.toBeNull();
      expect(stored?.key).toEqual(rawKey);
    });

    it('generates unique keys per invocation', async () => {
      const key1 = await cipher.generateGroupKey(groupId, 1);
      const key2 = await cipher.generateGroupKey(groupId, 2);

      expect(key1).not.toEqual(key2);
    });
  });

  describe('importGroupKey', () => {
    it('imports a valid key', async () => {
      const rawKey = new Uint8Array(32);
      crypto.getRandomValues(rawKey);

      await cipher.importGroupKey(groupId, epoch, rawKey);

      const stored = await keyStore.getKey(groupId, epoch);
      expect(stored).not.toBeNull();
      expect(stored?.key).toEqual(rawKey);
    });

    it('rejects keys with wrong length', async () => {
      const badKey = new Uint8Array(16); // 128 bits, not 256
      await expect(
        cipher.importGroupKey(groupId, epoch, badKey),
      ).rejects.toThrow(GroupCipherError);
    });
  });

  describe('encrypt and decrypt', () => {
    it('encrypts and decrypts a message round-trip', async () => {
      await cipher.generateGroupKey(groupId, epoch);

      const plaintext = 'Hello, encrypted world!';
      const encrypted = await cipher.encrypt(groupId, epoch, plaintext);

      expect(encrypted.ciphertext).toBeTruthy();
      expect(encrypted.nonce).toBeTruthy();
      expect(encrypted.epoch).toBe(epoch);
      // Ciphertext should not equal plaintext
      expect(encrypted.ciphertext).not.toBe(plaintext);

      const decrypted = await cipher.decrypt(groupId, encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('produces different ciphertexts for the same plaintext (random IV)', async () => {
      await cipher.generateGroupKey(groupId, epoch);

      const plaintext = 'Same message twice';
      const encrypted1 = await cipher.encrypt(groupId, epoch, plaintext);
      const encrypted2 = await cipher.encrypt(groupId, epoch, plaintext);

      expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
      expect(encrypted1.nonce).not.toBe(encrypted2.nonce);
    });

    it('handles empty string', async () => {
      await cipher.generateGroupKey(groupId, epoch);

      const encrypted = await cipher.encrypt(groupId, epoch, '');
      const decrypted = await cipher.decrypt(groupId, encrypted);
      expect(decrypted).toBe('');
    });

    it('handles unicode content', async () => {
      await cipher.generateGroupKey(groupId, epoch);

      const plaintext =
        'Hello! Emoji test: \u{1F600}\u{1F680} Chinese: \u4F60\u597D';
      const encrypted = await cipher.encrypt(groupId, epoch, plaintext);
      const decrypted = await cipher.decrypt(groupId, encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('throws when no key exists for encryption', async () => {
      await expect(cipher.encrypt(groupId, epoch, 'test')).rejects.toThrow(
        GroupCipherError,
      );
    });

    it('throws when no key exists for decryption', async () => {
      await cipher.generateGroupKey(groupId, epoch);
      const encrypted = await cipher.encrypt(groupId, epoch, 'test');

      // Try decrypting with a different epoch
      encrypted.epoch = 999;
      await expect(cipher.decrypt(groupId, encrypted)).rejects.toThrow(
        GroupCipherError,
      );
    });

    it('fails to decrypt with wrong key', async () => {
      await cipher.generateGroupKey(groupId, epoch);
      const encrypted = await cipher.encrypt(groupId, epoch, 'secret');

      // Generate a new key for a different group
      const otherGroupId = 'other-group' as GroupId;
      await cipher.generateGroupKey(otherGroupId, epoch);

      await expect(cipher.decrypt(otherGroupId, encrypted)).rejects.toThrow(
        GroupCipherError,
      );
    });

    it('fails to decrypt tampered ciphertext', async () => {
      await cipher.generateGroupKey(groupId, epoch);
      const encrypted = await cipher.encrypt(groupId, epoch, 'secret');

      // Tamper with ciphertext
      const bytes = atob(encrypted.ciphertext);
      const tampered = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) {
        tampered[i] = bytes.charCodeAt(i);
      }
      tampered[0] ^= 0xff; // flip bits
      let binary = '';
      for (let i = 0; i < tampered.length; i++) {
        binary += String.fromCharCode(tampered[i]);
      }
      encrypted.ciphertext = btoa(binary);

      await expect(cipher.decrypt(groupId, encrypted)).rejects.toThrow(
        GroupCipherError,
      );
    });
  });

  describe('deriveGroupKey', () => {
    it('derives a key from shared secret and stores it', async () => {
      const sharedSecret = new Uint8Array(32);
      crypto.getRandomValues(sharedSecret);

      const rawKey = await cipher.deriveGroupKey(groupId, epoch, sharedSecret);

      expect(rawKey).toBeInstanceOf(Uint8Array);
      expect(rawKey.length).toBe(32);

      const stored = await keyStore.getKey(groupId, epoch);
      expect(stored).not.toBeNull();
    });

    it('derives the same key from the same inputs', async () => {
      const sharedSecret = new Uint8Array(32);
      crypto.getRandomValues(sharedSecret);

      const key1 = await cipher.deriveGroupKey(groupId, 1, sharedSecret);

      // Create a second cipher with fresh key store
      const keyStore2 = new MemoryKeyStore();
      const cipher2 = new GroupCipher(keyStore2);
      const key2 = await cipher2.deriveGroupKey(groupId, 1, sharedSecret);

      expect(key1).toEqual(key2);
    });

    it('derives different keys for different groups', async () => {
      const sharedSecret = new Uint8Array(32);
      crypto.getRandomValues(sharedSecret);

      const key1 = await cipher.deriveGroupKey(groupId, epoch, sharedSecret);
      const key2 = await cipher.deriveGroupKey(
        'other-group' as GroupId,
        epoch,
        sharedSecret,
      );

      expect(key1).not.toEqual(key2);
    });

    it('can encrypt/decrypt with a derived key', async () => {
      const sharedSecret = new Uint8Array(32);
      crypto.getRandomValues(sharedSecret);

      await cipher.deriveGroupKey(groupId, epoch, sharedSecret);

      const plaintext = 'Message encrypted with derived key';
      const encrypted = await cipher.encrypt(groupId, epoch, plaintext);
      const decrypted = await cipher.decrypt(groupId, encrypted);
      expect(decrypted).toBe(plaintext);
    });
  });
});
