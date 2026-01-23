import { Database } from '../db/client';

export interface RetentionEnv {
  DB: D1Database;
}

export interface RetentionResult {
  deletedCount: number;
  executedAt: string;
}

const RETENTION_DAYS = 30;

export async function runRetentionCleanup(db: Database): Promise<RetentionResult> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
  const cutoffISO = cutoffDate.toISOString();

  const result = await db.execute(
    `DELETE FROM delivery_receipts WHERE delivered_at < ?`,
    [cutoffISO]
  );

  const deletedCount = result.meta?.changes ?? 0;
  const executedAt = new Date().toISOString();

  console.log(`[retention] Deleted ${deletedCount} delivery receipts older than ${RETENTION_DAYS} days`);

  return {
    deletedCount,
    executedAt,
  };
}

export async function handleScheduled(env: RetentionEnv): Promise<void> {
  const db = new Database(env.DB);
  const result = await runRetentionCleanup(db);
  console.log(`[retention] Cleanup complete: ${JSON.stringify(result)}`);
}
