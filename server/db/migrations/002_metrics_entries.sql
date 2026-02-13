-- Metrics table
CREATE TABLE IF NOT EXISTS metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  input_type VARCHAR(20) NOT NULL CHECK (input_type IN ('binary', 'numeric', 'short_text', 'text')),
  question TEXT DEFAULT '',
  active BOOLEAN DEFAULT true,
  frequency VARCHAR(20) DEFAULT 'daily' CHECK (frequency IN ('daily', 'weekdays', 'weekends', 'weekly')),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_metrics_user_id ON metrics(user_id);
CREATE INDEX idx_metrics_user_active ON metrics(user_id, active);

CREATE TRIGGER update_metrics_updated_at BEFORE UPDATE ON metrics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Entries table (individual rows per metric per day)
CREATE TABLE IF NOT EXISTS entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  metric_id UUID NOT NULL REFERENCES metrics(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  value TEXT NOT NULL DEFAULT ''
);

CREATE UNIQUE INDEX idx_entries_upsert ON entries(user_id, metric_id, date);
CREATE INDEX idx_entries_user_date ON entries(user_id, date);

-- Reflection configs (one per user)
CREATE TABLE IF NOT EXISTS reflection_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fields JSONB NOT NULL DEFAULT '[]',
  show_affirmation BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER update_reflection_configs_updated_at BEFORE UPDATE ON reflection_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Reflections (one row per user per day per field)
CREATE TABLE IF NOT EXISTS reflections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  field_id VARCHAR(50) NOT NULL,
  value TEXT NOT NULL DEFAULT ''
);

CREATE UNIQUE INDEX idx_reflections_upsert ON reflections(user_id, date, field_id);
CREATE INDEX idx_reflections_user_date ON reflections(user_id, date);

-- Affirmations (one per user, persists)
CREATE TABLE IF NOT EXISTS affirmations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER update_affirmations_updated_at BEFORE UPDATE ON affirmations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- User preferences (one per user)
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  default_view VARCHAR(20) DEFAULT 'spreadsheet' CHECK (default_view IN ('spreadsheet', 'form')),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
