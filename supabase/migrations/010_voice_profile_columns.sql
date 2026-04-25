-- Add voice mode and coaching style columns to profiles table
-- voice_mode: controls how the AI coach communicates (voice, text, or hybrid)
-- coaching_style: controls the AI coach's personality (warm, direct, reflective)
-- For MVP: voice_mode defaults to 'full_voice', coaching_style defaults to 'warm'
-- Coaching style switching is OFF for MVP (Yair decision, April 2026)

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS voice_mode VARCHAR(20) NOT NULL DEFAULT 'full_voice',
ADD COLUMN IF NOT EXISTS coaching_style VARCHAR(20) NOT NULL DEFAULT 'warm';

ALTER TABLE profiles
ADD CONSTRAINT chk_voice_mode CHECK (voice_mode IN ('full_voice', 'text_only', 'speak_in_text_out'));

ALTER TABLE profiles
ADD CONSTRAINT chk_coaching_style CHECK (coaching_style IN ('warm', 'direct', 'reflective'));
