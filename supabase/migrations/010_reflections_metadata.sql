-- Reflections metadata: mood + AI insight
-- All columns nullable + idempotent so re-runs are safe.

ALTER TABLE journal_entries
  ADD COLUMN IF NOT EXISTS mood VARCHAR(32),
  ADD COLUMN IF NOT EXISTS ai_insight TEXT,
  ADD COLUMN IF NOT EXISTS ai_insight_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ai_insight_content_hash VARCHAR(64);

-- Pagination index: "latest entries by creation time" for the Reflections list.
-- Distinct from idx_journal_entries_user_date (which is (user_id, date DESC))
-- because users may edit an older entry today; we want feed order by creation.
CREATE INDEX IF NOT EXISTS idx_journal_entries_user_created
  ON journal_entries (user_id, created_at DESC);
