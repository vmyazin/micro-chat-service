import type { Context, Next } from 'hono';

interface RateLimitConfig {
  /** Max requests allowed in the window */
  maxRequests: number;
  /** Window size in milliseconds */
  windowMs: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * In-memory sliding window rate limiter.
 *
 * For Cloudflare Workers production, this limits per-isolate which provides
 * partial protection. For stronger guarantees, replace the store with
 * Durable Objects or Workers KV.
 */
export class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private cleanupCounter = 0;
  private readonly CLEANUP_INTERVAL = 100;

  constructor(private readonly config: RateLimitConfig) {}

  /**
   * Check if a key is rate limited. Returns remaining requests or -1 if limited.
   */
  check(key: string): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    this.maybeCleanup(now);

    const entry = this.store.get(key);

    if (!entry || entry.resetAt <= now) {
      this.store.set(key, { count: 1, resetAt: now + this.config.windowMs });
      return {
        allowed: true,
        remaining: this.config.maxRequests - 1,
        resetAt: now + this.config.windowMs,
      };
    }

    if (entry.count >= this.config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: entry.resetAt,
      };
    }

    entry.count++;
    return {
      allowed: true,
      remaining: this.config.maxRequests - entry.count,
      resetAt: entry.resetAt,
    };
  }

  private maybeCleanup(now: number): void {
    this.cleanupCounter++;
    if (this.cleanupCounter < this.CLEANUP_INTERVAL) return;
    this.cleanupCounter = 0;

    for (const [key, entry] of this.store) {
      if (entry.resetAt <= now) {
        this.store.delete(key);
      }
    }
  }
}

/** Rate limiters for different endpoint categories */
const authLimiter = new RateLimiter({ maxRequests: 10, windowMs: 60_000 });
const apiLimiter = new RateLimiter({ maxRequests: 60, windowMs: 60_000 });
const messageLimiter = new RateLimiter({ maxRequests: 30, windowMs: 60_000 });

function getClientIp(c: Context): string {
  return (
    c.req.header('cf-connecting-ip') ??
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  );
}

function rateLimitResponse(c: Context, resetAt: number): Response {
  const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
  return c.json(
    { error: 'Too many requests' },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfter),
      },
    },
  );
}

/**
 * Rate limit middleware for auth endpoints (10 req/min per IP).
 */
export function rateLimitAuth() {
  return async (c: Context, next: Next) => {
    const ip = getClientIp(c);
    const result = authLimiter.check(`auth:${ip}`);

    if (!result.allowed) {
      return rateLimitResponse(c, result.resetAt);
    }

    c.header('X-RateLimit-Remaining', String(result.remaining));
    await next();
  };
}

/**
 * Rate limit middleware for general API endpoints (60 req/min per IP).
 */
export function rateLimitApi() {
  return async (c: Context, next: Next) => {
    const ip = getClientIp(c);
    const result = apiLimiter.check(`api:${ip}`);

    if (!result.allowed) {
      return rateLimitResponse(c, result.resetAt);
    }

    c.header('X-RateLimit-Remaining', String(result.remaining));
    await next();
  };
}

/**
 * Rate limit middleware for message sending (30 req/min per IP).
 */
export function rateLimitMessages() {
  return async (c: Context, next: Next) => {
    const ip = getClientIp(c);
    const result = messageLimiter.check(`msg:${ip}`);

    if (!result.allowed) {
      return rateLimitResponse(c, result.resetAt);
    }

    c.header('X-RateLimit-Remaining', String(result.remaining));
    await next();
  };
}
