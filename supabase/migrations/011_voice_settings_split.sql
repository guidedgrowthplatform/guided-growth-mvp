-- P1-02: Consolidate voice settings on user_preferences (per Mint Apr 18 review)
--
-- Per the Voice Journey spreadsheet "Voice Settings" section, ai_output_mode
-- and mic_permission are two independent settings. Per Mint's review on MR !67,
-- voice preferences belong on the existing user_preferences table (which
-- already carries voice_mode, coaching_style, etc.) rather than profiles.
--
-- Single source of truth for voice settings = user_preferences. Four valid
-- combinations from the spec:
--   voice + mic on  = full experience (AI speaks, user speaks)
--   voice + mic off = AI speaks, user types/taps
--   screen + mic on = user speaks, AI writes text
--   screen + mic off = fully manual
--
-- Also normalises voice_mode values from the legacy set (full_voice /
-- text_only / speak_in_text_out) to the canonical set (voice / screen /
-- always_ask). Frontend already migrates legacy values at runtime via
-- normalizePreference, so this is safe for existing rows.

-- ─── Add ai_output_mode to user_preferences ────────────────────────────────
-- Set at PREF-01. Drives whether the AI speaks (voice) or writes text (screen).

ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS ai_output_mode VARCHAR(20) NOT NULL DEFAULT 'voice';

ALTER TABLE user_preferences DROP CONSTRAINT IF EXISTS chk_ai_output_mode;

ALTER TABLE user_preferences
ADD CONSTRAINT chk_ai_output_mode CHECK (ai_output_mode IN ('voice', 'screen', 'always_ask'));

-- ─── Add mic_permission to user_preferences ────────────────────────────────
-- Set at MIC-01. True when user granted getUserMedia; false on deny.

ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS mic_permission BOOLEAN NOT NULL DEFAULT false;

-- ─── Normalise voice_mode on user_preferences ──────────────────────────────
-- voice_mode already lives on user_preferences (migration 009). Drop the old
-- CHECK, migrate data, add the new CHECK, update default.

ALTER TABLE user_preferences DROP CONSTRAINT IF EXISTS chk_voice_mode;

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

ALTER TABLE user_preferences
ADD CONSTRAINT chk_voice_mode CHECK (voice_mode IN ('voice', 'screen', 'always_ask'));

-- ─── Clean up duplicated columns on profiles ────────────────────────────────
-- Migration 009_voice_profile_columns.sql previously added voice_mode +
-- coaching_style to profiles. These duplicate user_preferences and drifted
-- from the canonical source. Drop the duplicates; frontend reads from
-- user_preferences only going forward.

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS chk_voice_mode;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS chk_coaching_style;
ALTER TABLE profiles DROP COLUMN IF EXISTS voice_mode;
ALTER TABLE profiles DROP COLUMN IF EXISTS coaching_style;
