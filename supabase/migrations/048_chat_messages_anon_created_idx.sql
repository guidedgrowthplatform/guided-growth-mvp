-- Powers linear per-user chat history pagination (GET /api/chat/linear):
-- keyset scan WHERE anon_id = $1 ORDER BY created_at DESC, id DESC.
CREATE INDEX IF NOT EXISTS idx_chat_messages_anon_created
  ON chat_messages (anon_id, created_at, id);
