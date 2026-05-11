-- P1-04 support: identity table for session_log.event_type.
-- Source of truth: api/_lib/sessionLogEvents.ts. Update both in the same PR.
-- service_role gets SELECT only on purpose — runtime app never INSERTs event types.

CREATE TABLE IF NOT EXISTS session_log_event_types (
  event_type TEXT PRIMARY KEY,
  status     TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO session_log_event_types (event_type) VALUES
  ('navigate'), ('voice_started'), ('voice_ended'), ('mic_tapped'),
  ('mic_permission_granted'), ('mic_permission_denied'), ('form_submit'),
  ('habit_added'), ('habit_edited'), ('habit_deleted'), ('habit_completed'),
  ('checkin_started'), ('checkin_completed'), ('goal_set'),
  ('goal_outcome_logged'), ('reflection_logged'), ('settings_changed'),
  ('focus_started'), ('focus_ended'), ('intent_classified'),
  ('voice_cap_reached'), ('llm_call'), ('onboarding_completed'),
  ('voice_preference_set'), ('user_returned')
ON CONFLICT (event_type) DO NOTHING;

-- Abort if any pre-existing session_log row would violate the new FK.
DO $$
DECLARE
  bad_count INT;
BEGIN
  SELECT COUNT(*) INTO bad_count
  FROM session_log
  WHERE event_type NOT IN (SELECT event_type FROM session_log_event_types);
  IF bad_count > 0 THEN
    RAISE EXCEPTION
      'Refusing to add FK: % session_log row(s) have unknown event_type', bad_count;
  END IF;
END $$;

-- Idempotent FK add — safe to re-run.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'session_log_event_type_fk'
  ) THEN
    ALTER TABLE session_log
      ADD CONSTRAINT session_log_event_type_fk
      FOREIGN KEY (event_type) REFERENCES session_log_event_types(event_type);
  END IF;
END $$;

ALTER TABLE session_log_event_types ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON session_log_event_types TO service_role;
