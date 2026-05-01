-- 014: Single source of truth for voice toggles. Adds typed mic_enabled +
-- recording_mode columns, backfills from preferences_json, formally
-- deprecates ai_output_mode (drop in 015 after one release).

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS mic_enabled BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS recording_mode VARCHAR(20) NOT NULL DEFAULT 'auto-stop';

ALTER TABLE user_preferences DROP CONSTRAINT IF EXISTS chk_recording_mode;
ALTER TABLE user_preferences
  ADD CONSTRAINT chk_recording_mode CHECK (recording_mode IN ('auto-stop','always-on'));

-- Backfill voice_mode from JSONB voiceEnabled
UPDATE user_preferences
SET voice_mode = CASE
  WHEN preferences_json ? 'voiceEnabled' AND (preferences_json->>'voiceEnabled') = 'false' THEN 'screen'
  WHEN preferences_json ? 'voiceEnabled' AND (preferences_json->>'voiceEnabled') = 'true'  THEN 'voice'
  ELSE voice_mode
END
WHERE preferences_json ? 'voiceEnabled';

-- Backfill mic_permission (OS grant) from JSONB micGranted
UPDATE user_preferences
SET mic_permission = (preferences_json->>'micGranted')::boolean
WHERE preferences_json ? 'micGranted';

-- Default mic_enabled to mirror mic_permission for existing users
UPDATE user_preferences
SET mic_enabled = COALESCE((preferences_json->>'micGranted')::boolean, true)
WHERE preferences_json ? 'micGranted';

-- Backfill voice_model from JSONB voiceModel
UPDATE user_preferences
SET voice_model = preferences_json->>'voiceModel'
WHERE preferences_json ? 'voiceModel'
  AND voice_model IS DISTINCT FROM (preferences_json->>'voiceModel');

-- Strip migrated keys from JSONB so the typed columns are sole truth
UPDATE user_preferences
SET preferences_json = preferences_json - 'voiceEnabled' - 'micGranted' - 'voiceModel';

COMMENT ON COLUMN user_preferences.ai_output_mode IS
  'DEPRECATED 2026-05 — use voice_mode. Drop in migration 015 after one release.';
