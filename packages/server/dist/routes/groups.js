"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.groupsRouter = void 0;
const hono_1 = require("hono");
const shared_1 = require("@microchat/shared");
const client_1 = require("../db/client");
const auth_1 = require("../middleware/auth");
const groupsRouter = new hono_1.Hono();
exports.groupsRouter = groupsRouter;
function generateGroupId() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}
function generateMemberId() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}
function generateInviteCode() {
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}
groupsRouter.get('/api/groups', auth_1.requireAuth, async (c) => {
    const user = c.get('user');
    const db = new client_1.Database(c.env.DB);
    const groups = await db.query(`SELECT g.id, g.encrypted_name, g.last_activity_at,
            (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) as member_count
     FROM groups g
     INNER JOIN group_members m ON m.group_id = g.id
     WHERE m.user_id = ?
     ORDER BY g.last_activity_at DESC`, [user.id]);
    const result = groups.map((g) => ({
        groupId: g.id,
        encryptedName: g.encrypted_name,
        memberCount: g.member_count,
        lastActivity: g.last_activity_at,
    }));
    return c.json(result);
});
groupsRouter.post('/api/groups', auth_1.requireAuth, async (c) => {
    const body = await c.req.json();
    if (!body.encryptedName || typeof body.encryptedName !== 'string') {
        return c.json({ error: 'encryptedName is required' }, 400);
    }
    const user = c.get('user');
    const db = new client_1.Database(c.env.DB);
    const now = new Date().toISOString();
    const groupId = generateGroupId();
    const memberId = generateMemberId();
    await db.execute('INSERT INTO groups (id, encrypted_name, owner_id, created_at, last_activity_at) VALUES (?, ?, ?, ?, ?)', [groupId, body.encryptedName, user.id, now, now]);
    await db.execute('INSERT INTO group_members (id, group_id, user_id, joined_at) VALUES (?, ?, ?, ?)', [memberId, groupId, user.id, now]);
    return c.json({
        groupId,
        epoch: 0,
    });
});
groupsRouter.post('/api/groups/:id/invites', auth_1.requireAuth, async (c) => {
    const groupId = c.req.param('id');
    const user = c.get('user');
    const db = new client_1.Database(c.env.DB);
    const membership = await db.query('SELECT id FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, user.id]);
    if (membership.length === 0) {
        return c.json({ error: 'Not a member of this group' }, 403);
    }
    const now = new Date();
    const expiresAt = new Date(now.getTime() + shared_1.InviteConfig.MAX_AGE_DAYS * 24 * 60 * 60 * 1000);
    const inviteCode = generateInviteCode();
    await db.execute('INSERT INTO invites (id, group_id, created_by, expires_at, used) VALUES (?, ?, ?, ?, ?)', [inviteCode, groupId, user.id, expiresAt.toISOString(), 0]);
    return c.json({
        code: inviteCode,
        expiresAt: expiresAt.toISOString(),
    });
});
groupsRouter.post('/api/invites/:code/accept', auth_1.requireAuth, async (c) => {
    const code = c.req.param('code');
    const user = c.get('user');
    const db = new client_1.Database(c.env.DB);
    const now = new Date().toISOString();
    const invites = await db.query('SELECT id, group_id, expires_at, used FROM invites WHERE id = ?', [code]);
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
    const existingMembership = await db.query('SELECT id FROM group_members WHERE group_id = ? AND user_id = ?', [invite.group_id, user.id]);
    if (existingMembership.length > 0) {
        return c.json({ error: 'Already a member of this group' }, 400);
    }
    const memberId = generateMemberId();
    await db.execute('UPDATE invites SET used = 1, used_by = ?, used_at = ? WHERE id = ?', [
        user.id,
        now,
        code,
    ]);
    await db.execute('INSERT INTO group_members (id, group_id, user_id, joined_at) VALUES (?, ?, ?, ?)', [
        memberId,
        invite.group_id,
        user.id,
        now,
    ]);
    const groups = await db.query('SELECT id, encrypted_name, owner_id FROM groups WHERE id = ?', [invite.group_id]);
    const group = groups[0];
    return c.json({
        groupId: group.id,
        encryptedName: group.encrypted_name,
        ownerId: group.owner_id,
    });
});
groupsRouter.delete('/api/groups/:id/members/:userId', auth_1.requireAuth, async (c) => {
    const groupId = c.req.param('id');
    const targetUserId = c.req.param('userId');
    const user = c.get('user');
    const db = new client_1.Database(c.env.DB);
    if (targetUserId === user.id) {
        return c.json({ error: 'Cannot remove yourself. Use leave endpoint instead.' }, 400);
    }
    const groups = await db.query('SELECT owner_id FROM groups WHERE id = ?', [groupId]);
    if (groups.length === 0) {
        return c.json({ error: 'Group not found' }, 404);
    }
    if (groups[0].owner_id !== user.id) {
        return c.json({ error: 'Only the group owner can remove members' }, 403);
    }
    const membership = await db.query('SELECT id FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, targetUserId]);
    if (membership.length === 0) {
        return c.json({ error: 'User is not a member of this group' }, 404);
    }
    await db.execute('DELETE FROM group_members WHERE group_id = ? AND user_id = ?', [
        groupId,
        targetUserId,
    ]);
    return c.json({ success: true });
});
//# sourceMappingURL=groups.js.map