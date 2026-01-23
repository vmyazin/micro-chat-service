import { getCookie } from 'hono/cookie';
import type { Context, Next } from 'hono';
import type { UserId } from '@microchat/shared';
import { Database, type D1Database } from '../db/client';
import type { UsersTable, SessionsTable } from '../db/schema';

export interface AuthUser {
  id: UserId;
  displayName: string;
}

export interface AuthVariables {
  user: AuthUser;
}

export interface AuthEnv {
  DB: D1Database;
}

export async function requireAuth(
  c: Context<{ Bindings: AuthEnv; Variables: AuthVariables }>,
  next: Next
): Promise<Response | void> {
  const sessionId = getCookie(c, 'session');

  if (!sessionId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const db = new Database(c.env.DB);

  const sessions = await db.query<SessionsTable>(
    'SELECT id, user_id, expires_at FROM sessions WHERE id = ?',
    [sessionId]
  );

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

  const users = await db.query<UsersTable>(
    'SELECT id, display_name FROM users WHERE id = ?',
    [session.user_id]
  );

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
