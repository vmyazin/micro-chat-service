-- Delivery receipts migration
-- Track message delivery status

CREATE TABLE IF NOT EXISTS delivery_receipts (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delivered_at TEXT NOT NULL DEFAULT (datetime('now')),
  read_at TEXT,
  UNIQUE(message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_delivery_receipts_message_id ON delivery_receipts(message_id);
CREATE INDEX IF NOT EXISTS idx_delivery_receipts_user_id ON delivery_receipts(user_id);
CREATE INDEX IF NOT EXISTS idx_delivery_receipts_delivered_at ON delivery_receipts(delivered_at);
