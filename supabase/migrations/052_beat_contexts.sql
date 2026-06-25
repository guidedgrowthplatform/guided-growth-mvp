-- Beat-context tables for the onboarding Direct-LLM engine.
-- Content (context + opener) is authored in Supabase (via the Beat Contexts tab
-- of the App Master Sheet or direct DB edits) and synced one-way INTO the repo
-- by scripts/voice-sync/sync_beat_contexts.py, producing
-- api/_lib/llm/onboarding/beatContexts.generated.json.
--
-- `allowedTools` is NOT stored here — it is code-owned in beatContexts.ts.
-- Seeded once from hand-authored beatContexts.ts via seed_beat_contexts.py.
-- RLS on, no policies — service role bypasses, anon/authenticated get zero access.
-- (mirrors the screen_contexts pattern from migration 016)

BEGIN;

-- Per-beat content (context copy + optional opener).
CREATE TABLE IF NOT EXISTS beat_contexts (
  screen_id    TEXT        PRIMARY KEY,
  context      TEXT        NOT NULL,
  opener       TEXT,
  version      INT         NOT NULL DEFAULT 1,
  content_hash TEXT,                           -- FNV-1a over context + "\n" + opener
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS beat_contexts_updated_at_idx
  ON beat_contexts (updated_at DESC);

-- Auto-bump updated_at on every row change.
CREATE OR REPLACE FUNCTION _beat_contexts_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS beat_contexts_updated_at ON beat_contexts;
CREATE TRIGGER beat_contexts_updated_at
  BEFORE UPDATE ON beat_contexts
  FOR EACH ROW EXECUTE FUNCTION _beat_contexts_set_updated_at();

ALTER TABLE beat_contexts ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON beat_contexts TO service_role;

-- Global onboarding context + bundle version (single row, id = 'default').
CREATE TABLE IF NOT EXISTS onboarding_globals (
  id              TEXT        PRIMARY KEY DEFAULT 'default',
  global_context  TEXT        NOT NULL,
  bundle_version  INT         NOT NULL DEFAULT 1,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION _onboarding_globals_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS onboarding_globals_updated_at ON onboarding_globals;
CREATE TRIGGER onboarding_globals_updated_at
  BEFORE UPDATE ON onboarding_globals
  FOR EACH ROW EXECUTE FUNCTION _onboarding_globals_set_updated_at();

ALTER TABLE onboarding_globals ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON onboarding_globals TO service_role;

COMMIT;
