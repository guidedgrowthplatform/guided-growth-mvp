BEGIN;

CREATE TYPE public.coach_session_state AS ENUM (
  'creating', 'spawning', 'active', 'ended', 'failed', 'expired'
);

CREATE TABLE public.coach_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anon_id UUID NOT NULL REFERENCES public.profiles(anon_id) ON DELETE CASCADE,
  surface TEXT NOT NULL,
  flow_id TEXT NOT NULL,
  screen_id TEXT NOT NULL,
  brain_profile TEXT NOT NULL,
  effective_profile_nonsecret JSONB NOT NULL,
  region TEXT,
  state public.coach_session_state NOT NULL DEFAULT 'creating',
  capability_jti UUID NOT NULL UNIQUE,
  allowed_tools JSONB NOT NULL DEFAULT '[]'::jsonb,
  completion_recipe JSONB NOT NULL DEFAULT '{}'::jsonb,
  recipe_progress JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  terminal_reason TEXT
);

CREATE INDEX coach_sessions_anon_id_created_at_idx
  ON public.coach_sessions (anon_id, created_at DESC);

ALTER TABLE public.coach_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_isolation" ON public.coach_sessions
  FOR ALL USING (anon_id = public.current_anon_id())
  WITH CHECK (anon_id = public.current_anon_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coach_sessions TO authenticated;

COMMIT;
