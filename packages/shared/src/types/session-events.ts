// Single source of truth for session_log event types.
// Mirror of seed rows in supabase/migrations/017_session_log_event_types.sql.
// Update both in the same PR.

export const SESSION_LOG_EVENTS = [
  'navigate',
  'voice_started',
  'voice_ended',
  'mic_tapped',
  'mic_permission_granted',
  'mic_permission_denied',
  'form_submit',
  'habit_added',
  'habit_edited',
  'habit_deleted',
  'habit_completed',
  'habit_missed',
  'checkin_started',
  'checkin_completed',
  'goal_set',
  'goal_outcome_logged',
  'reflection_logged',
  'settings_changed',
  'focus_started',
  'focus_ended',
  'intent_classified',
  'voice_cap_reached',
  'llm_call',
  'onboarding_completed',
  'voice_preference_set',
  'user_returned',
] as const;

export type SessionLogEvent = (typeof SESSION_LOG_EVENTS)[number];

export function isSessionLogEvent(x: unknown): x is SessionLogEvent {
  return typeof x === 'string' && (SESSION_LOG_EVENTS as readonly string[]).includes(x);
}
