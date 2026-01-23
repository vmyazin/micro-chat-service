"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.groupsRouter = void 0;
const hono_1 = require("hono");
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
//# sourceMappingURL=groups.js.map