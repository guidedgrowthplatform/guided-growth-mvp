-- voice_sync_health: per-run telemetry from scripts/voice-sync/seed_contexts.py.
-- One row per successful (non-dry-run) execution. Gaps > 24 h mean the workflow
-- itself isn't running; gaps in repository_dispatch-source rows mean the Apps
-- Script trigger is broken.
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
