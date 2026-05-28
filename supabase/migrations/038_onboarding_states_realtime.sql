ALTER TABLE public.onboarding_states REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'onboarding_states'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.onboarding_states;
  END IF;
END $$;
