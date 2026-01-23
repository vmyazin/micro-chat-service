import { Hono } from 'hono';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import type { UserId } from '@microchat/shared';

export interface AuthEnv {
  DB: import('../db/client').D1Database;
  CHALLENGE_STORE: Map<string, { challenge: string; userId: string; displayName: string; expiresAt: number }>;
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
  });

  return c.json(options);
});

export { authRouter };
