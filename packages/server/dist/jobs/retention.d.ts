import { Database } from '../db/client';
export interface RetentionEnv {
    DB: D1Database;
}
export interface RetentionResult {
    deletedCount: number;
    executedAt: string;
}
export declare function runRetentionCleanup(db: Database): Promise<RetentionResult>;
export declare function handleScheduled(env: RetentionEnv): Promise<void>;
//# sourceMappingURL=retention.d.ts.map