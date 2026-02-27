-- TreeKEM epoch tracking and tree state storage

ALTER TABLE groups ADD COLUMN epoch INTEGER NOT NULL DEFAULT 0;

CREATE TABLE group_tree_state (
  group_id TEXT PRIMARY KEY,
  epoch INTEGER NOT NULL DEFAULT 0,
  tree_data TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
