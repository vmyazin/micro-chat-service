"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runRetentionCleanup = runRetentionCleanup;
exports.handleScheduled = handleScheduled;
const client_1 = require("../db/client");
const RETENTION_DAYS = 30;
async function runRetentionCleanup(db) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
    const cutoffISO = cutoffDate.toISOString();
    const result = await db.execute(`DELETE FROM delivery_receipts WHERE delivered_at < ?`, [cutoffISO]);
    const deletedCount = result.meta?.changes ?? 0;
    const executedAt = new Date().toISOString();
    console.log(`[retention] Deleted ${deletedCount} delivery receipts older than ${RETENTION_DAYS} days`);
    return {
        deletedCount,
        executedAt,
    };
}
async function handleScheduled(env) {
    const db = new client_1.Database(env.DB);
    const result = await runRetentionCleanup(db);
    console.log(`[retention] Cleanup complete: ${JSON.stringify(result)}`);
}
//# sourceMappingURL=retention.js.map