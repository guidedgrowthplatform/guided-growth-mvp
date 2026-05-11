-- voice_sync_health: per-run telemetry table.
-- Currently UNUSED — scripts/voice-sync/seed_contexts.py does not write to it.
-- Kept in source because the migration is already recorded as applied in
-- production's migration history; deleting this file would cause
-- `supabase db push` to detect drift. If the table should be removed, add a
-- migration 019 that drops it.
-- RLS on, no policies — service role bypasses, anon/authenticated get zero access.

CREATE TABLE IF NOT EXISTS voice_sync_health (
  id              BIGSERIAL    PRIMARY KEY,
  ran_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  trigger_source  TEXT         NOT NULL,
  inserts         INT          NOT NULL DEFAULT 0,
  updates         INT          NOT NULL DEFAULT 0,
  noops           INT          NOT NULL DEFAULT 0,
  skipped         INT          NOT NULL DEFAULT 0,
  pruned          INT          NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS voice_sync_health_ran_at_idx
  ON voice_sync_health (ran_at DESC);

ALTER TABLE voice_sync_health ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON voice_sync_health TO service_role;
