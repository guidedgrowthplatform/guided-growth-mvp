-- ═══════════════════════════════════════════════════════════════════
-- Guided Growth — Core Schema (Migration 003)
-- ───────────────────────────────────────────────────────────────────
-- Creates core tables needed for Supabase data layer
-- Based on schema-erd.md (v4)
-- Safe to re-run: uses IF NOT EXISTS throughout
-- Usage: Run in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────
-- 1. Users (app-level profiles linked to auth.users)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR UNIQUE,
  auth_provider VARCHAR DEFAULT 'email',
  nickname VARCHAR,
  age_group VARCHAR,
  gender VARCHAR,
  language VARCHAR DEFAULT 'en',
  timezone VARCHAR DEFAULT 'UTC',
  morning_wakeup_time TIME,
  night_winddown_time TIME,
  onboarding_path VARCHAR,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, nickname, auth_provider)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'email'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if any, then create
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─────────────────────────────────────────
-- 2. User Habits
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  starter_habit_id UUID,
  name VARCHAR NOT NULL,
  habit_type VARCHAR DEFAULT 'binary_do',
  cadence VARCHAR DEFAULT 'daily',
  daily_goal INT DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  is_journaling BOOLEAN DEFAULT FALSE,
  sort_order INT DEFAULT 0,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_habits_user_id ON public.user_habits(user_id);

-- ─────────────────────────────────────────
-- 3. Habit Completions
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.habit_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_habit_id UUID NOT NULL REFERENCES public.user_habits(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  completed BOOLEAN DEFAULT TRUE,
  completed_via VARCHAR DEFAULT 'ui',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_habit_id, date)
);

CREATE INDEX IF NOT EXISTS idx_habit_completions_habit_date ON public.habit_completions(user_habit_id, date);

-- ─────────────────────────────────────────
-- 4. Habit Streaks
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.habit_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_habit_id UUID UNIQUE NOT NULL REFERENCES public.user_habits(id) ON DELETE CASCADE,
  current_streak INT DEFAULT 0,
  longest_streak INT DEFAULT 0,
  total_completions INT DEFAULT 0,
  total_scheduled INT DEFAULT 0,
  completion_rate REAL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────
-- 5. Daily Check-ins
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.daily_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  mood VARCHAR,
  energy_level INT,
  stress_level VARCHAR,
  sleep_quality INT,
  sleep_hours NUMERIC(3,1),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date)
);

-- ─────────────────────────────────────────
-- 6. Journal Entries
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user_habit_id UUID REFERENCES public.user_habits(id) ON DELETE SET NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  prompt TEXT,
  response TEXT NOT NULL,
  input_mode VARCHAR DEFAULT 'text',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_journal_entries_user_date ON public.journal_entries(user_id, date);

-- ─────────────────────────────────────────
-- 7. Row Level Security
-- ─────────────────────────────────────────

-- Users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
CREATE POLICY "Users can view own profile" ON public.users FOR ALL USING (auth.uid() = id);

-- User Habits
ALTER TABLE public.user_habits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own habits" ON public.user_habits;
CREATE POLICY "Users can manage own habits" ON public.user_habits FOR ALL USING (auth.uid() = user_id);

-- Habit Completions (via user_habits FK)
ALTER TABLE public.habit_completions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own completions" ON public.habit_completions;
CREATE POLICY "Users can manage own completions" ON public.habit_completions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_habits
      WHERE user_habits.id = habit_completions.user_habit_id
      AND user_habits.user_id = auth.uid()
    )
  );

-- Habit Streaks (via user_habits FK)
ALTER TABLE public.habit_streaks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own streaks" ON public.habit_streaks;
CREATE POLICY "Users can view own streaks" ON public.habit_streaks FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_habits
      WHERE user_habits.id = habit_streaks.user_habit_id
      AND user_habits.user_id = auth.uid()
    )
  );

-- Daily Check-ins
ALTER TABLE public.daily_checkins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own checkins" ON public.daily_checkins;
CREATE POLICY "Users can manage own checkins" ON public.daily_checkins FOR ALL USING (auth.uid() = user_id);

-- Journal Entries
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own journal" ON public.journal_entries;
CREATE POLICY "Users can manage own journal" ON public.journal_entries FOR ALL USING (auth.uid() = user_id);
