-- 046_session_log_habit_missed.sql
--
-- New session_log event 'habit_missed' for the 3-state habit-day model — fires
-- when a user explicitly marks a habit missed (vs the implicit no-row pending).
-- Allow-list insert mirrors 017_session_log_event_types.sql; the FK on
-- session_log.event_type rejects unknown types, so this must land before any
-- 'habit_missed' row is written. Source of truth also updated in
-- api/_lib/session-log-events.ts + packages/shared/src/types/session-events.ts.

INSERT INTO session_log_event_types (event_type) VALUES ('habit_missed')
ON CONFLICT (event_type) DO NOTHING;
