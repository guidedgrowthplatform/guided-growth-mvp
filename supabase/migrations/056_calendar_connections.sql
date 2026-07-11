-- Google Calendar integration (Part A). SERVER-ONLY tables.
-- The Google refresh token must never reach the client, so unlike
-- reflection_settings (051) these grant NOTHING to `authenticated` and expose no
-- anon-reachable RLS policy. Access is exclusively via the api/ pool, which
-- connects through DATABASE_URL and bypasses RLS. RLS is enabled with zero
-- policies as belt-and-suspenders deny-all for the anon key.

BEGIN;

-- One row per connected user: long-lived Google refresh token + cached
-- short-lived access token + the user's write-target choice + on/off switch.
CREATE TABLE IF NOT EXISTS calendar_connections (
  anon_id           UUID PRIMARY KEY REFERENCES profiles(anon_id) ON DELETE CASCADE,
  provider          VARCHAR(20) NOT NULL DEFAULT 'google',
  access_token      TEXT,                       -- short-lived; refreshed on demand
  refresh_token     TEXT NOT NULL,              -- long-lived Google refresh token
  token_expires_at  TIMESTAMPTZ,                -- when access_token expires
  target            VARCHAR(10) NOT NULL DEFAULT 'gg'
                    CHECK (target IN ('own', 'gg')),
  gg_calendar_id    TEXT,                        -- Google id of the created "Guided Growth" cal; NULL until first write
  scopes            TEXT,                        -- space-delimited granted scopes (audit/repair)
  enabled           BOOLEAN NOT NULL DEFAULT true,  -- A6 master switch (keeps token when off)
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE calendar_connections ENABLE ROW LEVEL SECURITY;
-- No anon/authenticated policy on purpose: only the service-role pool reads this.
-- Explicit REVOKE too — this holds long-lived Google tokens, so don't rely on RLS alone.
REVOKE ALL ON public.calendar_connections FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_connections TO service_role;

-- Idempotency map: one Google event per (user, ritual_type, calendar). Lets the
-- recurring-event writer (A5) PATCH instead of duplicating on re-run.
CREATE TABLE IF NOT EXISTS calendar_event_map (
  anon_id          UUID NOT NULL REFERENCES profiles(anon_id) ON DELETE CASCADE,
  ritual_type      VARCHAR(40) NOT NULL,        -- 'morning_checkin' | 'evening_reflection' | 'weekly' | 'habit:<uuid>'
  calendar_id      TEXT NOT NULL,               -- Google calendar the event lives on
  google_event_id  TEXT NOT NULL,               -- Google's event id (for patch/delete)
  rrule            TEXT,                          -- last RRULE written (drift detection)
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (anon_id, ritual_type, calendar_id)
);

ALTER TABLE calendar_event_map ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.calendar_event_map FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_event_map TO service_role;

COMMIT;
