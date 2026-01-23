import { Hono } from 'hono';
import type { GroupId, UserId } from '@microchat/shared';
import { InviteConfig } from '@microchat/shared';
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

function generateInviteCode(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

interface GroupListItem {
  groupId: GroupId;
  encryptedName: string;
  memberCount: number;
  lastActivity: string;
}

groupsRouter.get('/api/groups', requireAuth, async (c) => {
  const user = c.get('user');
  const db = new Database(c.env.DB);

  const groups = await db.query<{
    id: GroupId;
    encrypted_name: string;
    last_activity_at: string;
    member_count: number;
  }>(
    `SELECT g.id, g.encrypted_name, g.last_activity_at,
            (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) as member_count
     FROM groups g
     INNER JOIN group_members m ON m.group_id = g.id
     WHERE m.user_id = ?
     ORDER BY g.last_activity_at DESC`,
    [user.id]
  );

  const result: GroupListItem[] = groups.map((g) => ({
    groupId: g.id,
    encryptedName: g.encrypted_name,
    memberCount: g.member_count,
    lastActivity: g.last_activity_at,
  }));

  return c.json(result);
});

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

groupsRouter.post('/api/groups/:id/invites', requireAuth, async (c) => {
  const groupId = c.req.param('id') as GroupId;
  const user = c.get('user');
  const db = new Database(c.env.DB);

  const membership = await db.query<{ id: string }>(
    'SELECT id FROM group_members WHERE group_id = ? AND user_id = ?',
    [groupId, user.id]
  );

  if (membership.length === 0) {
    return c.json({ error: 'Not a member of this group' }, 403);
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + InviteConfig.MAX_AGE_DAYS * 24 * 60 * 60 * 1000);
  const inviteCode = generateInviteCode();

  await db.execute(
    'INSERT INTO invites (id, group_id, created_by, expires_at, used) VALUES (?, ?, ?, ?, ?)',
    [inviteCode, groupId, user.id, expiresAt.toISOString(), 0]
  );

  return c.json({
    code: inviteCode,
    expiresAt: expiresAt.toISOString(),
  });
});

export { groupsRouter };
