CREATE INDEX coach_sessions_active_idx
  ON public.coach_sessions (anon_id, state)
  WHERE state IN ('creating', 'spawning', 'active');
