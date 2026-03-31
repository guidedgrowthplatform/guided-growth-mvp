ALTER TABLE user_habits
  ADD CONSTRAINT unique_user_habit_name UNIQUE (user_id, name);
