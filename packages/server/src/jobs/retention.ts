import { ChallengeStore } from '../auth/challenge-store';
import { Database } from '../db/client';

export interface RetentionEnv {
  DB: D1Database;
  IMAGES: R2Bucket;
}

export interface RetentionResult {
  deletedCount: number;
  expiredMessagesDeleted: number;
  expiredChallengesDeleted: number;
  expiredImagesDeleted: number;
  executedAt: string;
}

const RETENTION_DAYS = 30; // standard for metadata
const MESSAGE_TTL_DAYS = 1; // maximum TTL for undelivered messages (Ephemeral)

export async function runRetentionCleanup(
  db: Database,
  d1: D1Database,
  images?: R2Bucket,
): Promise<RetentionResult> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
  const cutoffISO = cutoffDate.toISOString();

  const result = await db.execute(
    `DELETE FROM delivery_receipts WHERE delivered_at < ?`,
    [cutoffISO],
  );

  const deletedCount = result.meta?.changes ?? 0;

  // Maximum TTL: delete any messages older than 24 hours (ephemeral storage policy)
  const messageCutoffDate = new Date();
  messageCutoffDate.setDate(messageCutoffDate.getDate() - MESSAGE_TTL_DAYS);
  const messageCutoffISO = messageCutoffDate.toISOString();

  // First, get all orphaned images linked to these expiring messages to delete from R2
  let expiredImagesDeleted = 0;
  let expiredMessagesDeleted = 0;

  if (images) {
    const orphanedImages = await db.query<{ r2_key: string }>(
      'SELECT r2_key FROM image_attachments WHERE message_id IN (SELECT id FROM messages WHERE created_at < ?)',
      [messageCutoffISO],
    );

    for (const { r2_key } of orphanedImages) {
      await images.delete(r2_key);
    }
    expiredImagesDeleted += orphanedImages.length;
  }

  // Delete the old messages (cascade or triggers should handle DB associations)
  const deleteMessagesResult = await db.execute(
    'DELETE FROM messages WHERE created_at < ?',
    [messageCutoffISO],
  );
  expiredMessagesDeleted = deleteMessagesResult.meta?.changes ?? 0;

  const challengeStore = new ChallengeStore(d1);
  const expiredChallengesDeleted = await challengeStore.deleteExpired();

  // Clean up expired image attachments from R2 (those without a message, or very old)
  if (images) {
    const oldImages = await db.query<{ r2_key: string }>(
      'SELECT r2_key FROM image_attachments WHERE created_at < ?',
      [cutoffISO],
    );

    for (const { r2_key } of oldImages) {
      await images.delete(r2_key);
    }

    if (oldImages.length > 0) {
      const deleteResult = await db.execute(
        'DELETE FROM image_attachments WHERE created_at < ?',
        [cutoffISO],
      );
      expiredImagesDeleted += deleteResult.meta?.changes ?? 0;
    }
  }

  const executedAt = new Date().toISOString();

  console.log(
    `[retention] Deleted ${deletedCount} delivery receipts older than ${RETENTION_DAYS} days, ${expiredMessagesDeleted} messages older than ${MESSAGE_TTL_DAYS} days, ${expiredChallengesDeleted} expired challenges, ${expiredImagesDeleted} expired images`,
  );

  return {
    deletedCount,
    expiredMessagesDeleted,
    expiredChallengesDeleted,
    expiredImagesDeleted,
    executedAt,
  };
}

export async function handleScheduled(env: RetentionEnv): Promise<void> {
  const db = new Database(env.DB);
  const result = await runRetentionCleanup(db, env.DB, env.IMAGES);
  console.log(`[retention] Cleanup complete: ${JSON.stringify(result)}`);
}
