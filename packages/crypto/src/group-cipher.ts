import type { GroupId } from '@microchat/shared';
import type { KeyStore } from './key-store';

const AES_KEY_LENGTH = 256;
const IV_LENGTH = 12;
const SALT_LENGTH = 16;

export interface EncryptedMessage {
  /** Base64-encoded ciphertext */
  ciphertext: string;
  /** Base64-encoded IV/nonce (12 bytes for AES-GCM) */
  nonce: string;
  /** Epoch of the key used for encryption */
  epoch: number;
}

export class GroupCipher {
  constructor(private readonly keyStore: KeyStore) {}

  /**
   * Generate a new AES-256-GCM key for a group at a given epoch.
   * Returns the raw key bytes for distribution to group members.
   */
  async generateGroupKey(groupId: GroupId, epoch: number): Promise<Uint8Array> {
    const key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: AES_KEY_LENGTH },
      true,
      ['encrypt', 'decrypt'],
    );
    const rawKey = new Uint8Array(await crypto.subtle.exportKey('raw', key));
    await this.keyStore.storeKey(groupId, epoch, rawKey);
    return rawKey;
  }

  /**
   * Import a raw key received from another group member and store it.
   */
  async importGroupKey(
    groupId: GroupId,
    epoch: number,
    rawKey: Uint8Array,
  ): Promise<void> {
    // Validate key length
    if (rawKey.length !== AES_KEY_LENGTH / 8) {
      throw new GroupCipherError(
        `Invalid key length: expected ${AES_KEY_LENGTH / 8} bytes, got ${rawKey.length}`,
      );
    }
    await this.keyStore.storeKey(groupId, epoch, rawKey);
  }

  /**
   * Derive a group key from a shared secret (e.g. from a key agreement).
   * Uses HKDF with a group-specific salt.
   */
  async deriveGroupKey(
    groupId: GroupId,
    epoch: number,
    sharedSecret: Uint8Array,
  ): Promise<Uint8Array> {
    const encoder = new TextEncoder();
    const info = encoder.encode(`microchat-group-${groupId}-epoch-${epoch}`);
    const salt = new Uint8Array(SALT_LENGTH);

    const baseKey = await crypto.subtle.importKey(
      'raw',
      sharedSecret.buffer as ArrayBuffer,
      'HKDF',
      false,
      ['deriveKey'],
    );

    const derivedKey = await crypto.subtle.deriveKey(
      { name: 'HKDF', hash: 'SHA-256', salt, info },
      baseKey,
      { name: 'AES-GCM', length: AES_KEY_LENGTH },
      true,
      ['encrypt', 'decrypt'],
    );

    const rawKey = new Uint8Array(
      await crypto.subtle.exportKey('raw', derivedKey),
    );
    debugGroupCipher(
      'deriveGroupKey',
      `group=${groupId} epoch=${epoch} shared=${shortDigest(sharedSecret)} key=${shortDigest(rawKey)}`,
    );
    await this.keyStore.storeKey(groupId, epoch, rawKey);
    return rawKey;
  }

  /**
   * Encrypt a plaintext message for the group using the current epoch key.
   */
  async encrypt(
    groupId: GroupId,
    epoch: number,
    plaintext: string,
  ): Promise<EncryptedMessage> {
    const stored = await this.keyStore.getKey(groupId, epoch);
    if (!stored) {
      throw new GroupCipherError(
        `No key found for group ${groupId} epoch ${epoch}`,
      );
    }

    const key = await crypto.subtle.importKey(
      'raw',
      stored.key.buffer as ArrayBuffer,
      { name: 'AES-GCM', length: AES_KEY_LENGTH },
      false,
      ['encrypt'],
    );

    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const encoder = new TextEncoder();
    const plaintextBytes = encoder.encode(plaintext);

    const ciphertextBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      plaintextBytes,
    );

    return {
      ciphertext: uint8ArrayToBase64(new Uint8Array(ciphertextBuffer)),
      nonce: uint8ArrayToBase64(iv),
      epoch,
    };
  }

  /**
   * Decrypt an encrypted message using the group key for the given epoch.
   */
  async decrypt(
    groupId: GroupId,
    encrypted: EncryptedMessage,
  ): Promise<string> {
    const stored = await this.keyStore.getKey(groupId, encrypted.epoch);
    if (!stored) {
      debugGroupCipher(
        'decrypt',
        `group=${groupId} epoch=${encrypted.epoch} key=missing`,
      );
      throw new GroupCipherError(
        `No key found for group ${groupId} epoch ${encrypted.epoch}`,
      );
    }
    debugGroupCipher(
      'decrypt',
      `group=${groupId} epoch=${encrypted.epoch} key=${shortDigest(stored.key)}`,
    );

    const key = await crypto.subtle.importKey(
      'raw',
      stored.key.buffer as ArrayBuffer,
      { name: 'AES-GCM', length: AES_KEY_LENGTH },
      false,
      ['decrypt'],
    );

    const ciphertext = base64ToUint8Array(encrypted.ciphertext);
    const iv = base64ToUint8Array(encrypted.nonce);

    if (iv.length !== IV_LENGTH) {
      throw new GroupCipherError(
        `Invalid nonce length: expected ${IV_LENGTH} bytes, got ${iv.length}`,
      );
    }

    try {
      const plaintextBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
        key,
        ciphertext.buffer as ArrayBuffer,
      );

      const decoder = new TextDecoder();
      return decoder.decode(plaintextBuffer);
    } catch {
      throw new GroupCipherError(
        'Decryption failed: message may be tampered with or wrong key',
      );
    }
  }

  /**
   * Retrieve raw group key bytes for a given epoch.
   * Used for deriving ephemeral call signaling keys.
   */
  async getRawKey(groupId: GroupId, epoch: number): Promise<Uint8Array | null> {
    const stored = await this.keyStore.getKey(groupId, epoch);
    return stored ? new Uint8Array(stored.key) : null;
  }
}

export class GroupCipherError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GroupCipherError';
  }
}

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

const TREEKEM_DEBUG_FLAG = '__MICROCHAT_DEBUG_TREEKEM__';

function isTreeKEMDebugEnabled(): boolean {
  return (
    typeof globalThis !== 'undefined' &&
    Boolean((globalThis as Record<string, unknown>)[TREEKEM_DEBUG_FLAG])
  );
}

function debugGroupCipher(scope: string, message: string): void {
  if (!isTreeKEMDebugEnabled()) return;
  console.debug(`[TreeKEM][GroupCipher:${scope}] ${message}`);
}

function shortDigest(bytes: Uint8Array): string {
  let hash = 0;
  for (const byte of bytes) {
    hash = (hash * 31 + byte) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
