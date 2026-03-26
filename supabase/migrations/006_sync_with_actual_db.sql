-- Sync migration files with actual DB state
-- These changes were applied directly to production DB during development

-- 1. Rename metric_entries to user_metric_entries (if not already done)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'metric_entries' AND table_schema = 'public') THEN
    ALTER TABLE metric_entries RENAME TO user_metric_entries;
  END IF;
END $$;

-- 2. Add missing columns to onboarding_states
ALTER TABLE onboarding_states ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';
ALTER TABLE onboarding_states ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
ALTER TABLE onboarding_states ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- 3. Add missing columns to user_habits
ALTER TABLE user_habits ADD COLUMN IF NOT EXISTS frequency VARCHAR(50) DEFAULT 'daily';

-- 4. Add missing column to user_preferences
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS preferences_json JSONB DEFAULT '{}';

-- 5. Add missing columns to focus_sessions
ALTER TABLE focus_sessions ADD COLUMN IF NOT EXISTS user_habit_id UUID;
ALTER TABLE focus_sessions ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;
ALTER TABLE focus_sessions ADD COLUMN IF NOT EXISTS actual_minutes INTEGER;
ALTER TABLE focus_sessions ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ DEFAULT NOW();

-- 6. Change user_id columns from UUID to TEXT for Better Auth compatibility
ALTER TABLE user_habits ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
ALTER TABLE daily_checkins ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
ALTER TABLE journal_entries ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
ALTER TABLE focus_sessions ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
ALTER TABLE metrics ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
ALTER TABLE user_preferences ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
ALTER TABLE onboarding_states ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;

-- 7. Make onboarding_states.path nullable (was NOT NULL but we set it programmatically)
ALTER TABLE onboarding_states ALTER COLUMN path DROP NOT NULL;

-- 8. Add unique constraint for habit deduplication
ALTER TABLE user_habits ADD CONSTRAINT IF NOT EXISTS unique_user_habit_name UNIQUE (user_id, name);
