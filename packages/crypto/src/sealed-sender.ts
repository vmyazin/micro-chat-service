/**
 * Sealed Sender cryptographic utilities
 *
 * Provides anonymous token generation and verification for Sealed Sender messaging.
 * The server stores only SHA-256 hashes of tokens and cannot link issued tokens
 * to specific messages or users.
 */

const TOKEN_LENGTH = 32; // 32 bytes = 256 bits

export type SealedSenderToken = string & {
  readonly __brand: 'SealedSenderToken';
};

export interface TokenIssuance {
  token: SealedSenderToken;
  groupId: string;
  expiresAt: string;
}

/**
 * Generate a cryptographically secure random token
 */
export function generateSealedSenderToken(): SealedSenderToken {
  const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_LENGTH));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('') as SealedSenderToken;
}

/**
 * Hash a token using SHA-256 for server-side storage
 * The server stores only the hash, not the original token
 */
export async function hashSealedSenderToken(
  token: SealedSenderToken,
): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate multiple tokens at once
 */
export function generateSealedSenderTokens(count: number): SealedSenderToken[] {
  return Array.from({ length: count }, () => generateSealedSenderToken());
}

/**
 * Verify that a token matches a given hash
 * Used by the server to validate tokens without storing them
 */
export async function verifySealedSenderToken(
  token: SealedSenderToken,
  expectedHash: string,
): Promise<boolean> {
  const actualHash = await hashSealedSenderToken(token);
  // Constant-time comparison to prevent timing attacks
  if (actualHash.length !== expectedHash.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < actualHash.length; i++) {
    result |= actualHash.charCodeAt(i) ^ expectedHash.charCodeAt(i);
  }
  return result === 0;
}

export class SealedSenderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SealedSenderError';
  }
}
