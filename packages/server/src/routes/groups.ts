import type { GroupId, UserId, WebSocketEvent } from '@microchat/shared';
import { InviteConfig } from '@microchat/shared';
import { Hono } from 'hono';
import { type D1Database, Database } from '../db/client';
import {
  type AuthEnv as AuthMiddlewareEnv,
  type AuthVariables,
  requireAuth,
} from '../middleware/auth';
import { rateLimitMessages } from '../middleware/rate-limit';

export interface GroupsEnv extends AuthMiddlewareEnv {
  DB: D1Database;
  CHAT_HUB: DurableObjectNamespace;
}

const groupsRouter = new Hono<{
  Bindings: GroupsEnv;
  Variables: AuthVariables;
}>();

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

function generateMessageId(): string {
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
    [user.id],
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
    [groupId, body.encryptedName, user.id, now, now],
  );

  await db.execute(
    'INSERT INTO group_members (id, group_id, user_id, joined_at) VALUES (?, ?, ?, ?)',
    [memberId, groupId, user.id, now],
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
    [groupId, user.id],
  );

  if (membership.length === 0) {
    return c.json({ error: 'Not a member of this group' }, 403);
  }

  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + InviteConfig.MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
  );
  const inviteCode = generateInviteCode();

  await db.execute(
    'INSERT INTO invites (id, group_id, created_by, expires_at, used) VALUES (?, ?, ?, ?, ?)',
    [inviteCode, groupId, user.id, expiresAt.toISOString(), 0],
  );

  return c.json({
    code: inviteCode,
    expiresAt: expiresAt.toISOString(),
  });
});

groupsRouter.post('/api/invites/:code/accept', requireAuth, async (c) => {
  const code = c.req.param('code');
  const user = c.get('user');
  const db = new Database(c.env.DB);
  const now = new Date().toISOString();

  const invites = await db.query<{
    id: string;
    group_id: GroupId;
    expires_at: string;
    used: number;
  }>('SELECT id, group_id, expires_at, used FROM invites WHERE id = ?', [code]);

  if (invites.length === 0) {
    return c.json({ error: 'Invite not found' }, 404);
  }

  const invite = invites[0];

  if (invite.used !== 0) {
    return c.json({ error: 'Invite has already been used' }, 400);
  }

  if (new Date(invite.expires_at) < new Date()) {
    return c.json({ error: 'Invite has expired' }, 400);
  }

  const existingMembership = await db.query<{ id: string }>(
    'SELECT id FROM group_members WHERE group_id = ? AND user_id = ?',
    [invite.group_id, user.id],
  );

  if (existingMembership.length > 0) {
    return c.json({ error: 'Already a member of this group' }, 400);
  }

  const memberId = generateMemberId();

  await db.execute(
    'UPDATE invites SET used = 1, used_by = ?, used_at = ? WHERE id = ?',
    [user.id, now, code],
  );

  await db.execute(
    'INSERT INTO group_members (id, group_id, user_id, joined_at) VALUES (?, ?, ?, ?)',
    [memberId, invite.group_id, user.id, now],
  );

  const groups = await db.query<{
    id: GroupId;
    encrypted_name: string;
    owner_id: UserId;
  }>('SELECT id, encrypted_name, owner_id FROM groups WHERE id = ?', [
    invite.group_id,
  ]);

  const group = groups[0];

  return c.json({
    groupId: group.id,
    encryptedName: group.encrypted_name,
    ownerId: group.owner_id,
  });
});

groupsRouter.delete(
  '/api/groups/:id/members/:userId',
  requireAuth,
  async (c) => {
    const groupId = c.req.param('id') as GroupId;
    const targetUserId = c.req.param('userId') as UserId;
    const user = c.get('user');
    const db = new Database(c.env.DB);

    if (targetUserId === user.id) {
      return c.json(
        { error: 'Cannot remove yourself. Use leave endpoint instead.' },
        400,
      );
    }

    const groups = await db.query<{ owner_id: UserId }>(
      'SELECT owner_id FROM groups WHERE id = ?',
      [groupId],
    );

    if (groups.length === 0) {
      return c.json({ error: 'Group not found' }, 404);
    }

    if (groups[0].owner_id !== user.id) {
      return c.json({ error: 'Only the group owner can remove members' }, 403);
    }

    const membership = await db.query<{ id: string }>(
      'SELECT id FROM group_members WHERE group_id = ? AND user_id = ?',
      [groupId, targetUserId],
    );

    if (membership.length === 0) {
      return c.json({ error: 'User is not a member of this group' }, 404);
    }

    await db.execute(
      'DELETE FROM group_members WHERE group_id = ? AND user_id = ?',
      [groupId, targetUserId],
    );

    return c.json({ success: true });
  },
);

groupsRouter.get('/api/groups/:id/members', requireAuth, async (c) => {
  const groupId = c.req.param('id') as GroupId;
  const user = c.get('user');
  const db = new Database(c.env.DB);

  const membership = await db.query<{ id: string }>(
    'SELECT id FROM group_members WHERE group_id = ? AND user_id = ?',
    [groupId, user.id],
  );

  if (membership.length === 0) {
    return c.json({ error: 'Not a member of this group' }, 403);
  }

  const members = await db.query<{
    user_id: UserId;
    display_name: string;
    joined_at: string;
  }>(
    `SELECT gm.user_id, u.display_name, gm.joined_at
     FROM group_members gm
     INNER JOIN users u ON u.id = gm.user_id
     WHERE gm.group_id = ?
     ORDER BY gm.joined_at ASC`,
    [groupId],
  );

  const group = await db.query<{ owner_id: UserId }>(
    'SELECT owner_id FROM groups WHERE id = ?',
    [groupId],
  );

  return c.json({
    members: members.map((m) => ({
      userId: m.user_id,
      displayName: m.display_name,
      joinedAt: m.joined_at,
      isOwner: group[0]?.owner_id === m.user_id,
    })),
    ownerId: group[0]?.owner_id,
  });
});

groupsRouter.post('/api/groups/:id/leave', requireAuth, async (c) => {
  const groupId = c.req.param('id') as GroupId;
  const user = c.get('user');
  const db = new Database(c.env.DB);

  const groups = await db.query<{ owner_id: UserId }>(
    'SELECT owner_id FROM groups WHERE id = ?',
    [groupId],
  );

  if (groups.length === 0) {
    return c.json({ error: 'Group not found' }, 404);
  }

  if (groups[0].owner_id === user.id) {
    return c.json(
      { error: 'Owner cannot leave. Transfer ownership or delete the group.' },
      400,
    );
  }

  const membership = await db.query<{ id: string }>(
    'SELECT id FROM group_members WHERE group_id = ? AND user_id = ?',
    [groupId, user.id],
  );

  if (membership.length === 0) {
    return c.json({ error: 'Not a member of this group' }, 404);
  }

  await db.execute(
    'DELETE FROM group_members WHERE group_id = ? AND user_id = ?',
    [groupId, user.id],
  );

  return c.json({ success: true });
});

groupsRouter.delete('/api/groups/:id', requireAuth, async (c) => {
  const groupId = c.req.param('id') as GroupId;
  const user = c.get('user');
  const db = new Database(c.env.DB);

  const groups = await db.query<{ owner_id: UserId }>(
    'SELECT owner_id FROM groups WHERE id = ?',
    [groupId],
  );

  if (groups.length === 0) {
    return c.json({ error: 'Group not found' }, 404);
  }

  if (groups[0].owner_id !== user.id) {
    return c.json({ error: 'Only the group owner can delete the group' }, 403);
  }

  // Delete all group data atomically using batch
  await db.batch([
    { sql: 'DELETE FROM messages WHERE group_id = ?', params: [groupId] },
    { sql: 'DELETE FROM invites WHERE group_id = ?', params: [groupId] },
    { sql: 'DELETE FROM group_members WHERE group_id = ?', params: [groupId] },
    { sql: 'DELETE FROM groups WHERE id = ?', params: [groupId] },
  ]);

  return c.json({ success: true });
});

// Messages endpoints

groupsRouter.get('/api/groups/:id/messages', requireAuth, async (c) => {
  const groupId = c.req.param('id') as GroupId;
  const user = c.get('user');
  const db = new Database(c.env.DB);

  // Check membership
  const membership = await db.query<{ id: string }>(
    'SELECT id FROM group_members WHERE group_id = ? AND user_id = ?',
    [groupId, user.id],
  );

  if (membership.length === 0) {
    return c.json({ error: 'Not a member of this group' }, 403);
  }

  // Parse pagination params
  const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 100);
  const before = c.req.query('before');
  const after = c.req.query('after');

  let query = `
    SELECT m.id, m.sender_id, m.encrypted_payload, m.nonce, m.created_at, m.deleted_at,
           u.display_name as sender_name
    FROM messages m
    INNER JOIN users u ON u.id = m.sender_id
    WHERE m.group_id = ?
  `;
  const params: (string | number)[] = [groupId];

  if (before) {
    query += ' AND m.created_at < ?';
    params.push(before);
  } else if (after) {
    query += ' AND m.created_at > ?';
    params.push(after);
  }

  query += ' ORDER BY m.created_at DESC LIMIT ?';
  params.push(limit);

  const messages = await db.query<{
    id: string;
    sender_id: UserId;
    encrypted_payload: string;
    nonce: string;
    created_at: string;
    deleted_at: string | null;
    sender_name: string;
  }>(query, params);

  return c.json({
    messages: messages.reverse().map((m) => ({
      id: m.id,
      senderId: m.sender_id,
      senderName: m.sender_name,
      encryptedPayload: m.encrypted_payload,
      nonce: m.nonce,
      createdAt: m.created_at,
      deleted: m.deleted_at !== null,
    })),
  });
});

groupsRouter.post(
  '/api/groups/:id/messages',
  requireAuth,
  rateLimitMessages(),
  async (c) => {
    const groupId = c.req.param('id') as GroupId;
    const user = c.get('user');
    const db = new Database(c.env.DB);

    const body = await c.req.json<{
      encryptedPayload: string;
      nonce: string;
    }>();

    if (!body.encryptedPayload || !body.nonce) {
      return c.json({ error: 'encryptedPayload and nonce are required' }, 400);
    }

    // Check membership
    const membership = await db.query<{ id: string }>(
      'SELECT id FROM group_members WHERE group_id = ? AND user_id = ?',
      [groupId, user.id],
    );

    if (membership.length === 0) {
      return c.json({ error: 'Not a member of this group' }, 403);
    }

    const messageId = generateMessageId();
    const now = new Date().toISOString();

    await db.execute(
      'INSERT INTO messages (id, group_id, sender_id, encrypted_payload, nonce, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [messageId, groupId, user.id, body.encryptedPayload, body.nonce, now],
    );

    // Update group last activity
    await db.execute('UPDATE groups SET last_activity_at = ? WHERE id = ?', [
      now,
      groupId,
    ]);

    // Broadcast to WebSocket subscribers
    const hubId = c.env.CHAT_HUB.idFromName('main');
    const hub = c.env.CHAT_HUB.get(hubId);
    const event: WebSocketEvent = {
      type: 'message',
      groupId,
      messageId,
      senderId: user.id,
      senderName: user.displayName,
      encryptedContent: body.encryptedPayload,
      timestamp: now,
    };
    await hub.fetch('https://hub/broadcast', {
      method: 'POST',
      body: JSON.stringify(event),
    });

    return c.json({
      messageId,
      timestamp: now,
    });
  },
);

groupsRouter.delete(
  '/api/groups/:id/messages/:messageId',
  requireAuth,
  async (c) => {
    const groupId = c.req.param('id') as GroupId;
    const messageId = c.req.param('messageId');
    const user = c.get('user');
    const db = new Database(c.env.DB);

    // Check message exists and belongs to this user
    const messages = await db.query<{ id: string; sender_id: UserId }>(
      'SELECT id, sender_id FROM messages WHERE id = ? AND group_id = ?',
      [messageId, groupId],
    );

    if (messages.length === 0) {
      return c.json({ error: 'Message not found' }, 404);
    }

    if (messages[0].sender_id !== user.id) {
      return c.json({ error: 'Can only delete your own messages' }, 403);
    }

    const now = new Date().toISOString();

    // Soft delete - mark as deleted but keep record
    await db.execute(
      'UPDATE messages SET deleted_at = ?, deleted_by = ? WHERE id = ?',
      [now, user.id, messageId],
    );

    // Broadcast deletion to WebSocket subscribers
    const hubId = c.env.CHAT_HUB.idFromName('main');
    const hub = c.env.CHAT_HUB.get(hubId);
    const event: WebSocketEvent = {
      type: 'messageDeleted',
      groupId,
      messageId,
      deletedBy: user.id,
    };
    await hub.fetch('https://hub/broadcast', {
      method: 'POST',
      body: JSON.stringify(event),
    });

    return c.json({ success: true });
  },
);

export { groupsRouter };
