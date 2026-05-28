-- Trim Realtime WAL overhead on onboarding_states (updated many times per
-- onboarding session, data jsonb grows). 038 set REPLICA IDENTITY FULL, which
-- logs the entire old row on every UPDATE.
--
-- Use USING INDEX (the anon_id unique index), NOT DEFAULT: the client Realtime
-- subscription filters on `anon_id=eq.X`, a non-PK column. Under DEFAULT only
-- the PK (id) is in the change identity, so filtered UPDATE events would not be
-- delivered. The anon_id unique index keeps anon_id in the identity, so the
-- filter still matches while dropping the full old-tuple payload.
ALTER TABLE public.onboarding_states
  REPLICA IDENTITY USING INDEX onboarding_states_anon_id_key;
