-- Screen Time coach data contract event types (docs/screentime/coach-data-contract.md).
-- Mirror of packages/shared/src/types/session-events.ts. Update both in the same PR.

INSERT INTO session_log_event_types (event_type) VALUES
  ('screentime_boundary_set'),
  ('screentime_boundary_removed'),
  ('screentime_boundary_state_changed'),
  ('screentime_block_hit'),
  ('screentime_override_chosen'),
  ('screentime_break_started'),
  ('screentime_break_ended')
ON CONFLICT (event_type) DO NOTHING;
