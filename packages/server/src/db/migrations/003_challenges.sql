-- Challenge store migration
-- Move WebAuthn challenges from in-memory to D1 for multi-isolate support

CREATE TABLE IF NOT EXISTS challenges (
  challenge TEXT PRIMARY KEY,
  user_id TEXT,
  display_name TEXT,
  type TEXT NOT NULL CHECK(type IN ('registration', 'authentication')),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_challenges_expires_at ON challenges(expires_at);
