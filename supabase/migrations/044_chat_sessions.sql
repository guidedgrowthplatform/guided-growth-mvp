-- Session anchor: dedups concurrent cold opens so the opener can't fire twice.
CREATE TABLE IF NOT EXISTS chat_sessions (
  anon_id          text        NOT NULL,
  screen_id        text        NOT NULL,
  chat_session_id  uuid        NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  last_activity    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (anon_id, screen_id)
);

ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
