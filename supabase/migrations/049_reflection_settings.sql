-- Reflection mode + editable prompts (PR1: data layer, ships dormant).
-- Runtime source of truth for a user's evening-reflection settings. Onboarding
-- materializes a row on complete; runtime reads/edits it. Replaces the dropped
-- legacy reflection_configs (042) — this table also holds mode + prompts.
--
-- Mode model: 'prompts' (editable list, defaults pre-filled) | 'freeform'.
-- Schedule columns mirror user_habits naming (reminder_time/schedule_days/
-- reminder_enabled) to avoid reserved-word ambiguity on time/days.

BEGIN;

CREATE TABLE IF NOT EXISTS reflection_settings (
  anon_id          UUID PRIMARY KEY REFERENCES profiles(anon_id) ON DELETE CASCADE,
  mode             VARCHAR(20) NOT NULL DEFAULT 'prompts'
                   CHECK (mode IN ('prompts', 'freeform')),
  prompts          JSONB NOT NULL DEFAULT '[]'::jsonb,   -- string[]; empty for freeform
  reminder_time    VARCHAR(5),                            -- 'HH:MM'
  schedule_days    JSONB NOT NULL DEFAULT '[]'::jsonb,    -- number[] (0..6)
  reminder_enabled BOOLEAN NOT NULL DEFAULT true,
  schedule_label   VARCHAR(20),                           -- 'Weekday' | 'Weekend' | 'Every day'
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE reflection_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_isolation" ON reflection_settings;
CREATE POLICY "user_isolation" ON reflection_settings
  FOR ALL USING (anon_id = current_anon_id()) WITH CHECK (anon_id = current_anon_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reflection_settings TO authenticated;

-- Per-entry prompt snapshot: editable prompts mean a historical entry must keep
-- the questions it was written against, else the detail view mis-renders. NULL
-- for freeform entries.
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS prompts_snapshot JSONB;

-- Backfill existing template entries with the prompts they were displayed with
-- (the hardcoded GuidedTab/ReflectionDetailPage set: grateful/proud/forgive,
-- matching field_key order 0/1/2). Keeps their rendering identical post-PR2.
UPDATE journal_entries
SET prompts_snapshot = jsonb_build_array(
  'What are the things you are grateful for today?',
  'What are the things you are proud of today?',
  'What are the things you forgive yourself for today?'
)
WHERE type = 'template' AND prompts_snapshot IS NULL;

COMMIT;
