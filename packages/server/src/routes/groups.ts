import type {
  GroupId,
  SealedSenderToken,
  UserId,
  WebSocketEvent,
} from '@microchat/shared';
import { InviteConfig, MAX_IMAGE_SIZE_BYTES } from '@microchat/shared';
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
  IMAGES: R2Bucket;
}

const groupsRouter = new Hono<{
  Bindings: GroupsEnv;
  Variables: AuthVariables;
}>();

function generateHexId(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const generateGroupId = () => generateHexId(16) as GroupId;
const generateMemberId = () => generateHexId(16);
const generateMessageId = () => generateHexId(16);
const generateInviteCode = () => generateHexId(12);
const generateSenderToken = () => generateHexId(32);

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

interface GroupListItem {
  groupId: GroupId;
  encryptedName: string;
  memberCount: number;
  lastActivity: string;
  memberNames: string[];
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

  // Fetch member names for groups with less than 4 members
  const groupIds = groups.map((g) => g.id);
  const memberNamesMap = new Map<GroupId, string[]>();

  if (groupIds.length > 0) {
    const placeholders = groupIds.map(() => '?').join(',');
    const members = await db.query<{
      group_id: GroupId;
      display_name: string;
    }>(
      `SELECT gm.group_id, u.display_name
       FROM group_members gm
       INNER JOIN users u ON u.id = gm.user_id
       WHERE gm.group_id IN (${placeholders})
       ORDER BY gm.joined_at ASC`,
      groupIds,
    );

    for (const m of members) {
      const names = memberNamesMap.get(m.group_id) || [];
      names.push(m.display_name);
      memberNamesMap.set(m.group_id, names);
    }
  }

  const result: GroupListItem[] = groups.map((g) => ({
    groupId: g.id,
    encryptedName: g.encrypted_name,
    memberCount: g.member_count,
    lastActivity: g.last_activity_at,
    memberNames: memberNamesMap.get(g.id) || [],
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

  // Delete R2 images for this group
  const groupImages = await db.query<{ r2_key: string }>(
    'SELECT r2_key FROM image_attachments WHERE group_id = ?',
    [groupId],
  );
  for (const row of groupImages) {
    await c.env.IMAGES.delete(row.r2_key);
  }

  // Delete all group data atomically using batch
  await db.batch([
    {
      sql: 'DELETE FROM image_attachments WHERE group_id = ?',
      params: [groupId],
    },
    { sql: 'DELETE FROM messages WHERE group_id = ?', params: [groupId] },
    { sql: 'DELETE FROM invites WHERE group_id = ?', params: [groupId] },
    { sql: 'DELETE FROM group_members WHERE group_id = ?', params: [groupId] },
    { sql: 'DELETE FROM groups WHERE id = ?', params: [groupId] },
  ]);

  return c.json({ success: true });
});

// Sealed Sender: Issue anonymous sender tokens
groupsRouter.post('/api/groups/:id/sender-tokens', requireAuth, async (c) => {
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

  const body = await c.req.json<{ count?: number }>();
  const count = Math.min(Math.max(body.count ?? 10, 1), 50); // 1-50 tokens per request

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hour expiry
  const tokens: string[] = [];
  const inserts: { sql: string; params: unknown[] }[] = [];

  for (let i = 0; i < count; i++) {
    const tokenId = generateMessageId();
    const token = generateSenderToken();
    const tokenHash = await hashToken(token);

    tokens.push(token);
    inserts.push({
      sql: 'INSERT INTO sender_tokens (id, group_id, token_hash, used, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      params: [
        tokenId,
        groupId,
        tokenHash,
        0,
        expiresAt.toISOString(),
        now.toISOString(),
      ],
    });
  }

  // Batch insert all tokens
  await db.batch(inserts);

  return c.json({
    tokens: tokens as SealedSenderToken[],
    expiresAt: expiresAt.toISOString(),
  });
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
           m.sealed_sender, u.display_name as sender_name
    FROM messages m
    LEFT JOIN users u ON u.id = m.sender_id
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
    sender_id: UserId | null;
    encrypted_payload: string;
    nonce: string;
    created_at: string;
    deleted_at: string | null;
    sealed_sender: string | null;
    sender_name: string | null;
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
      sealedSender: m.sealed_sender,
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
      senderToken?: string;
      sealedSender?: string;
    }>();

    if (!body.encryptedPayload || !body.nonce) {
      return c.json({ error: 'encryptedPayload and nonce are required' }, 400);
    }

    let senderId: UserId | null = user.id;
    let senderName: string | null = user.displayName;

    // Sealed Sender mode: use anonymous token instead of identity
    if (body.senderToken) {
      const tokenHash = await hashToken(body.senderToken);

      // Check if token is valid and unused
      const tokenRows = await db.query<{
        id: string;
        group_id: GroupId;
        used: number;
        expires_at: string;
      }>(
        'SELECT id, group_id, used, expires_at FROM sender_tokens WHERE token_hash = ?',
        [tokenHash],
      );

      if (tokenRows.length === 0) {
        return c.json({ error: 'Invalid sender token' }, 403);
      }

      const tokenRow = tokenRows[0];

      if (tokenRow.group_id !== groupId) {
        return c.json({ error: 'Token not valid for this group' }, 403);
      }

      if (tokenRow.used !== 0) {
        return c.json({ error: 'Token already used' }, 403);
      }

      if (new Date(tokenRow.expires_at) < new Date()) {
        return c.json({ error: 'Token expired' }, 403);
      }

      // Mark token as used
      await db.execute(
        'UPDATE sender_tokens SET used = 1, used_at = ? WHERE id = ?',
        [new Date().toISOString(), tokenRow.id],
      );

      // Hide sender identity
      senderId = null;
      senderName = null;
    } else {
      // Regular mode: check membership via authenticated user
      const membership = await db.query<{ id: string }>(
        'SELECT id FROM group_members WHERE group_id = ? AND user_id = ?',
        [groupId, user.id],
      );

      if (membership.length === 0) {
        return c.json({ error: 'Not a member of this group' }, 403);
      }
    }

    const messageId = generateMessageId();
    const now = new Date().toISOString();

    await db.execute(
      'INSERT INTO messages (id, group_id, sender_id, encrypted_payload, nonce, created_at, sealed_sender) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        messageId,
        groupId,
        senderId,
        body.encryptedPayload,
        body.nonce,
        now,
        body.sealedSender ?? null,
      ],
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
      senderId,
      senderName,
      encryptedContent: body.encryptedPayload,
      timestamp: now,
      sealedSender: body.sealedSender,
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

// Image upload: store encrypted image blob in R2
groupsRouter.post('/api/groups/:id/images', requireAuth, async (c) => {
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

  const body = await c.req.arrayBuffer();
  // Allow some overhead for encryption (nonce, tag, padding)
  const maxEncryptedSize = MAX_IMAGE_SIZE_BYTES + 1024 * 64;
  if (body.byteLength === 0 || body.byteLength > maxEncryptedSize) {
    return c.json(
      {
        error: `Image must be between 1 byte and ${MAX_IMAGE_SIZE_BYTES} bytes`,
      },
      400,
    );
  }

  const attachmentId = generateHexId(16);
  const r2Key = `groups/${groupId}/${attachmentId}.bin`;
  const now = new Date().toISOString();

  await c.env.IMAGES.put(r2Key, body);
  await db.execute(
    'INSERT INTO image_attachments (id, message_id, group_id, r2_key, created_at) VALUES (?, ?, ?, ?, ?)',
    [attachmentId, '', groupId, r2Key, now],
  );

  return c.json({ key: r2Key });
});

// Image download: fetch encrypted image blob from R2
// Used in local development; production uses public R2 URL directly
groupsRouter.get('/api/groups/:id/images/:key{.+}', requireAuth, async (c) => {
  const groupId = c.req.param('id') as GroupId;
  const key = c.req.param('key');
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

  // Validate the key belongs to this group
  if (!key.startsWith(`groups/${groupId}/`)) {
    return c.json({ error: 'Invalid image key' }, 400);
  }

  const object = await c.env.IMAGES.get(key);
  if (!object) {
    return c.json({ error: 'Image not found' }, 404);
  }

  return new Response(object.body, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Cache-Control': 'private, max-age=86400',
    },
  });
});

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

    // Clean up any R2 image attachments linked to this message
    const imageRows = await db.query<{ r2_key: string }>(
      'SELECT r2_key FROM image_attachments WHERE message_id = ?',
      [messageId],
    );
    for (const row of imageRows) {
      await c.env.IMAGES.delete(row.r2_key);
    }
    if (imageRows.length > 0) {
      await db.execute('DELETE FROM image_attachments WHERE message_id = ?', [
        messageId,
      ]);
    }

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
