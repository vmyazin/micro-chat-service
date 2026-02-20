-- Image attachments index for R2 object cleanup
-- Server stores encrypted image blobs in R2; this table tracks the mapping
-- so the retention cron can purge R2 objects without decrypting message payloads.

CREATE TABLE image_attachments (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  r2_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_image_attachments_message_id ON image_attachments(message_id);
CREATE INDEX idx_image_attachments_created_at ON image_attachments(created_at);
