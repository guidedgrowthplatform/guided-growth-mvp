BEGIN;

CREATE TABLE IF NOT EXISTS user_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anon_id     UUID NOT NULL,
  content     TEXT NOT NULL CHECK (length(content) <= 8000),
  category    TEXT,        -- Axis A: fitness|nutrition|health|social|mission|work|purchase|wishlist|media|place|reflection|intention|misc
  kind        TEXT,        -- Axis B: did|want|plan|felt
  structured  JSONB,       -- optional extracted fields, e.g. {"qty":10,"item":"bananas"}
  source      TEXT,        -- screen id, or 'voice' / 'text'
  logged_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_logs_anon_fk
    FOREIGN KEY (anon_id) REFERENCES profiles(anon_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_logs_anon ON user_logs (anon_id, logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_logs_category ON user_logs (anon_id, category);

ALTER TABLE user_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_isolation" ON public.user_logs;
CREATE POLICY "anon_isolation" ON public.user_logs
  FOR ALL
  TO authenticated
  USING      (anon_id = (auth.jwt() ->> 'anon_id')::uuid)
  WITH CHECK (anon_id = (auth.jwt() ->> 'anon_id')::uuid);

DROP POLICY IF EXISTS "service_role_only" ON public.user_logs;
CREATE POLICY "service_role_only" ON public.user_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMIT;
