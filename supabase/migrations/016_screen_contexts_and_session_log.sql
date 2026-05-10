-- P1-03: screen_contexts (sheet-seeded) + session_log (runtime event stream).
-- screen_contexts is populated by scripts/voice-sync/seed_contexts.py from the Voice Journey Sheet.
-- session_log starts empty and is appended by POST /api/session_log at runtime (P1-04).
-- RLS on, no policies — service role bypasses, anon/authenticated get zero access.

CREATE TABLE IF NOT EXISTS screen_contexts (
  screen_id     TEXT PRIMARY KEY,
  context_block TEXT        NOT NULL,
  content_hash  TEXT        NOT NULL,
  source_row    JSONB       NOT NULL,
  version       INT         NOT NULL DEFAULT 1,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS screen_contexts_updated_at_idx
  ON screen_contexts (updated_at DESC);

CREATE TABLE IF NOT EXISTS session_log (
  id          BIGSERIAL    PRIMARY KEY,
  user_id     UUID         NOT NULL REFERENCES auth.users(id),
  session_id  TEXT         NOT NULL,
  timestamp   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  event_type  TEXT         NOT NULL,
  screen_id   TEXT,
  payload     JSONB
);

CREATE INDEX IF NOT EXISTS session_log_user_time_idx
  ON session_log (user_id, timestamp DESC);

ALTER TABLE screen_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_log     ENABLE ROW LEVEL SECURITY;
