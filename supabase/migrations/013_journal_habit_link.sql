ALTER TABLE journal_entries
  ADD COLUMN IF NOT EXISTS habit_id UUID
  REFERENCES user_habits(id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_journal_entries_habit_id
  ON journal_entries(habit_id)
  WHERE habit_id IS NOT NULL;
