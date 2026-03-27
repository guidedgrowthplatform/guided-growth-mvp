-- Add user_habit_id to focus_sessions so sessions can be linked to a habit
ALTER TABLE focus_sessions
  ADD COLUMN IF NOT EXISTS user_habit_id UUID REFERENCES user_habits(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_focus_sessions_habit ON focus_sessions(user_habit_id);
