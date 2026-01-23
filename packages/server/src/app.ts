import { Hono } from 'hono';
import { authRouter, type AuthEnv } from './routes/auth';
import { groupsRouter, type GroupsEnv } from './routes/groups';

export interface AppEnv extends AuthEnv, GroupsEnv {}

const app = new Hono<{ Bindings: AppEnv }>();

app.get('/health', (c) => {
  return c.json({ status: 'ok' });
});

app.route('', authRouter);
app.route('', groupsRouter);

export { app };
