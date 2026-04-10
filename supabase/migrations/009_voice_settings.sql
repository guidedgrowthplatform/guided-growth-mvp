-- Migration: Add Cartesia voice settings to user_profiles

ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS voice_mode text DEFAULT 'full_voice' CHECK (voice_mode IN ('full_voice', 'text_only', 'speak_in_text_out')),
ADD COLUMN IF NOT EXISTS coaching_style text DEFAULT 'warm' CHECK (coaching_style IN ('warm', 'direct', 'reflective'));

-- Set default for existing rows if needed
UPDATE public.user_profiles 
SET 
  voice_mode = 'full_voice' WHERE voice_mode IS NULL;

UPDATE public.user_profiles
SET
  coaching_style = 'warm' WHERE coaching_style IS NULL;
