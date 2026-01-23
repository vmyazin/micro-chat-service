"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
const cookie_1 = require("hono/cookie");
const client_1 = require("../db/client");
async function requireAuth(c, next) {
    const sessionId = (0, cookie_1.getCookie)(c, 'session');
    if (!sessionId) {
        return c.json({ error: 'Authentication required' }, 401);
    }
    const db = new client_1.Database(c.env.DB);
    const sessions = await db.query('SELECT id, user_id, expires_at FROM sessions WHERE id = ?', [sessionId]);
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
    const users = await db.query('SELECT id, display_name FROM users WHERE id = ?', [session.user_id]);
    if (users.length === 0) {
        return c.json({ error: 'User not found' }, 401);
    }
    const user = users[0];
    c.set('user', {
        id: user.id,
        displayName: user.display_name,
    });
    await next();
}
//# sourceMappingURL=auth.js.map