ALTER TABLE chat_messages ADD COLUMN user_turn_id UUID;
CREATE UNIQUE INDEX idx_chat_messages_tool_dedup
  ON chat_messages (user_turn_id, tool_call_id)
  WHERE role = 'tool';
