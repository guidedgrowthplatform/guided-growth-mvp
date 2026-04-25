-- Completes 011_voice_settings_split.sql, which was applied partially in
-- production: the ADD COLUMN statements at the top ran (ai_output_mode,
-- mic_permission), but the legacy-value normalisation, the new CHECK
-- constraint, and the cleanup of duplicate columns on profiles never
-- executed. This migration is idempotent — running it again on an already-
-- consistent DB is a no-op.
--
-- Frontend already migrates legacy voice_mode values at runtime via
-- normalizePreference, so writing the canonical value back is invisible to
-- users. See migration 011 for the broader rationale (Voice Journey
-- spreadsheet, Mint review on MR !67).

-- ─── Normalise legacy voice_mode values on user_preferences ────────────────

UPDATE user_preferences
SET voice_mode = CASE voice_mode
  WHEN 'full_voice' THEN 'voice'
  WHEN 'text_only' THEN 'screen'
  WHEN 'speak_in_text_out' THEN 'screen'
  ELSE voice_mode
END
WHERE voice_mode IN ('full_voice', 'text_only', 'speak_in_text_out');

ALTER TABLE user_preferences
ALTER COLUMN voice_mode SET DEFAULT 'voice';

ALTER TABLE user_preferences DROP CONSTRAINT IF EXISTS chk_voice_mode;
ALTER TABLE user_preferences
ADD CONSTRAINT chk_voice_mode CHECK (voice_mode IN ('voice', 'screen', 'always_ask'));

-- ─── Drop duplicate columns from profiles (single source = user_preferences) ─

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS chk_voice_mode;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS chk_coaching_style;
ALTER TABLE profiles DROP COLUMN IF EXISTS voice_mode;
ALTER TABLE profiles DROP COLUMN IF EXISTS coaching_style;
