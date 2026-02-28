-- Add leaf_index and commit_json for TreeKEM state recovery (Phase 5)

-- leaf_index: position in ratchet tree, set at invite-accept time.
-- NULL for group owners (always leaf 0) and members who joined before this migration.
ALTER TABLE group_members ADD COLUMN leaf_index INTEGER;

-- commit_json: full serialized MLS Commit from the last tree update.
-- NULL for groups with no server tree state yet (pre-migration epoch 0).
ALTER TABLE group_tree_state ADD COLUMN commit_json TEXT;
