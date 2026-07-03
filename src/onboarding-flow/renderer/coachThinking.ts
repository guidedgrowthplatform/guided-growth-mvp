/**
 * Pure state logic for the coach "thinking" loading bubble (ThinkingDots on the
 * active beat). Extracted from useCoachThinking so the B19 rules are
 * unit-testable:
 *
 * 1. A Direct-LLM stream that was ALREADY busy when this beat's indicator
 *    mounted belongs to the PREVIOUS beat (its reply lands there). It must not
 *    draw a loading bubble on the new beat the moment it loads. Only a
 *    busy-rose edge observed on THIS beat counts.
 * 2. A stream that settles with NO assistant output (error / empty reply) must
 *    not leave the dots stuck: busy-settled clears the awaiting latch too.
 *    On the Vapi path busy never rises, so awaiting still clears only on
 *    assistant activity, exactly as before.
 */
export interface CoachThinkingState {
  /** User finished a turn on this beat; the coach owes a reply. */
  awaiting: boolean;
  /** A Direct-LLM stream turned busy while this beat was active. */
  busyHere: boolean;
}

export type CoachThinkingEvent =
  | { type: 'user-final' }
  | { type: 'assistant-activity' }
  | { type: 'busy-rose' }
  | { type: 'busy-settled' };

export const COACH_THINKING_INITIAL: CoachThinkingState = { awaiting: false, busyHere: false };

export function coachThinkingReducer(
  state: CoachThinkingState,
  event: CoachThinkingEvent,
): CoachThinkingState {
  switch (event.type) {
    case 'user-final':
      return state.awaiting ? state : { ...state, awaiting: true };
    case 'assistant-activity':
      return state.awaiting ? { ...state, awaiting: false } : state;
    case 'busy-rose':
      return state.busyHere ? state : { ...state, busyHere: true };
    case 'busy-settled':
      // The stream is done. If no assistant output arrived, nothing will clear
      // the latch later, so clear both here (stuck-bubble guard).
      return state.awaiting || state.busyHere ? { awaiting: false, busyHere: false } : state;
  }
}

/** The dots render while a reply is owed and the coach is not already speaking. */
export function showCoachThinking(state: CoachThinkingState, speaking: boolean): boolean {
  return (state.awaiting || state.busyHere) && !speaking;
}
