-- session-expired push: per-device "notified once per lapse" marker.
-- re-arms when the user returns (registerToken bumps last_seen_at > this).
ALTER TABLE device_tokens
  ADD COLUMN session_expired_notified_at TIMESTAMPTZ;

-- serves both eligibility branches (never-notified AND notified_at < last_seen_at)
CREATE INDEX idx_device_tokens_last_seen ON device_tokens (last_seen_at);
