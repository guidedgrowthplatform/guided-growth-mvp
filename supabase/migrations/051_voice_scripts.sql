-- voice_scripts (sheet-seeded): one row per check-in / notification variation.
-- Populated by scripts/voice-sync/seed_voice_scripts.py from the "Voice Scripts"
-- tab of the App Master Sheet. Each row is one variation (stage + n); all
-- language/gender columns (title_*/text_*) live together in `lines` JSONB, so a
-- new language is a sheet column, not a migration.
-- RLS on, no policies — service role bypasses, anon/authenticated get zero access
-- (same posture as screen_contexts; the app reads it server-side).

CREATE TABLE IF NOT EXISTS voice_scripts (
  stage         TEXT        NOT NULL,
  n             INT         NOT NULL,
  surface       TEXT,
  spoken        BOOLEAN     NOT NULL DEFAULT FALSE,
  status        TEXT        NOT NULL DEFAULT 'Draft',
  notes         TEXT,
  lines         JSONB       NOT NULL,
  content_hash  TEXT        NOT NULL,
  version       INT         NOT NULL DEFAULT 1,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (stage, n)
);

CREATE INDEX IF NOT EXISTS voice_scripts_stage_idx
  ON voice_scripts (stage);
CREATE INDEX IF NOT EXISTS voice_scripts_updated_at_idx
  ON voice_scripts (updated_at DESC);

ALTER TABLE voice_scripts ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON voice_scripts TO service_role;
