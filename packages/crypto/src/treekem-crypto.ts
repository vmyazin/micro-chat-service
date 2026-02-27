import { TreeKEMDecryptionError } from './treekem-errors';
import type {
  ECKeyPair,
  EncryptedPathSecret,
  NodeIndex,
} from './treekem-types';

const ECDH_PARAMS: EcKeyGenParams = { name: 'ECDH', namedCurve: 'P-256' };
const AES_KEY_LENGTH = 256;
const IV_LENGTH = 12;

/** Generate a fresh ECDH P-256 key pair. */
export async function generateECDHKeyPair(): Promise<ECKeyPair> {
  const keyPair = await crypto.subtle.generateKey(ECDH_PARAMS, true, [
    'deriveBits',
  ]);
  return {
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey,
  };
}

/**
 * ECDH key agreement: derive a shared secret from a private key and a peer's public key.
 * Returns raw 32 bytes (P-256 x-coordinate).
 */
export async function ecdhAgree(
  privateKey: CryptoKey,
  publicKey: CryptoKey,
): Promise<Uint8Array> {
  const bits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: publicKey },
    privateKey,
    256,
  );
  return new Uint8Array(bits);
}

/**
 * Derive a path secret using HKDF-SHA-256.
 * Returns 32 bytes of derived key material.
 */
export async function derivePathSecret(
  input: Uint8Array,
  info: string,
): Promise<Uint8Array> {
  const baseKey = await crypto.subtle.importKey('raw', input as any, 'HKDF', false, [
    'deriveBits',
  ]);
  const encoder = new TextEncoder();
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(32),
      info: encoder.encode(info),
    },
    baseKey,
    256,
  );
  return new Uint8Array(bits);
}

/**
 * Encrypt a path secret to a target node's public key using ECDH + AES-GCM.
 *
 * 1. Generate ephemeral ECDH key pair
 * 2. ECDH(ephemeral_private, target_public) -> shared secret
 * 3. HKDF(shared_secret) -> AES-256-GCM key
 * 4. AES-GCM encrypt the path secret
 */
export async function encryptPathSecret(
  pathSecret: Uint8Array,
  targetPublicKey: CryptoKey,
  targetNode: NodeIndex,
): Promise<EncryptedPathSecret> {
  const ephemeral = await generateECDHKeyPair();
  const sharedSecret = await ecdhAgree(ephemeral.privateKey, targetPublicKey);

  const aesKey = await deriveAESKey(sharedSecret);
  const nonce = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce as any },
    aesKey,
    pathSecret as any,
  );

  return {
    targetNode,
    ciphertext: new Uint8Array(ciphertext),
    ephemeralPublicKey: ephemeral.publicKey,
    nonce,
  };
}

/**
 * Decrypt a path secret using our private key.
 *
 * 1. ECDH(our_private, ephemeral_public) -> shared secret
 * 2. HKDF(shared_secret) -> AES-256-GCM key
 * 3. AES-GCM decrypt
 */
export async function decryptPathSecret(
  encrypted: EncryptedPathSecret,
  recipientPrivateKey: CryptoKey,
): Promise<Uint8Array> {
  const sharedSecret = await ecdhAgree(
    recipientPrivateKey,
    encrypted.ephemeralPublicKey,
  );

  const aesKey = await deriveAESKey(sharedSecret);

  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: encrypted.nonce as any },
      aesKey,
      encrypted.ciphertext as any,
    );
    return new Uint8Array(plaintext);
  } catch {
    throw new TreeKEMDecryptionError(
      'Failed to decrypt path secret: wrong key or tampered data',
    );
  }
}

/**
 * Derive the root/group secret from the root node's path secret.
 * Uses HKDF with a distinct info string to produce a 32-byte secret
 * suitable for GroupCipher.deriveGroupKey().
 */
export async function deriveRootSecret(
  rootPathSecret: Uint8Array,
): Promise<Uint8Array> {
  return derivePathSecret(rootPathSecret, 'treekem-root-secret');
}

/** Export a CryptoKey (public) to raw bytes. */
export async function exportPublicKey(key: CryptoKey): Promise<Uint8Array> {
  const raw = await crypto.subtle.exportKey('raw', key);
  return new Uint8Array(raw);
}

/** Derive an AES-256-GCM key from an ECDH shared secret via HKDF. */
async function deriveAESKey(sharedSecret: Uint8Array): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    sharedSecret as any,
    'HKDF',
    false,
    ['deriveKey'],
  );
  const encoder = new TextEncoder();
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(32),
      info: encoder.encode('treekem-path-encrypt'),
    },
    baseKey,
    { name: 'AES-GCM', length: AES_KEY_LENGTH },
    false,
    ['encrypt', 'decrypt'],
  );
}
