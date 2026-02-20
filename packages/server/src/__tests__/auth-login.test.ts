import type { AuthenticationResponseJSON } from '@simplewebauthn/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChallengeStore } from '../auth/challenge-store';
import {
  type VerifyAuthenticationFn,
  verifyLogin,
} from '../auth/login-service';
import { Database } from '../db/client';
import { MockD1Database } from './mock-d1';

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function makeAuthResponse(id: string): AuthenticationResponseJSON {
  return {
    id,
    rawId: id,
    type: 'public-key',
    response: {} as AuthenticationResponseJSON['response'],
    clientExtensionResults: {},
  };
}

describe('verifyLogin', () => {
  let mockD1: MockD1Database;
  let db: Database;
  let challengeStore: ChallengeStore;
  const now = new Date('2026-02-20T12:00:00.000Z');

  beforeEach(() => {
    mockD1 = new MockD1Database();
    db = new Database(mockD1);
    challengeStore = new ChallengeStore(mockD1);
    mockD1._seed('challenges', []);
    mockD1._seed('credentials', []);
    mockD1._seed('sessions', []);
  });

  it('rejects missing challenges', async () => {
    const verifyAuthentication: VerifyAuthenticationFn = vi.fn();
    const result = await verifyLogin(
      { response: makeAuthResponse('cred-1'), challenge: 'missing' },
      {
        db,
        challengeStore,
        verifyAuthentication,
        rpOrigin: 'http://localhost:3000',
        rpId: 'localhost',
        generateSessionId: () => 'session-1',
        now: () => new Date(now),
      },
    );

    expect(result).toEqual({
      ok: false,
      status: 400,
      error: 'Challenge not found or expired',
    });
    expect(verifyAuthentication).not.toHaveBeenCalled();
  });

  it('rejects non-authentication challenges', async () => {
    const challenge = 'challenge-1';
    const expiresAt = new Date(now.getTime() + 60_000).toISOString();
    mockD1._seed('challenges', [
      {
        challenge,
        user_id: null,
        display_name: null,
        type: 'registration',
        expires_at: expiresAt,
      },
    ]);

    const result = await verifyLogin(
      { response: makeAuthResponse('cred-1'), challenge },
      {
        db,
        challengeStore,
        verifyAuthentication: vi.fn(),
        rpOrigin: 'http://localhost:3000',
        rpId: 'localhost',
        generateSessionId: () => 'session-1',
        now: () => new Date(now),
      },
    );

    expect(result).toEqual({
      ok: false,
      status: 400,
      error: 'Invalid challenge type',
    });
  });

  it('expires and deletes stale challenges', async () => {
    const challenge = 'challenge-expired';
    const expiresAt = new Date(now.getTime() - 1).toISOString();
    mockD1._seed('challenges', [
      {
        challenge,
        user_id: null,
        display_name: null,
        type: 'authentication',
        expires_at: expiresAt,
      },
    ]);

    const result = await verifyLogin(
      { response: makeAuthResponse('cred-1'), challenge },
      {
        db,
        challengeStore,
        verifyAuthentication: vi.fn(),
        rpOrigin: 'http://localhost:3000',
        rpId: 'localhost',
        generateSessionId: () => 'session-1',
        now: () => new Date(now),
      },
    );

    expect(result).toEqual({
      ok: false,
      status: 400,
      error: 'Challenge expired',
    });
    expect(mockD1._getTable('challenges')).toHaveLength(0);
  });

  it('rejects unknown credentials', async () => {
    const challenge = 'challenge-valid';
    const expiresAt = new Date(now.getTime() + 60_000).toISOString();
    mockD1._seed('challenges', [
      {
        challenge,
        user_id: null,
        display_name: null,
        type: 'authentication',
        expires_at: expiresAt,
      },
    ]);

    const result = await verifyLogin(
      { response: makeAuthResponse('missing-cred'), challenge },
      {
        db,
        challengeStore,
        verifyAuthentication: vi.fn(),
        rpOrigin: 'http://localhost:3000',
        rpId: 'localhost',
        generateSessionId: () => 'session-1',
        now: () => new Date(now),
      },
    );

    expect(result).toEqual({
      ok: false,
      status: 400,
      error: 'Credential not found',
    });
    expect(mockD1._getTable('challenges')).toHaveLength(1);
  });

  it('rejects failed authentication responses', async () => {
    const challenge = 'challenge-valid';
    const expiresAt = new Date(now.getTime() + 60_000).toISOString();
    const publicKey = toBase64(new Uint8Array([1, 2, 3]));
    mockD1._seed('challenges', [
      {
        challenge,
        user_id: null,
        display_name: null,
        type: 'authentication',
        expires_at: expiresAt,
      },
    ]);
    mockD1._seed('credentials', [
      {
        id: 'cred-row-1',
        user_id: 'user-1',
        credential_id: 'cred-1',
        public_key: publicKey,
        created_at: '2026-01-01T00:00:00.000Z',
        last_used_at: null,
      },
    ]);

    const verifyAuthentication: VerifyAuthenticationFn = vi
      .fn()
      .mockResolvedValue({ verified: false });

    const result = await verifyLogin(
      { response: makeAuthResponse('cred-1'), challenge },
      {
        db,
        challengeStore,
        verifyAuthentication,
        rpOrigin: 'http://localhost:3000',
        rpId: 'localhost',
        generateSessionId: () => 'session-1',
        now: () => new Date(now),
      },
    );

    expect(result).toEqual({
      ok: false,
      status: 400,
      error: 'Authentication verification failed',
    });
    expect(mockD1._getTable('challenges')).toHaveLength(1);
    const credentials = mockD1._getTable('credentials');
    expect(credentials[0].last_used_at).toBeNull();
    expect(mockD1._getTable('sessions')).toHaveLength(0);
  });

  it('creates a session and updates the credential on success', async () => {
    const challenge = 'challenge-valid';
    const expiresAt = new Date(now.getTime() + 60_000).toISOString();
    const publicKey = toBase64(new Uint8Array([4, 5, 6]));
    mockD1._seed('challenges', [
      {
        challenge,
        user_id: null,
        display_name: null,
        type: 'authentication',
        expires_at: expiresAt,
      },
    ]);
    mockD1._seed('credentials', [
      {
        id: 'cred-row-1',
        user_id: 'user-1',
        credential_id: 'cred-1',
        public_key: publicKey,
        created_at: '2026-01-01T00:00:00.000Z',
        last_used_at: null,
      },
    ]);

    const verifyAuthentication: VerifyAuthenticationFn = vi
      .fn()
      .mockResolvedValue({ verified: true });

    const result = await verifyLogin(
      { response: makeAuthResponse('cred-1'), challenge },
      {
        db,
        challengeStore,
        verifyAuthentication,
        rpOrigin: 'http://localhost:3000',
        rpId: 'localhost',
        generateSessionId: () => 'session-1',
        now: () => new Date(now),
      },
    );

    expect(result).toEqual({
      ok: true,
      userId: 'user-1',
      sessionId: 'session-1',
    });
    expect(mockD1._getTable('challenges')).toHaveLength(0);

    const credentials = mockD1._getTable('credentials');
    expect(credentials[0].last_used_at).toBe(now.toISOString());

    const sessions = mockD1._getTable('sessions');
    expect(sessions).toHaveLength(1);
    expect(sessions[0].id).toBe('session-1');
    expect(sessions[0].user_id).toBe('user-1');
    expect(sessions[0].device_info).toBe('');
    expect(sessions[0].created_at).toBe(now.toISOString());
    const expectedExpiry = new Date(
      now.getTime() + 30 * 24 * 60 * 60 * 1000,
    ).toISOString();
    expect(sessions[0].expires_at).toBe(expectedExpiry);
  });
});
