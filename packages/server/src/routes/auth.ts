import type { UserId } from '@microchat/shared';
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/server';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { Hono } from 'hono';
import { setCookie } from 'hono/cookie';
import { ChallengeStore } from '../auth/challenge-store';
import { verifyLogin } from '../auth/login-service';
import type { D1Database } from '../db/client';
import { Database } from '../db/client';

export interface AuthEnv {
  DB: D1Database;
  RP_ID: string;
  RP_NAME: string;
  RP_ORIGIN: string;
}

const authRouter = new Hono<{ Bindings: AuthEnv }>();

function generateUserId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function generateSessionId(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function generateCredentialId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64urlToUint8Array(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (base64.length % 4)) % 4;
  const padded = `${base64}${'='.repeat(padLength)}`;
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

authRouter.post('/api/auth/register/options', async (c) => {
  const body = await c.req.json<{ displayName: string }>();

  if (!body.displayName || typeof body.displayName !== 'string') {
    return c.json({ error: 'displayName is required' }, 400);
  }

  const userId = generateUserId();

  const userIdBytes = new TextEncoder().encode(userId);
  const userIdBuffer = new Uint8Array(
    userIdBytes.buffer.slice(0),
  ) as Uint8Array<ArrayBuffer>;

  const options = await generateRegistrationOptions({
    rpName: c.env.RP_NAME || 'MicroChat',
    rpID: c.env.RP_ID || 'localhost',
    userName: body.displayName,
    userDisplayName: body.displayName,
    userID: userIdBuffer,
    attestationType: 'none',
    excludeCredentials: [],
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
    supportedAlgorithmIDs: [-7, -257],
  });

  const challengeStore = new ChallengeStore(c.env.DB);
  await challengeStore.set({
    challenge: options.challenge,
    userId,
    displayName: body.displayName,
    expiresAt: Date.now() + 5 * 60 * 1000,
    type: 'registration',
  });

  return c.json(options);
});

authRouter.post('/api/auth/register/verify', async (c) => {
  const body = await c.req.json<{
    response: RegistrationResponseJSON;
    challenge: string;
  }>();

  if (!body.response || !body.challenge) {
    return c.json({ error: 'response and challenge are required' }, 400);
  }

  const challengeStore = new ChallengeStore(c.env.DB);
  const storedChallenge = await challengeStore.get(body.challenge);

  if (!storedChallenge) {
    return c.json({ error: 'Challenge not found or expired' }, 400);
  }

  if (storedChallenge.expiresAt < Date.now()) {
    await challengeStore.delete(body.challenge);
    return c.json({ error: 'Challenge expired' }, 400);
  }

  try {
    const verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge: storedChallenge.challenge,
      expectedOrigin: c.env.RP_ORIGIN || 'http://localhost:3000',
      expectedRPID: c.env.RP_ID || 'localhost',
    });

    if (!verification.verified || !verification.registrationInfo) {
      return c.json({ error: 'Registration verification failed' }, 400);
    }

    await challengeStore.delete(body.challenge);

    const db = new Database(c.env.DB);
    const now = new Date().toISOString();
    const userId = storedChallenge.userId as UserId;

    await db.execute(
      'INSERT INTO users (id, display_name, created_at) VALUES (?, ?, ?)',
      [userId, storedChallenge.displayName, now],
    );

    const credId = generateCredentialId();
    const publicKeyBase64 = uint8ArrayToBase64(
      verification.registrationInfo.credential.publicKey,
    );

    await db.execute(
      'INSERT INTO credentials (id, user_id, credential_id, public_key, created_at, last_used_at) VALUES (?, ?, ?, ?, ?, ?)',
      [
        credId,
        userId,
        verification.registrationInfo.credential.id,
        publicKeyBase64,
        now,
        null,
      ],
    );

    const sessionId = generateSessionId();
    const expiresAt = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000,
    ).toISOString();

    await db.execute(
      'INSERT INTO sessions (id, user_id, expires_at, device_info, created_at) VALUES (?, ?, ?, ?, ?)',
      [sessionId, userId, expiresAt, '', now],
    );

    setCookie(c, 'session', sessionId, {
      path: '/',
      httpOnly: true,
      secure: c.env.RP_ORIGIN?.startsWith('https') ?? false,
      sameSite: 'Lax',
      maxAge: 30 * 24 * 60 * 60,
    });

    return c.json({
      verified: true,
      userId,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Verification failed';
    return c.json({ error: message }, 400);
  }
});

authRouter.post('/api/auth/login/options', async (c) => {
  const body = await c.req
    .json<{ username?: string }>()
    .catch(() => ({ username: undefined }));

  const db = new Database(c.env.DB);

  let allowCredentials: { id: string; type: 'public-key' }[] = [];

  if (body.username) {
    const users = await db.query<{ id: string }>(
      'SELECT id FROM users WHERE display_name = ?',
      [body.username],
    );

    if (users.length > 0) {
      const credentials = await db.query<{ credential_id: string }>(
        'SELECT credential_id FROM credentials WHERE user_id = ?',
        [users[0].id],
      );

      allowCredentials = credentials
        .map((cred) => {
          try {
            const bytes = base64urlToUint8Array(cred.credential_id);
            const rawId = uint8ArrayToBase64(bytes);
            return {
              id: rawId,
              type: 'public-key' as const,
            };
          } catch (error) {
            console.error('[auth] Invalid credential_id format', error);
            return null;
          }
        })
        .filter(
          (cred): cred is { id: string; type: 'public-key' } => cred !== null,
        );
    }
  }

  const options = await generateAuthenticationOptions({
    rpID: c.env.RP_ID || 'localhost',
    userVerification: 'preferred',
    allowCredentials,
  });

  const challengeStore = new ChallengeStore(c.env.DB);
  await challengeStore.set({
    challenge: options.challenge,
    expiresAt: Date.now() + 5 * 60 * 1000,
    type: 'authentication',
  });

  return c.json(options);
});

authRouter.post('/api/auth/logout', async (c) => {
  const sessionId = await import('hono/cookie').then((m) =>
    m.getCookie(c, 'session'),
  );

  if (sessionId) {
    const db = new Database(c.env.DB);
    await db.execute('DELETE FROM sessions WHERE id = ?', [sessionId]);
  }

  setCookie(c, 'session', '', {
    path: '/',
    httpOnly: true,
    secure: c.env.RP_ORIGIN?.startsWith('https') ?? false,
    sameSite: 'Lax',
    maxAge: 0,
  });

  return c.json({ success: true });
});

authRouter.get('/api/auth/me', async (c) => {
  const sessionId = await import('hono/cookie').then((m) =>
    m.getCookie(c, 'session'),
  );

  if (!sessionId) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  const db = new Database(c.env.DB);

  const sessions = await db.query<{ user_id: string; expires_at: string }>(
    'SELECT user_id, expires_at FROM sessions WHERE id = ?',
    [sessionId],
  );

  if (sessions.length === 0) {
    return c.json({ error: 'Invalid session' }, 401);
  }

  const session = sessions[0];
  const now = new Date();
  const expiresAt = new Date(session.expires_at);

  if (expiresAt < now) {
    await db.execute('DELETE FROM sessions WHERE id = ?', [sessionId]);
    return c.json({ error: 'Session expired' }, 401);
  }

  const users = await db.query<{ id: string; display_name: string }>(
    'SELECT id, display_name FROM users WHERE id = ?',
    [session.user_id],
  );

  if (users.length === 0) {
    return c.json({ error: 'User not found' }, 401);
  }

  const user = users[0];
  return c.json({
    userId: user.id as UserId,
    displayName: user.display_name,
  });
});

authRouter.post('/api/auth/login/verify', async (c) => {
  const body = await c.req.json<{
    response: AuthenticationResponseJSON;
    challenge: string;
  }>();

  if (!body.response || !body.challenge) {
    return c.json({ error: 'response and challenge are required' }, 400);
  }

  try {
    const result = await verifyLogin(
      { response: body.response, challenge: body.challenge },
      {
        db: new Database(c.env.DB),
        challengeStore: new ChallengeStore(c.env.DB),
        verifyAuthentication: verifyAuthenticationResponse,
        rpOrigin: c.env.RP_ORIGIN || 'http://localhost:3000',
        rpId: c.env.RP_ID || 'localhost',
        generateSessionId,
      },
    );

    if (!result.ok) {
      return c.json({ error: result.error }, result.status);
    }

    setCookie(c, 'session', result.sessionId, {
      path: '/',
      httpOnly: true,
      secure: c.env.RP_ORIGIN?.startsWith('https') ?? false,
      sameSite: 'Lax',
      maxAge: 30 * 24 * 60 * 60,
    });

    return c.json({
      verified: true,
      userId: result.userId,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Verification failed';
    return c.json({ error: message }, 400);
  }
});

export { authRouter };
