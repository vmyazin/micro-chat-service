import { Hono } from 'hono';
import { rateLimitApi, rateLimitAuth } from './middleware/rate-limit';
import { type AuthEnv, authRouter } from './routes/auth';
import { type GroupsEnv, groupsRouter } from './routes/groups';

export interface AppEnv extends AuthEnv, GroupsEnv {}

const app = new Hono<{ Bindings: AppEnv }>();

app.get('/health', (c) => {
  return c.json({ status: 'ok' });
});

// Apply rate limiting
app.use('/api/auth/*', rateLimitAuth());
app.use('/api/groups/*', rateLimitApi());

app.route('', authRouter);
app.route('', groupsRouter);

export { app };
