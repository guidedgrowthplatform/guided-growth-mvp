-- Down for 034. Restores ai_output_mode with the 011-era definition.
-- Backfills from voice_mode so existing rows are coherent.

BEGIN;

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS ai_output_mode VARCHAR(20) NOT NULL DEFAULT 'voice';

ALTER TABLE user_preferences
  ADD CONSTRAINT chk_ai_output_mode
  CHECK (ai_output_mode IN ('voice', 'screen', 'always_ask'));

UPDATE user_preferences
SET ai_output_mode = voice_mode
WHERE voice_mode IN ('voice', 'screen');

COMMIT;
