import { Hono } from 'hono';
import type { GroupId, UserId } from '@microchat/shared';
import { Database, type D1Database } from '../db/client';
import { requireAuth, type AuthVariables, type AuthEnv as AuthMiddlewareEnv } from '../middleware/auth';

export interface GroupsEnv extends AuthMiddlewareEnv {
  DB: D1Database;
}

const groupsRouter = new Hono<{ Bindings: GroupsEnv; Variables: AuthVariables }>();

function generateGroupId(): GroupId {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('') as GroupId;
}

function generateMemberId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

groupsRouter.post('/api/groups', requireAuth, async (c) => {
  const body = await c.req.json<{ encryptedName: string }>();

  if (!body.encryptedName || typeof body.encryptedName !== 'string') {
    return c.json({ error: 'encryptedName is required' }, 400);
  }

  const user = c.get('user');
  const db = new Database(c.env.DB);
  const now = new Date().toISOString();

  const groupId = generateGroupId();
  const memberId = generateMemberId();

  await db.execute(
    'INSERT INTO groups (id, encrypted_name, owner_id, created_at, last_activity_at) VALUES (?, ?, ?, ?, ?)',
    [groupId, body.encryptedName, user.id, now, now]
  );

  await db.execute(
    'INSERT INTO group_members (id, group_id, user_id, joined_at) VALUES (?, ?, ?, ?)',
    [memberId, groupId, user.id, now]
  );

  return c.json({
    groupId,
    epoch: 0,
  });
});

export { groupsRouter };
