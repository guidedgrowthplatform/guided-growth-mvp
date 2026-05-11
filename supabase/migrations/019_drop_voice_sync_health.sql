-- Drop voice_sync_health: telemetry table from 018 that ended up unused after
-- the change-driven dispatch path was abandoned. Empty in prod; no reads or
-- writes anywhere in the codebase. Safe to drop.

DROP TABLE IF EXISTS voice_sync_health;
