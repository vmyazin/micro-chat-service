import type { UserId } from '@microchat/shared';
import type { AuthenticationResponseJSON } from '@simplewebauthn/server';
import type { Database } from '../db/client';
import type { ChallengeStore } from './challenge-store';

export type VerifyAuthenticationFn = (options: {
  response: AuthenticationResponseJSON;
  expectedChallenge: string;
  expectedOrigin: string;
  expectedRPID: string;
  credential: { id: string; publicKey: Uint8Array; counter: number };
}) => Promise<{ verified: boolean }>;

export interface VerifyLoginInput {
  response: AuthenticationResponseJSON;
  challenge: string;
}

export interface VerifyLoginDeps {
  db: Database;
  challengeStore: ChallengeStore;
  verifyAuthentication: VerifyAuthenticationFn;
  rpOrigin: string;
  rpId: string;
  generateSessionId: () => string;
  now?: () => Date;
}

export type VerifyLoginResult =
  | { ok: true; userId: UserId; sessionId: string }
  | { ok: false; status: 400; error: string };

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function verifyLogin(
  input: VerifyLoginInput,
  deps: VerifyLoginDeps,
): Promise<VerifyLoginResult> {
  const storedChallenge = await deps.challengeStore.get(input.challenge);

  if (!storedChallenge) {
    return { ok: false, status: 400, error: 'Challenge not found or expired' };
  }

  if (storedChallenge.type !== 'authentication') {
    return { ok: false, status: 400, error: 'Invalid challenge type' };
  }

  const now = deps.now?.() ?? new Date();
  if (storedChallenge.expiresAt < now.getTime()) {
    await deps.challengeStore.delete(input.challenge);
    return { ok: false, status: 400, error: 'Challenge expired' };
  }

  const credentials = await deps.db.query<{
    id: string;
    user_id: string;
    credential_id: string;
    public_key: string;
  }>(
    'SELECT id, user_id, credential_id, public_key FROM credentials WHERE credential_id = ?',
    [input.response.id],
  );

  if (credentials.length === 0) {
    return { ok: false, status: 400, error: 'Credential not found' };
  }

  const credential = credentials[0];
  const publicKeyBytes = base64ToUint8Array(credential.public_key);

  const verification = await deps.verifyAuthentication({
    response: input.response,
    expectedChallenge: storedChallenge.challenge,
    expectedOrigin: deps.rpOrigin,
    expectedRPID: deps.rpId,
    credential: {
      id: credential.credential_id,
      publicKey: publicKeyBytes,
      counter: 0,
    },
  });

  if (!verification.verified) {
    return {
      ok: false,
      status: 400,
      error: 'Authentication verification failed',
    };
  }

  await deps.challengeStore.delete(input.challenge);

  const nowIso = now.toISOString();
  await deps.db.execute('UPDATE credentials SET last_used_at = ? WHERE id = ?', [
    nowIso,
    credential.id,
  ]);

  const sessionId = deps.generateSessionId();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString();

  await deps.db.execute(
    'INSERT INTO sessions (id, user_id, expires_at, device_info, created_at) VALUES (?, ?, ?, ?, ?)',
    [sessionId, credential.user_id, expiresAt, '', nowIso],
  );

  return { ok: true, userId: credential.user_id as UserId, sessionId };
}
