import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RateLimiter } from '../middleware/rate-limit';

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter({ maxRequests: 3, windowMs: 60_000 });
  });

  it('allows requests under the limit', () => {
    const r1 = limiter.check('ip-1');
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);

    const r2 = limiter.check('ip-1');
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(1);

    const r3 = limiter.check('ip-1');
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);
  });

  it('blocks requests over the limit', () => {
    limiter.check('ip-1');
    limiter.check('ip-1');
    limiter.check('ip-1');

    const r4 = limiter.check('ip-1');
    expect(r4.allowed).toBe(false);
    expect(r4.remaining).toBe(0);
  });

  it('tracks keys independently', () => {
    limiter.check('ip-1');
    limiter.check('ip-1');
    limiter.check('ip-1');

    const r = limiter.check('ip-2');
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(2);
  });

  it('resets after the window expires', () => {
    vi.useFakeTimers();
    try {
      limiter.check('ip-1');
      limiter.check('ip-1');
      limiter.check('ip-1');

      const blocked = limiter.check('ip-1');
      expect(blocked.allowed).toBe(false);

      // Advance past the window
      vi.advanceTimersByTime(60_001);

      const afterReset = limiter.check('ip-1');
      expect(afterReset.allowed).toBe(true);
      expect(afterReset.remaining).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns a resetAt timestamp in the future', () => {
    const now = Date.now();
    const result = limiter.check('ip-1');
    expect(result.resetAt).toBeGreaterThan(now);
    expect(result.resetAt).toBeLessThanOrEqual(now + 60_000 + 10);
  });
});
