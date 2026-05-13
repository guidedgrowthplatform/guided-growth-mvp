import { describe, expect, it } from 'vitest';
import { SESSION_LOG_EVENTS, isSessionLogEvent } from '../session-log-events';

describe('session_log event whitelist', () => {
  it('has exactly 25 events', () => {
    expect(SESSION_LOG_EVENTS).toHaveLength(25);
  });

  it('contains the v6.0 core taxonomy', () => {
    const required = [
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
    ];
    for (const e of required) {
      expect(SESSION_LOG_EVENTS).toContain(e);
    }
  });

  it('has no duplicates', () => {
    expect(new Set(SESSION_LOG_EVENTS).size).toBe(SESSION_LOG_EVENTS.length);
  });

  it('uses past-tense / state-noun naming (no present-tense verbs)', () => {
    // Sanity check vs the PostHog taxonomy which uses present tense like
    // create_habit, start_voice_session. session_log should be past tense.
    const presentTenseRedFlags = ['create_', 'start_voice_', 'complete_voice_', 'view_'];
    for (const evt of SESSION_LOG_EVENTS) {
      for (const flag of presentTenseRedFlags) {
        expect(evt.startsWith(flag)).toBe(false);
      }
    }
  });
});

describe('isSessionLogEvent', () => {
  it('returns true for canonical events', () => {
    expect(isSessionLogEvent('habit_added')).toBe(true);
    expect(isSessionLogEvent('navigate')).toBe(true);
  });

  it('returns false for non-events', () => {
    expect(isSessionLogEvent('auth_started')).toBe(false);
    expect(isSessionLogEvent('')).toBe(false);
    expect(isSessionLogEvent(null)).toBe(false);
    expect(isSessionLogEvent(undefined)).toBe(false);
    expect(isSessionLogEvent(42)).toBe(false);
    expect(isSessionLogEvent({})).toBe(false);
  });

  it('does not accept PostHog-style present-tense aliases', () => {
    expect(isSessionLogEvent('create_habit')).toBe(false);
    expect(isSessionLogEvent('complete_habit')).toBe(false);
  });
});
