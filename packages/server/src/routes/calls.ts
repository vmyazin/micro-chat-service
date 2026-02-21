import { Hono } from 'hono';
import {
  type AuthEnv as AuthMiddlewareEnv,
  type AuthVariables,
  requireAuth,
} from '../middleware/auth';

export interface CallsEnv extends AuthMiddlewareEnv {
  CLOUDFLARE_CALLS_APP_ID: string;
  CLOUDFLARE_CALLS_TOKEN: string;
  ICE_FALLBACK_SERVERS?: string;
}

type IceServer = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

interface CloudflareIceResponse {
  iceServers?: IceServer[];
  urls?: string[];
  username?: string;
  credential?: string;
  ttl?: number;
}

const TURN_TTL_SECONDS = 3600;
const STUN_FALLBACK: IceServer = {
  urls: ['stun:stun.l.google.com:19302'],
};

function parseFallbackServers(raw?: string): IceServer[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (entry): entry is IceServer =>
        entry &&
        typeof entry === 'object' &&
        'urls' in entry &&
        (typeof (entry as IceServer).urls === 'string' ||
          Array.isArray((entry as IceServer).urls)),
    );
  } catch (error) {
    console.error('[calls] Failed to parse ICE_FALLBACK_SERVERS', error);
    return [];
  }
}

const callsRouter = new Hono<{
  Bindings: CallsEnv;
  Variables: AuthVariables;
}>();

callsRouter.get('/api/calls/ice-servers', requireAuth, async (c) => {
  const appId = c.env.CLOUDFLARE_CALLS_APP_ID;
  const token = c.env.CLOUDFLARE_CALLS_TOKEN;

  if (!appId || !token) {
    return c.json(
      { error: 'Cloudflare Calls credentials not configured' },
      500,
    );
  }

  const response = await fetch(
    `https://rtc.live.cloudflare.com/v1/turn/keys/${appId}/credentials/generate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ttl: TURN_TTL_SECONDS }),
    },
  );

  const fallbackServers = parseFallbackServers(c.env.ICE_FALLBACK_SERVERS);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[calls] Cloudflare TURN credentials failed', errorText);
    return c.json(
      {
        iceServers: [STUN_FALLBACK, ...fallbackServers],
        ttl: TURN_TTL_SECONDS,
      },
      200,
    );
  }

  const data = (await response.json()) as CloudflareIceResponse;

  const cloudflareServers: IceServer[] = [];
  if (Array.isArray(data.iceServers)) {
    cloudflareServers.push(...data.iceServers);
  } else if (data.urls && data.username && data.credential) {
    cloudflareServers.push({
      urls: data.urls,
      username: data.username,
      credential: data.credential,
    });
  }

  const iceServers = [...cloudflareServers, ...fallbackServers, STUN_FALLBACK];
  const ttl = typeof data.ttl === 'number' ? data.ttl : TURN_TTL_SECONDS;

  return c.json({ iceServers, ttl });
});

export { callsRouter };
