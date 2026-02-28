-- Store per-member identity keys and pending TreeKEM Welcome messages

ALTER TABLE group_members ADD COLUMN identity_key TEXT;

CREATE TABLE pending_welcomes (
  group_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  welcome_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (group_id, user_id)
);
