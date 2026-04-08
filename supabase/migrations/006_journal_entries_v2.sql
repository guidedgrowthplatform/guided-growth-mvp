-- Drop old flat table (no production data)
DROP TABLE IF EXISTS journal_entries CASCADE;

-- Parent: one row per journal session
CREATE TABLE journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('freeform', 'template')),
  template_id VARCHAR(50),
  title TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_journal_entries_user_date ON journal_entries (user_id, date DESC);

CREATE TABLE journal_entry_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  field_key VARCHAR(50) NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  UNIQUE (entry_id, field_key)
);

ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entry_fields ENABLE ROW LEVEL SECURITY;
