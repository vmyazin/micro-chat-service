import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { Database } from './db/client';
import { rateLimitApi, rateLimitAuth } from './middleware/rate-limit';
import { type AuthEnv, authRouter } from './routes/auth';
import { type GroupsEnv, groupsRouter } from './routes/groups';

export interface AppEnv extends AuthEnv, GroupsEnv {
  CHAT_HUB: DurableObjectNamespace;
}

const app = new Hono<{ Bindings: AppEnv }>();

app.get('/health', (c) => {
  return c.json({ status: 'ok' });
});

// Apply rate limiting.
// Session-check endpoint is high-frequency (called by Next.js middleware on
// every navigation), so it uses the general API limiter instead of the
// stricter auth limiter reserved for login/register mutations.
app.use('/api/auth/*', async (c, next) => {
  if (new URL(c.req.url).pathname === '/api/auth/me') {
    return rateLimitApi()(c, next);
  }
  return rateLimitAuth()(c, next);
});
app.use('/api/groups/*', rateLimitApi());

// WebSocket upgrade endpoint
app.get('/ws', async (c) => {
  const upgradeHeader = c.req.header('Upgrade');
  if (upgradeHeader !== 'websocket') {
    return c.text('Expected WebSocket upgrade', 426);
  }

  // Authenticate via session cookie
  const sessionId = getCookie(c, 'session');
  if (!sessionId) {
    return c.text('Authentication required', 401);
  }

  const db = new Database(c.env.DB);
  const sessions = await db.query<{
    user_id: string;
    expires_at: string;
  }>('SELECT user_id, expires_at FROM sessions WHERE id = ?', [sessionId]);

  if (sessions.length === 0 || new Date(sessions[0].expires_at) < new Date()) {
    return c.text('Invalid or expired session', 401);
  }

  const users = await db.query<{ id: string; display_name: string }>(
    'SELECT id, display_name FROM users WHERE id = ?',
    [sessions[0].user_id],
  );

  if (users.length === 0) {
    return c.text('User not found', 401);
  }

  const user = users[0];

  // Route to the ChatHub Durable Object
  const hubId = c.env.CHAT_HUB.idFromName('main');
  const hub = c.env.CHAT_HUB.get(hubId);

  const url = new URL(c.req.url);
  url.pathname = '/ws';
  url.searchParams.set('userId', user.id);
  url.searchParams.set('displayName', user.display_name);

  return hub.fetch(url.toString(), c.req.raw);
});

app.route('', authRouter);
app.route('', groupsRouter);

export { app };
