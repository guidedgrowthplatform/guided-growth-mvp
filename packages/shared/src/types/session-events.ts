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

// Per-event payload contracts. The endpoint does not enforce shapes;
// frontend callers should pass payloads matching the schema documented
// in .claude/skills/app-session-events.
export interface SessionLogPayloadByEvent {
  navigate: { from_screen: string | null; to_screen: string; trigger: 'tap' | 'voice' | 'auto' };
  voice_started: { screen_id: string };
  voice_ended: {
    screen_id: string;
    duration_sec: number;
    reason: 'user_exit' | 'silence_timeout' | 'navigate_away' | 'error';
  };
  mic_tapped: { from_screen: string };
  mic_permission_granted: Record<string, never>;
  mic_permission_denied: Record<string, never>;
  form_submit: { screen_id: string; fields?: Record<string, unknown> };
  habit_added: {
    habit_id: string;
    name: string;
    time?: string | null;
    frequency?: string;
    has_reminder?: boolean;
  };
  habit_edited: { habit_id: string; fields_changed: string[] };
  habit_deleted: { habit_id: string; name: string };
  habit_completed: { habit_id: string; completed_at: string; via: 'tap' | 'voice' | 'focus_end' };
  checkin_started: { type: 'morning' | 'evening' };
  checkin_completed: {
    type: 'morning' | 'evening';
    sleep?: number;
    mood?: number;
    energy?: number;
    stress?: number;
    via?: 'tap' | 'voice';
  };
  goal_set: { goal_text: string };
  goal_outcome_logged: { goal_text: string; outcome: 'achieved' | 'missed' | 'partial' };
  reflection_logged: { style: string; prompt: string; response_length: number };
  settings_changed: { field: string; old_value: unknown; new_value: unknown };
  focus_started: { habit_id: string | null; duration_min: number };
  focus_ended: {
    habit_id: string | null;
    duration_min: number;
    status: 'completed' | 'cancelled';
  };
  intent_classified: { intent: string; confidence: number };
  voice_cap_reached: Record<string, never>;
  llm_call: {
    path: 'vapi' | 'async' | 'direct';
    screen_id: string;
    prompt_tokens: number;
    response_tokens: number;
    latency_ms: number;
    delta_event_count: number;
  };
  onboarding_completed: {
    duration_sec: number;
    habit_count: number;
    reflection_style: string;
  };
  voice_preference_set: { preference: 'voice' | 'screen' };
  user_returned: { days_inactive: number };
}
