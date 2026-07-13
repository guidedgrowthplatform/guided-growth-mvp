-- Calendar OAuth CSRF/replay nonce store. SERVER-ONLY (same posture as 056).
-- One short-lived single-use `state` row per Connect attempt; never reaches the client.

BEGIN;

CREATE TABLE IF NOT EXISTS calendar_oauth_state (
  nonce       TEXT PRIMARY KEY,                 -- random; the OAuth `state` param
  anon_id     UUID NOT NULL REFERENCES profiles(anon_id) ON DELETE CASCADE,
  platform    VARCHAR(10) NOT NULL CHECK (platform IN ('web', 'native')),
  scheme      VARCHAR(20),                      -- native return scheme only
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE calendar_oauth_state ENABLE ROW LEVEL SECURITY;
-- No anon/authenticated policy on purpose: only the service-role pool touches this.
REVOKE ALL ON public.calendar_oauth_state FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_oauth_state TO service_role;

COMMIT;
