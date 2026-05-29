-- Enable Supabase Realtime broadcasts for onboarding_states so Vapi tool
-- writes (submit_profile and future per-screen tools) propagate to the
-- frontend without a refetch.
--
-- Two parts:
--  1. Add the table to the supabase_realtime publication (wrapped in a guard
--     for idempotency — running twice should not error).
--  2. REPLICA IDENTITY FULL so the broadcast payload includes every column
--     (in particular `data` JSONB and `anon_id`), not just the primary key.
--     Without this, payload.new lacks the fields useOnboardingRealtimeSync
--     reads when filtering by anon_id.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'onboarding_states'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.onboarding_states;
  END IF;
END $$;

ALTER TABLE public.onboarding_states REPLICA IDENTITY FULL;
