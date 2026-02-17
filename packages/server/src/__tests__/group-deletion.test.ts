import { describe, it, expect, beforeEach } from 'vitest';
import { Database } from '../db/client';
import { MockD1Database } from './mock-d1';

describe('Group deletion (atomic batch)', () => {
  let mockD1: MockD1Database;
  let db: Database;

  beforeEach(() => {
    mockD1 = new MockD1Database();
    mockD1._seed('groups', [
      { id: 'g1', encrypted_name: 'test', owner_id: 'u1', created_at: '2024-01-01', last_activity_at: '2024-01-01' },
    ]);
    mockD1._seed('group_members', [
      { id: 'm1', group_id: 'g1', user_id: 'u1', joined_at: '2024-01-01' },
      { id: 'm2', group_id: 'g1', user_id: 'u2', joined_at: '2024-01-02' },
    ]);
    mockD1._seed('messages', [
      { id: 'msg1', group_id: 'g1', sender_id: 'u1', encrypted_payload: 'hello', nonce: 'n1', created_at: '2024-01-01', deleted_at: null, deleted_by: null },
    ]);
    mockD1._seed('invites', [
      { id: 'inv1', group_id: 'g1', created_by: 'u1', expires_at: '2025-01-01', used: 0 },
    ]);
    db = new Database(mockD1);
  });

  it('deletes all group data in a single batch', async () => {
    const results = await db.batch([
      { sql: 'DELETE FROM messages WHERE group_id = ?', params: ['g1'] },
      { sql: 'DELETE FROM invites WHERE group_id = ?', params: ['g1'] },
      { sql: 'DELETE FROM group_members WHERE group_id = ?', params: ['g1'] },
      { sql: 'DELETE FROM groups WHERE id = ?', params: ['g1'] },
    ]);

    expect(results).toHaveLength(4);
    for (const result of results) {
      expect(result.success).toBe(true);
    }

    expect(mockD1._getTable('messages')).toHaveLength(0);
    expect(mockD1._getTable('invites')).toHaveLength(0);
    expect(mockD1._getTable('group_members')).toHaveLength(0);
    expect(mockD1._getTable('groups')).toHaveLength(0);
  });

  it('does not affect other groups', async () => {
    // Add another group's data
    mockD1._seed('groups', [
      { id: 'g1', encrypted_name: 'test', owner_id: 'u1', created_at: '2024-01-01', last_activity_at: '2024-01-01' },
      { id: 'g2', encrypted_name: 'other', owner_id: 'u3', created_at: '2024-01-01', last_activity_at: '2024-01-01' },
    ]);
    mockD1._seed('group_members', [
      { id: 'm1', group_id: 'g1', user_id: 'u1', joined_at: '2024-01-01' },
      { id: 'm3', group_id: 'g2', user_id: 'u3', joined_at: '2024-01-01' },
    ]);

    await db.batch([
      { sql: 'DELETE FROM messages WHERE group_id = ?', params: ['g1'] },
      { sql: 'DELETE FROM invites WHERE group_id = ?', params: ['g1'] },
      { sql: 'DELETE FROM group_members WHERE group_id = ?', params: ['g1'] },
      { sql: 'DELETE FROM groups WHERE id = ?', params: ['g1'] },
    ]);

    // g2 data should still exist
    const remainingGroups = mockD1._getTable('groups');
    expect(remainingGroups).toHaveLength(1);
    expect(remainingGroups[0].id).toBe('g2');

    const remainingMembers = mockD1._getTable('group_members');
    expect(remainingMembers).toHaveLength(1);
    expect(remainingMembers[0].group_id).toBe('g2');
  });
});
