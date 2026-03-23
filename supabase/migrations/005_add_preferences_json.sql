ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS preferences_json JSONB DEFAULT '{}'::jsonb;
