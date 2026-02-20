import { beforeEach, describe, expect, it } from 'vitest';
import { Database } from '../db/client';
import { runRetentionCleanup } from '../jobs/retention';
import { MockD1Database } from './mock-d1';

class MockR2Bucket {
  private objects = new Map<string, ArrayBuffer>();
  deleted: string[] = [];

  async put(key: string, value: ArrayBuffer | ReadableStream | string): Promise<void> {
    this.objects.set(
      key,
      typeof value === 'string' ? new TextEncoder().encode(value).buffer as ArrayBuffer : value as ArrayBuffer,
    );
  }

  async get(key: string): Promise<{ body: ReadableStream } | null> {
    const data = this.objects.get(key);
    if (!data) return null;
    return {
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(data));
          controller.close();
        },
      }),
    };
  }

  async delete(key: string): Promise<void> {
    this.objects.delete(key);
    this.deleted.push(key);
  }

  _has(key: string): boolean {
    return this.objects.has(key);
  }
}

describe('Retention cleanup with image attachments', () => {
  let mockD1: MockD1Database;
  let db: Database;
  let r2: MockR2Bucket;

  beforeEach(() => {
    mockD1 = new MockD1Database();
    db = new Database(mockD1);
    r2 = new MockR2Bucket();

    // Seed empty tables that the retention job touches
    mockD1._seed('delivery_receipts', []);
    mockD1._seed('challenges', []);
    mockD1._seed('image_attachments', []);
  });

  it('deletes expired image attachments and their R2 objects', async () => {
    const expired = new Date();
    expired.setDate(expired.getDate() - 31);
    const expiredISO = expired.toISOString();

    const r2Key = 'groups/g1/abc123.bin';
    await r2.put(r2Key, new ArrayBuffer(128));

    mockD1._seed('image_attachments', [
      {
        id: 'ia1',
        message_id: 'msg1',
        group_id: 'g1',
        r2_key: r2Key,
        created_at: expiredISO,
      },
    ]);

    const result = await runRetentionCleanup(db, mockD1 as unknown as D1Database, r2 as unknown as R2Bucket);

    expect(result.expiredImagesDeleted).toBe(1);
    expect(r2.deleted).toContain(r2Key);
    expect(r2._has(r2Key)).toBe(false);
    expect(mockD1._getTable('image_attachments')).toHaveLength(0);
  });

  it('does not delete non-expired image attachments', async () => {
    const recent = new Date().toISOString();
    const r2Key = 'groups/g1/recent.bin';
    await r2.put(r2Key, new ArrayBuffer(64));

    mockD1._seed('image_attachments', [
      {
        id: 'ia2',
        message_id: 'msg2',
        group_id: 'g1',
        r2_key: r2Key,
        created_at: recent,
      },
    ]);

    const result = await runRetentionCleanup(db, mockD1 as unknown as D1Database, r2 as unknown as R2Bucket);

    expect(result.expiredImagesDeleted).toBe(0);
    expect(r2.deleted).toHaveLength(0);
    expect(r2._has(r2Key)).toBe(true);
    expect(mockD1._getTable('image_attachments')).toHaveLength(1);
  });

  it('handles mixed expired and non-expired attachments', async () => {
    const expired = new Date();
    expired.setDate(expired.getDate() - 31);
    const expiredISO = expired.toISOString();
    const recentISO = new Date().toISOString();

    const oldKey = 'groups/g1/old.bin';
    const newKey = 'groups/g1/new.bin';
    await r2.put(oldKey, new ArrayBuffer(64));
    await r2.put(newKey, new ArrayBuffer(64));

    mockD1._seed('image_attachments', [
      {
        id: 'ia-old',
        message_id: 'msg-old',
        group_id: 'g1',
        r2_key: oldKey,
        created_at: expiredISO,
      },
      {
        id: 'ia-new',
        message_id: 'msg-new',
        group_id: 'g1',
        r2_key: newKey,
        created_at: recentISO,
      },
    ]);

    const result = await runRetentionCleanup(db, mockD1 as unknown as D1Database, r2 as unknown as R2Bucket);

    expect(result.expiredImagesDeleted).toBe(1);
    expect(r2.deleted).toEqual([oldKey]);
    expect(r2._has(newKey)).toBe(true);
    expect(mockD1._getTable('image_attachments')).toHaveLength(1);
    expect(mockD1._getTable('image_attachments')[0].id).toBe('ia-new');
  });

  it('works without R2 bucket (images parameter omitted)', async () => {
    const expired = new Date();
    expired.setDate(expired.getDate() - 31);

    mockD1._seed('image_attachments', [
      {
        id: 'ia1',
        message_id: 'msg1',
        group_id: 'g1',
        r2_key: 'groups/g1/x.bin',
        created_at: expired.toISOString(),
      },
    ]);

    const result = await runRetentionCleanup(db, mockD1 as unknown as D1Database);

    // Should not crash; images left untouched
    expect(result.expiredImagesDeleted).toBe(0);
    expect(mockD1._getTable('image_attachments')).toHaveLength(1);
  });
});

describe('Image attachment cleanup on group deletion', () => {
  let mockD1: MockD1Database;
  let db: Database;

  beforeEach(() => {
    mockD1 = new MockD1Database();
    db = new Database(mockD1);
  });

  it('deletes image_attachments in batch alongside other group data', async () => {
    mockD1._seed('image_attachments', [
      { id: 'ia1', message_id: 'msg1', group_id: 'g1', r2_key: 'groups/g1/a.bin', created_at: '2024-01-01' },
      { id: 'ia2', message_id: 'msg2', group_id: 'g1', r2_key: 'groups/g1/b.bin', created_at: '2024-01-02' },
      { id: 'ia3', message_id: 'msg3', group_id: 'g2', r2_key: 'groups/g2/c.bin', created_at: '2024-01-01' },
    ]);
    mockD1._seed('messages', [
      { id: 'msg1', group_id: 'g1', sender_id: 'u1', encrypted_payload: '...', nonce: 'n1', created_at: '2024-01-01', deleted_at: null, deleted_by: null },
    ]);
    mockD1._seed('invites', []);
    mockD1._seed('group_members', [
      { id: 'm1', group_id: 'g1', user_id: 'u1', joined_at: '2024-01-01' },
    ]);
    mockD1._seed('groups', [
      { id: 'g1', encrypted_name: 'test', owner_id: 'u1', created_at: '2024-01-01', last_activity_at: '2024-01-01' },
    ]);

    const results = await db.batch([
      { sql: 'DELETE FROM image_attachments WHERE group_id = ?', params: ['g1'] },
      { sql: 'DELETE FROM messages WHERE group_id = ?', params: ['g1'] },
      { sql: 'DELETE FROM invites WHERE group_id = ?', params: ['g1'] },
      { sql: 'DELETE FROM group_members WHERE group_id = ?', params: ['g1'] },
      { sql: 'DELETE FROM groups WHERE id = ?', params: ['g1'] },
    ]);

    expect(results).toHaveLength(5);
    for (const result of results) {
      expect(result.success).toBe(true);
    }

    // g1 attachments deleted
    const remaining = mockD1._getTable('image_attachments');
    expect(remaining).toHaveLength(1);
    expect(remaining[0].group_id).toBe('g2');
  });
});

describe('Image attachment cleanup on message deletion', () => {
  let mockD1: MockD1Database;
  let db: Database;

  beforeEach(() => {
    mockD1 = new MockD1Database();
    db = new Database(mockD1);
  });

  it('deletes image_attachments for a specific message', async () => {
    mockD1._seed('image_attachments', [
      { id: 'ia1', message_id: 'msg1', group_id: 'g1', r2_key: 'groups/g1/a.bin', created_at: '2024-01-01' },
      { id: 'ia2', message_id: 'msg2', group_id: 'g1', r2_key: 'groups/g1/b.bin', created_at: '2024-01-02' },
    ]);

    // Simulate what the delete message handler does: query then delete
    const rows = await db.query<{ r2_key: string }>(
      'SELECT r2_key FROM image_attachments WHERE message_id = ?',
      ['msg1'],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].r2_key).toBe('groups/g1/a.bin');

    await db.execute('DELETE FROM image_attachments WHERE message_id = ?', ['msg1']);

    const remaining = mockD1._getTable('image_attachments');
    expect(remaining).toHaveLength(1);
    expect(remaining[0].message_id).toBe('msg2');
  });

  it('returns empty when message has no image attachments', async () => {
    mockD1._seed('image_attachments', []);

    const rows = await db.query<{ r2_key: string }>(
      'SELECT r2_key FROM image_attachments WHERE message_id = ?',
      ['msg-nonexistent'],
    );

    expect(rows).toHaveLength(0);
  });
});
