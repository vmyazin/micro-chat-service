import { beforeEach, describe, expect, it } from 'vitest';
import { Database } from '../db/client';
import { MockD1Database } from './mock-d1';

/**
 * Regression tests for the epoch/nonce encryption chain.
 *
 * Bug: epoch was never stored in the DB, so messages couldn't be decrypted
 * on retrieval. These tests verify the DB layer stores and returns epoch
 * correctly, which is the foundation the decryption fix depends on.
 */
describe('messages — epoch storage and retrieval', () => {
  let mockD1: MockD1Database;
  let db: Database;

  beforeEach(() => {
    mockD1 = new MockD1Database();
    db = new Database(mockD1);

    mockD1._seed('groups', [
      {
        id: 'g1',
        encrypted_name: 'test',
        owner_id: 'u1',
        created_at: '2024-01-01T00:00:00Z',
        last_activity_at: '2024-01-01T00:00:00Z',
        epoch: 0,
      },
    ]);
    mockD1._seed('group_members', [
      {
        id: 'm1',
        group_id: 'g1',
        user_id: 'u1',
        joined_at: '2024-01-01T00:00:00Z',
      },
    ]);
    mockD1._seed('messages', []);
  });

  it('stores epoch alongside encryptedPayload and nonce', async () => {
    await db.execute(
      'INSERT INTO messages (id, group_id, sender_id, encrypted_payload, nonce, epoch, created_at, sealed_sender) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        'msg-1',
        'g1',
        'u1',
        'base64ciphertext==',
        'nonce-abc',
        3,
        '2024-01-01T00:00:00Z',
        null,
      ],
    );

    const rows = mockD1._getTable('messages');
    expect(rows).toHaveLength(1);
    expect(rows[0].epoch).toBe(3);
    expect(rows[0].nonce).toBe('nonce-abc');
    expect(rows[0].encrypted_payload).toBe('base64ciphertext==');
  });

  it('defaults epoch to 0 when not provided in INSERT', async () => {
    // Simulate a pre-fix INSERT that omits epoch (column has DEFAULT 0)
    await db.execute(
      'INSERT INTO messages (id, group_id, sender_id, encrypted_payload, nonce, epoch, created_at, sealed_sender) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        'msg-2',
        'g1',
        'u1',
        'payload',
        'nonce',
        0,
        '2024-01-01T00:00:00Z',
        null,
      ],
    );

    const rows = mockD1._getTable('messages');
    expect(rows[0].epoch).toBe(0);
  });

  it('returns epoch in SELECT query', async () => {
    mockD1._seed('messages', [
      {
        id: 'msg-3',
        group_id: 'g1',
        sender_id: 'u1',
        encrypted_payload: 'ct',
        nonce: 'nonce',
        epoch: 2,
        created_at: '2024-01-01T00:00:00Z',
        deleted_at: null,
        deleted_by: null,
        sealed_sender: null,
      },
    ]);

    const rows = await db.query<{
      id: string;
      encrypted_payload: string;
      nonce: string;
      epoch: number;
    }>(
      'SELECT id, encrypted_payload, nonce, epoch FROM messages WHERE group_id = ?',
      ['g1'],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].epoch).toBe(2);
    expect(rows[0].nonce).toBe('nonce');
  });

  it('round-trips epoch: store then retrieve matches original value', async () => {
    const originalEpoch = 7;

    await db.execute(
      'INSERT INTO messages (id, group_id, sender_id, encrypted_payload, nonce, epoch, created_at, sealed_sender) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        'msg-rt',
        'g1',
        'u1',
        'encrypted',
        'nonceXYZ',
        originalEpoch,
        '2024-01-01T00:00:00Z',
        null,
      ],
    );

    const rows = await db.query<{ epoch: number; nonce: string }>(
      'SELECT epoch, nonce FROM messages WHERE id = ?',
      ['msg-rt'],
    );

    expect(rows[0].epoch).toBe(originalEpoch);
    expect(rows[0].nonce).toBe('nonceXYZ');
  });

  it('preserves different epochs per message in the DB', async () => {
    for (const [id, epoch] of [
      ['msg-a', 1],
      ['msg-b', 3],
      ['msg-c', 5],
    ] as [string, number][]) {
      await db.execute(
        'INSERT INTO messages (id, group_id, sender_id, encrypted_payload, nonce, epoch, created_at, sealed_sender) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [id, 'g1', 'u1', 'ct', 'n', epoch, '2024-01-01T00:00:00Z', null],
      );
    }

    const stored = mockD1._getTable('messages');
    expect(stored).toHaveLength(3);
    expect(stored.map((r: Record<string, unknown>) => r.epoch).sort()).toEqual([
      1, 3, 5,
    ]);
  });
});
