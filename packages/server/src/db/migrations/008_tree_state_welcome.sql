-- Store commit and welcome data in tree state so joiners can fetch it
-- after missing the WebSocket broadcast

ALTER TABLE group_tree_state ADD COLUMN commit_data TEXT;
ALTER TABLE group_tree_state ADD COLUMN welcome_data TEXT;
