import { Hono } from 'hono';
import { setCookie } from 'hono/cookie';
import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server';
import type { RegistrationResponseJSON, AuthenticationResponseJSON } from '@simplewebauthn/server';
import type { UserId } from '@microchat/shared';
import { Database } from '../db/client';

export interface ChallengeData {
  challenge: string;
  userId?: string;
  displayName?: string;
  expiresAt: number;
  type: 'registration' | 'authentication';
}

export interface AuthEnv {
  DB: import('../db/client').D1Database;
  CHALLENGE_STORE: Map<string, ChallengeData>;
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

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
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
  const userIdBuffer = new Uint8Array(userIdBytes.buffer.slice(0)) as Uint8Array<ArrayBuffer>;

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

  c.env.CHALLENGE_STORE.set(options.challenge, {
    challenge: options.challenge,
    userId,
    displayName: body.displayName,
    expiresAt: Date.now() + 5 * 60 * 1000,
    type: 'registration',
  });

  return c.json(options);
});

authRouter.post('/api/auth/register/verify', async (c) => {
  const body = await c.req.json<{ response: RegistrationResponseJSON; challenge: string }>();
  
  if (!body.response || !body.challenge) {
    return c.json({ error: 'response and challenge are required' }, 400);
  }

  const storedChallenge = c.env.CHALLENGE_STORE.get(body.challenge);
  
  if (!storedChallenge) {
    return c.json({ error: 'Challenge not found or expired' }, 400);
  }

  if (storedChallenge.expiresAt < Date.now()) {
    c.env.CHALLENGE_STORE.delete(body.challenge);
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

    c.env.CHALLENGE_STORE.delete(body.challenge);

    const db = new Database(c.env.DB);
    const now = new Date().toISOString();
    const userId = storedChallenge.userId as UserId;

    await db.execute(
      'INSERT INTO users (id, display_name, created_at) VALUES (?, ?, ?)',
      [userId, storedChallenge.displayName, now]
    );

    const credId = generateCredentialId();
    const publicKeyBase64 = uint8ArrayToBase64(verification.registrationInfo.credential.publicKey);
    
    await db.execute(
      'INSERT INTO credentials (id, user_id, credential_id, public_key, created_at, last_used_at) VALUES (?, ?, ?, ?, ?, ?)',
      [credId, userId, verification.registrationInfo.credential.id, publicKeyBase64, now, null]
    );

    const sessionId = generateSessionId();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    
    await db.execute(
      'INSERT INTO sessions (id, user_id, expires_at, device_info, created_at) VALUES (?, ?, ?, ?, ?)',
      [sessionId, userId, expiresAt, '', now]
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
    const message = error instanceof Error ? error.message : 'Verification failed';
    return c.json({ error: message }, 400);
  }
});

authRouter.post('/api/auth/login/options', async (c) => {
  const body = await c.req.json<{ username?: string }>().catch(() => ({ username: undefined }));
  
  const db = new Database(c.env.DB);
  
  let allowCredentials: { id: string; type: 'public-key' }[] = [];
  
  if (body.username) {
    const users = await db.query<{ id: string }>(
      'SELECT id FROM users WHERE display_name = ?',
      [body.username]
    );
    
    if (users.length > 0) {
      const credentials = await db.query<{ credential_id: string }>(
        'SELECT credential_id FROM credentials WHERE user_id = ?',
        [users[0].id]
      );
      
      allowCredentials = credentials.map((cred) => ({
        id: cred.credential_id,
        type: 'public-key' as const,
      }));
    }
  }

  const options = await generateAuthenticationOptions({
    rpID: c.env.RP_ID || 'localhost',
    userVerification: 'preferred',
    allowCredentials,
  });

  c.env.CHALLENGE_STORE.set(options.challenge, {
    challenge: options.challenge,
    expiresAt: Date.now() + 5 * 60 * 1000,
    type: 'authentication',
  });

  return c.json(options);
});

authRouter.post('/api/auth/login/verify', async (c) => {
  const body = await c.req.json<{ response: AuthenticationResponseJSON; challenge: string }>();
  
  if (!body.response || !body.challenge) {
    return c.json({ error: 'response and challenge are required' }, 400);
  }

  const storedChallenge = c.env.CHALLENGE_STORE.get(body.challenge);
  
  if (!storedChallenge) {
    return c.json({ error: 'Challenge not found or expired' }, 400);
  }

  if (storedChallenge.type !== 'authentication') {
    return c.json({ error: 'Invalid challenge type' }, 400);
  }

  if (storedChallenge.expiresAt < Date.now()) {
    c.env.CHALLENGE_STORE.delete(body.challenge);
    return c.json({ error: 'Challenge expired' }, 400);
  }

  try {
    const db = new Database(c.env.DB);
    
    const credentials = await db.query<{ id: string; user_id: string; credential_id: string; public_key: string }>(
      'SELECT id, user_id, credential_id, public_key FROM credentials WHERE credential_id = ?',
      [body.response.id]
    );
    
    if (credentials.length === 0) {
      return c.json({ error: 'Credential not found' }, 400);
    }
    
    const credential = credentials[0];
    const publicKeyBytes = base64ToUint8Array(credential.public_key);
    const publicKeyBuffer = new Uint8Array(publicKeyBytes.buffer.slice(0)) as Uint8Array<ArrayBuffer>;
    
    const verification = await verifyAuthenticationResponse({
      response: body.response,
      expectedChallenge: storedChallenge.challenge,
      expectedOrigin: c.env.RP_ORIGIN || 'http://localhost:3000',
      expectedRPID: c.env.RP_ID || 'localhost',
      credential: {
        id: credential.credential_id,
        publicKey: publicKeyBuffer,
        counter: 0,
      },
    });

    if (!verification.verified) {
      return c.json({ error: 'Authentication verification failed' }, 400);
    }

    c.env.CHALLENGE_STORE.delete(body.challenge);

    const now = new Date().toISOString();
    const userId = credential.user_id as UserId;

    await db.execute(
      'UPDATE credentials SET last_used_at = ? WHERE id = ?',
      [now, credential.id]
    );

    const sessionId = generateSessionId();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    
    await db.execute(
      'INSERT INTO sessions (id, user_id, expires_at, device_info, created_at) VALUES (?, ?, ?, ?, ?)',
      [sessionId, userId, expiresAt, '', now]
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
    const message = error instanceof Error ? error.message : 'Verification failed';
    return c.json({ error: message }, 400);
  }
});

export { authRouter };
