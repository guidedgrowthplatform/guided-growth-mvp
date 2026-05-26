BEGIN;

CREATE TABLE chat_messages (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anon_id             UUID NOT NULL,
  chat_session_id     UUID NOT NULL,
  screen_id           TEXT NOT NULL,
  turn_index          INT  NOT NULL,
  role                TEXT NOT NULL CHECK (role IN ('user','assistant','tool')),
  content             TEXT CHECK (content IS NULL OR length(content) <= 8000),
  tool_calls          JSONB,
  tool_call_id        TEXT,
  tool_name           TEXT,
  openai_response_id  TEXT,
  mode                TEXT NOT NULL DEFAULT 'chat' CHECK (mode IN ('chat','opener')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chat_messages_anon_fk
    FOREIGN KEY (anon_id) REFERENCES profiles(anon_id) ON DELETE CASCADE,
  CONSTRAINT chat_messages_session_turn_key UNIQUE (chat_session_id, turn_index)
);

CREATE INDEX idx_chat_messages_session
  ON chat_messages (anon_id, chat_session_id, turn_index);

CREATE INDEX idx_chat_messages_response
  ON chat_messages (chat_session_id, openai_response_id);

CREATE INDEX idx_chat_messages_prune
  ON chat_messages (created_at);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

COMMIT;
