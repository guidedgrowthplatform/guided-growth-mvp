import { describe, expect, it } from 'vitest';
import {
  COACH_THINKING_INITIAL,
  type CoachThinkingEvent,
  type CoachThinkingState,
  coachThinkingReducer,
  showCoachThinking,
} from './coachThinking';

function run(events: CoachThinkingEvent[], from: CoachThinkingState = COACH_THINKING_INITIAL) {
  return events.reduce(coachThinkingReducer, from);
}

describe('coachThinkingReducer (B19: loading bubble on beat load / stuck bubble)', () => {
  it('shows nothing on a fresh beat (no loading bubble on beat load)', () => {
    expect(showCoachThinking(COACH_THINKING_INITIAL, false)).toBe(false);
  });

  it('a stream already busy at mount never lights the dots (no busy-rose edge here)', () => {
    // The previous beat's stream is still in flight when the new beat mounts.
    // Without a rise observed on this beat, nothing turns the dots on. A later
    // settle of that inherited stream also leaves the state dark.
    const state = run([{ type: 'busy-settled' }]);
    expect(showCoachThinking(state, false)).toBe(false);
  });

  it('lights up after a user final, clears on assistant activity', () => {
    let state = run([{ type: 'user-final' }]);
    expect(showCoachThinking(state, false)).toBe(true);
    state = run([{ type: 'assistant-activity' }], state);
    expect(showCoachThinking(state, false)).toBe(false);
  });

  it('lights up on a busy rise observed on this beat', () => {
    const state = run([{ type: 'busy-rose' }]);
    expect(showCoachThinking(state, false)).toBe(true);
  });

  it('a reply-less settle clears the awaiting latch (no stuck bubble)', () => {
    // User speaks, the LLM stream starts, then settles with NO assistant
    // output (error or empty). The old logic left `awaiting` true forever.
    const state = run([{ type: 'user-final' }, { type: 'busy-rose' }, { type: 'busy-settled' }]);
    expect(showCoachThinking(state, false)).toBe(false);
  });

  it('never shows while the coach is speaking', () => {
    const state = run([{ type: 'user-final' }, { type: 'busy-rose' }]);
    expect(showCoachThinking(state, true)).toBe(false);
  });

  it('vapi path: awaiting survives a beat with no busy edges until assistant activity', () => {
    let state = run([{ type: 'user-final' }]);
    expect(showCoachThinking(state, false)).toBe(true);
    // no busy-rose/settled on the Vapi path; only the coach clearing it works
    state = run([{ type: 'assistant-activity' }], state);
    expect(showCoachThinking(state, false)).toBe(false);
  });
});
