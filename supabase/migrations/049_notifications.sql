-- Push notifications foundation: FCM device tokens + sent/feed notifications.
-- API-only access (service role); RLS enabled with no policies = fail closed
-- for direct client reads.

BEGIN;

CREATE TABLE device_tokens (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anon_id      UUID NOT NULL,
  token        TEXT NOT NULL UNIQUE,
  platform     TEXT NOT NULL CHECK (platform IN ('ios','android')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT device_tokens_anon_fk
    FOREIGN KEY (anon_id) REFERENCES profiles(anon_id) ON DELETE CASCADE
);

CREATE INDEX idx_device_tokens_anon ON device_tokens (anon_id);

CREATE TABLE notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anon_id    UUID NOT NULL,
  type       TEXT NOT NULL,
  category   TEXT NOT NULL DEFAULT 'habit' CHECK (category IN ('habit','journal')),
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  data       JSONB,
  -- user-local scheduled day; idempotency anchor, not fire-time day
  local_date DATE NOT NULL,
  sent_at    TIMESTAMPTZ,
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT notifications_anon_fk
    FOREIGN KEY (anon_id) REFERENCES profiles(anon_id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX notifications_once_per_day
  ON notifications (anon_id, type, local_date);

CREATE INDEX idx_notifications_feed
  ON notifications (anon_id, created_at DESC);

-- retry sweep scans sent_at IS NULL within the last hour
CREATE INDEX idx_notifications_unsent
  ON notifications (created_at) WHERE sent_at IS NULL;

ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

COMMIT;
