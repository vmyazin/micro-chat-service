import { Hono } from 'hono';
import { type AuthEnv, authRouter } from './routes/auth';
import { type GroupsEnv, groupsRouter } from './routes/groups';

export interface AppEnv extends AuthEnv, GroupsEnv {}

const app = new Hono<{ Bindings: AppEnv }>();

app.get('/health', (c) => {
  return c.json({ status: 'ok' });
});

app.route('', authRouter);
app.route('', groupsRouter);

export { app };
