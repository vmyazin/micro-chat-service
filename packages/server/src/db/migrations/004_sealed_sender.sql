-- Sealed Sender migration
-- Adds anonymous token-based sender identity hiding

-- Table for storing hashed sender tokens
-- The server stores only SHA-256 hashes, not the original tokens
CREATE TABLE IF NOT EXISTS sender_tokens (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0 CHECK(used IN (0, 1)),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  used_at TEXT
);

-- Indexes for efficient token validation
CREATE INDEX IF NOT EXISTS idx_sender_tokens_group_id ON sender_tokens(group_id);
CREATE INDEX IF NOT EXISTS idx_sender_tokens_hash ON sender_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_sender_tokens_expires_at ON sender_tokens(expires_at);

-- Make messages.sender_id nullable for Sealed Sender
-- (existing messages keep their sender_id, new sealed messages use NULL)
-- Note: SQLite doesn't support ALTER COLUMN, so we need to recreate the table

-- First, create the new messages table structure
CREATE TABLE messages_new (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  sender_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  encrypted_payload TEXT NOT NULL,
  nonce TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT,
  deleted_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  sealed_sender TEXT
);

-- Copy data from old table
INSERT INTO messages_new SELECT id, group_id, sender_id, encrypted_payload, nonce, created_at, deleted_at, deleted_by, NULL FROM messages;

-- Drop old table and rename
DROP TABLE messages;
ALTER TABLE messages_new RENAME TO messages;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_messages_group_id ON messages(group_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
