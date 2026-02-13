-- Add target_value and target_unit columns to metrics
ALTER TABLE metrics
ADD COLUMN IF NOT EXISTS target_value NUMERIC NULL,
ADD COLUMN IF NOT EXISTS target_unit VARCHAR(20) NULL;
