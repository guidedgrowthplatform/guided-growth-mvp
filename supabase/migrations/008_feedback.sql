CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sentiment VARCHAR(20) NOT NULL CHECK (sentiment IN ('love', 'ok', 'needs-work')),
  text TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_feedback_user ON feedback (user_id, created_at DESC);
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
