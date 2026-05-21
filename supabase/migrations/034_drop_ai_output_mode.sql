-- 034: Drop deprecated ai_output_mode column.
-- Promised by migration 014's comment ("Drop in migration 015 after one
-- release"). Column is unread + unwritten by the app; voice_mode is the
-- single source of truth.

BEGIN;

ALTER TABLE user_preferences DROP CONSTRAINT IF EXISTS chk_ai_output_mode;
ALTER TABLE user_preferences DROP COLUMN IF EXISTS ai_output_mode;

COMMIT;
