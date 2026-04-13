-- Add voice_mode column to user_preferences (per Voice Architecture Doc Section 1.3 + 4.3)
-- voice_mode: 'full_voice' (default), 'text_only', or 'voice_response_only'
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS voice_mode VARCHAR(20) NOT NULL DEFAULT 'full_voice';

-- Update coaching_style default from 'friendly' to 'warm' (per Voice Journey Spreadsheet v3)
ALTER TABLE user_preferences
  ALTER COLUMN coaching_style SET DEFAULT 'warm';
