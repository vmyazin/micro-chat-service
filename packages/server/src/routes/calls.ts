import { Hono } from 'hono';
import {
  type AuthEnv as AuthMiddlewareEnv,
  type AuthVariables,
  requireAuth,
} from '../middleware/auth';

export interface CallsEnv extends AuthMiddlewareEnv {}

type IceServer = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

const callsRouter = new Hono<{
  Bindings: CallsEnv;
  Variables: AuthVariables;
}>();

callsRouter.get('/api/calls/ice-servers', requireAuth, (c) => {
  const iceServers: IceServer[] = [
    {
      urls: ['stun:stun.l.google.com:19302'],
    },
  ];

  return c.json({ iceServers, ttl: 3600 });
});

export { callsRouter };
