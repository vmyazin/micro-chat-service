import { Hono } from 'hono';
import type { D1Database } from '../db/client';
import { Database } from '../db/client';
import type { UserId } from '@microchat/shared';

export interface TestEnv {
  DB: D1Database;
  ENABLE_TEST_ENDPOINTS?: string;
}

const testRouter = new Hono<{ Bindings: TestEnv }>();

function generateHexId(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

testRouter.post('/api/test/create-user', async (c) => {
  if (c.env.ENABLE_TEST_ENDPOINTS !== 'true') {
    return c.json({ error: 'Not found' }, 404);
  }

  let body: { displayName?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.displayName || typeof body.displayName !== 'string') {
    return c.json({ error: 'displayName is required' }, 400);
  }

  const db = new Database(c.env.DB);
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const userId = generateHexId(16) as UserId;
  const sessionId = generateHexId(32);

  await db.execute(
    'INSERT INTO users (id, display_name, created_at) VALUES (?, ?, ?)',
    [userId, body.displayName, now],
  );

  await db.execute(
    'INSERT INTO sessions (id, user_id, expires_at, device_info, created_at) VALUES (?, ?, ?, ?, ?)',
    [sessionId, userId, expiresAt, 'test-e2e', now],
  );

  return c.json({ userId, sessionId });
});

export { testRouter };
