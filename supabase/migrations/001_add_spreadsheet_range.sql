-- Add spreadsheet_range column to user_preferences
ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS spreadsheet_range VARCHAR(10) DEFAULT 'month';
