import type {
  CallId,
  GroupId,
  SealedSenderPayload,
  UserId,
} from '@microchat/shared';
import type { GroupCipher } from './group-cipher';
import { base64ToUint8Array, uint8ArrayToBase64 } from './group-cipher';

const AES_KEY_LENGTH = 256;
const IV_LENGTH = 12;
const SALT_LENGTH = 16;

interface SealedCallIdentity {
  ciphertext: string;
  nonce: string;
}

async function deriveSalt(callId: CallId): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest(
    'SHA-256',
    encoder.encode(`microchat-call-salt-${callId}`),
  );
  return new Uint8Array(hashBuffer).slice(0, SALT_LENGTH);
}

export async function deriveCallSigningKey(
  groupCipher: GroupCipher,
  groupId: GroupId,
  epoch: number,
  callId: CallId,
): Promise<CryptoKey> {
  const rawKey = await groupCipher.getRawKey(groupId, epoch);
  if (!rawKey) {
    throw new Error(`No key found for group ${groupId} epoch ${epoch}`);
  }

  const encoder = new TextEncoder();
  const info = encoder.encode(`microchat-call-${groupId}-${callId}`);
  const salt = await deriveSalt(callId);

  const baseKey = await crypto.subtle.importKey(
    'raw',
    rawKey as unknown as ArrayBuffer,
    'HKDF',
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: salt as unknown as ArrayBuffer,
      info,
    },
    baseKey,
    { name: 'AES-GCM', length: AES_KEY_LENGTH },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptCallerId(
  callerId: UserId,
  callerName: string,
  key: CryptoKey,
): Promise<string> {
  const payload: SealedSenderPayload = {
    senderId: callerId,
    senderName: callerName,
    timestamp: new Date().toISOString(),
  };

  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoder = new TextEncoder();
  const plaintext = encoder.encode(JSON.stringify(payload));

  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintext,
  );

  const sealed: SealedCallIdentity = {
    ciphertext: uint8ArrayToBase64(new Uint8Array(ciphertextBuffer)),
    nonce: uint8ArrayToBase64(iv),
  };

  return JSON.stringify(sealed);
}

export async function decryptCallerId(
  sealed: string,
  key: CryptoKey,
): Promise<SealedSenderPayload> {
  const parsed = JSON.parse(sealed) as SealedCallIdentity;
  if (!parsed.ciphertext || !parsed.nonce) {
    throw new Error('Invalid sealed sender payload');
  }

  const ciphertext = base64ToUint8Array(parsed.ciphertext);
  const iv = base64ToUint8Array(parsed.nonce);

  if (iv.length !== IV_LENGTH) {
    throw new Error(`Invalid nonce length: expected ${IV_LENGTH} bytes`);
  }

  const plaintextBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    ciphertext.buffer as ArrayBuffer,
  );

  const decoder = new TextDecoder();
  const payload = JSON.parse(
    decoder.decode(plaintextBuffer),
  ) as SealedSenderPayload;

  return payload;
}
