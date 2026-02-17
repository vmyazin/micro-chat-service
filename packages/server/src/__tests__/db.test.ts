import { beforeEach, describe, expect, it } from 'vitest';
import { Database } from '../db/client';
import { MockD1Database } from './mock-d1';

describe('Database', () => {
  let mockD1: MockD1Database;
  let db: Database;

  beforeEach(() => {
    mockD1 = new MockD1Database();
    db = new Database(mockD1);
  });

  describe('query', () => {
    it('returns rows matching a query', async () => {
      mockD1._seed('users', [
        { id: 'u1', display_name: 'Alice', created_at: '2024-01-01' },
        { id: 'u2', display_name: 'Bob', created_at: '2024-01-02' },
      ]);

      const rows = await db.query<{ id: string; display_name: string }>(
        'SELECT id, display_name FROM users WHERE id = ?',
        ['u1'],
      );

      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe('u1');
      expect(rows[0].display_name).toBe('Alice');
    });

    it('returns empty array when no rows match', async () => {
      mockD1._seed('users', []);
      const rows = await db.query('SELECT id FROM users WHERE id = ?', [
        'nope',
      ]);
      expect(rows).toEqual([]);
    });
  });

  describe('execute', () => {
    it('inserts a row', async () => {
      mockD1._seed('users', []);

      const result = await db.execute(
        'INSERT INTO users (id, display_name, created_at) VALUES (?, ?, ?)',
        ['u1', 'Alice', '2024-01-01'],
      );

      expect(result.success).toBe(true);
      expect(result.meta?.changes).toBe(1);

      const rows = mockD1._getTable('users');
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe('u1');
    });

    it('deletes matching rows', async () => {
      mockD1._seed('sessions', [
        { id: 's1', user_id: 'u1', expires_at: '2024-01-01' },
        { id: 's2', user_id: 'u2', expires_at: '2024-06-01' },
      ]);

      await db.execute('DELETE FROM sessions WHERE id = ?', ['s1']);

      const rows = mockD1._getTable('sessions');
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe('s2');
    });
  });

  describe('batch', () => {
    it('executes multiple statements', async () => {
      mockD1._seed('users', []);
      mockD1._seed('sessions', []);

      const results = await db.batch([
        {
          sql: 'INSERT INTO users (id, display_name) VALUES (?, ?)',
          params: ['u1', 'Alice'],
        },
        {
          sql: 'INSERT INTO sessions (id, user_id) VALUES (?, ?)',
          params: ['s1', 'u1'],
        },
      ]);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(mockD1._getTable('users')).toHaveLength(1);
      expect(mockD1._getTable('sessions')).toHaveLength(1);
    });
  });
});
