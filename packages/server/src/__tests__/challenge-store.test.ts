import { beforeEach, describe, expect, it } from 'vitest';
import { ChallengeStore } from '../routes/auth';
import { MockD1Database } from './mock-d1';

describe('ChallengeStore', () => {
  let mockD1: MockD1Database;
  let store: ChallengeStore;

  beforeEach(() => {
    mockD1 = new MockD1Database();
    mockD1._seed('challenges', []);
    store = new ChallengeStore(mockD1);
  });

  describe('set', () => {
    it('stores a registration challenge', async () => {
      await store.set({
        challenge: 'abc123',
        userId: 'user-1',
        displayName: 'Alice',
        expiresAt: Date.now() + 60_000,
        type: 'registration',
      });

      const rows = mockD1._getTable('challenges');
      expect(rows).toHaveLength(1);
      expect(rows[0].challenge).toBe('abc123');
      expect(rows[0].user_id).toBe('user-1');
      expect(rows[0].display_name).toBe('Alice');
      expect(rows[0].type).toBe('registration');
    });

    it('stores an authentication challenge without userId', async () => {
      await store.set({
        challenge: 'def456',
        expiresAt: Date.now() + 60_000,
        type: 'authentication',
      });

      const rows = mockD1._getTable('challenges');
      expect(rows).toHaveLength(1);
      expect(rows[0].challenge).toBe('def456');
      expect(rows[0].user_id).toBeNull();
      expect(rows[0].display_name).toBeNull();
      expect(rows[0].type).toBe('authentication');
    });
  });

  describe('get', () => {
    it('returns stored challenge data', async () => {
      const expiresAt = Date.now() + 60_000;
      await store.set({
        challenge: 'abc123',
        userId: 'user-1',
        displayName: 'Alice',
        expiresAt,
        type: 'registration',
      });

      const result = await store.get('abc123');
      expect(result).not.toBeNull();
      expect(result?.challenge).toBe('abc123');
      expect(result?.userId).toBe('user-1');
      expect(result?.displayName).toBe('Alice');
      expect(result?.type).toBe('registration');
    });

    it('returns null for non-existent challenge', async () => {
      const result = await store.get('nonexistent');
      expect(result).toBeNull();
    });

    it('returns undefined for optional fields when not set', async () => {
      await store.set({
        challenge: 'auth-challenge',
        expiresAt: Date.now() + 60_000,
        type: 'authentication',
      });

      const result = await store.get('auth-challenge');
      expect(result).not.toBeNull();
      expect(result?.userId).toBeUndefined();
      expect(result?.displayName).toBeUndefined();
    });
  });

  describe('delete', () => {
    it('removes a challenge', async () => {
      await store.set({
        challenge: 'abc123',
        expiresAt: Date.now() + 60_000,
        type: 'registration',
      });

      await store.delete('abc123');

      const result = await store.get('abc123');
      expect(result).toBeNull();
    });

    it('does not fail when deleting non-existent challenge', async () => {
      await expect(store.delete('nonexistent')).resolves.not.toThrow();
    });
  });

  describe('deleteExpired', () => {
    it('removes expired challenges and returns count', async () => {
      const pastExpiry = new Date(Date.now() - 60_000).toISOString();
      const futureExpiry = new Date(Date.now() + 60_000).toISOString();

      mockD1._seed('challenges', [
        {
          challenge: 'expired-1',
          user_id: null,
          display_name: null,
          type: 'registration',
          expires_at: pastExpiry,
        },
        {
          challenge: 'expired-2',
          user_id: null,
          display_name: null,
          type: 'authentication',
          expires_at: pastExpiry,
        },
        {
          challenge: 'valid-1',
          user_id: null,
          display_name: null,
          type: 'authentication',
          expires_at: futureExpiry,
        },
      ]);

      const count = await store.deleteExpired();

      expect(count).toBe(2);
      const remaining = mockD1._getTable('challenges');
      expect(remaining).toHaveLength(1);
      expect(remaining[0].challenge).toBe('valid-1');
    });

    it('returns 0 when no challenges are expired', async () => {
      const futureExpiry = new Date(Date.now() + 60_000).toISOString();
      mockD1._seed('challenges', [
        {
          challenge: 'valid-1',
          user_id: null,
          display_name: null,
          type: 'authentication',
          expires_at: futureExpiry,
        },
      ]);

      const count = await store.deleteExpired();
      expect(count).toBe(0);
    });
  });
});
