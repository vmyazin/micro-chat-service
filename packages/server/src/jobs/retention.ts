import { Database } from '../db/client';
import { ChallengeStore } from '../routes/auth';

export interface RetentionEnv {
  DB: D1Database;
  IMAGES: R2Bucket;
}

export interface RetentionResult {
  deletedCount: number;
  expiredChallengesDeleted: number;
  expiredImagesDeleted: number;
  executedAt: string;
}

const RETENTION_DAYS = 30;

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

  const challengeStore = new ChallengeStore(d1);
  const expiredChallengesDeleted = await challengeStore.deleteExpired();

  // Clean up expired image attachments from R2
  let expiredImagesDeleted = 0;
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
      expiredImagesDeleted = deleteResult.meta?.changes ?? 0;
    }
  }

  const executedAt = new Date().toISOString();

  console.log(
    `[retention] Deleted ${deletedCount} delivery receipts older than ${RETENTION_DAYS} days, ${expiredChallengesDeleted} expired challenges, ${expiredImagesDeleted} expired images`,
  );

  return {
    deletedCount,
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
