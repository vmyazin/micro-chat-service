import { Hono } from 'hono';
import { authRouter, type AuthEnv } from './routes/auth';

export interface AppEnv extends AuthEnv {}

const app = new Hono<{ Bindings: AppEnv }>();

app.get('/health', (c) => {
  return c.json({ status: 'ok' });
});

app.route('', authRouter);

export { app };
