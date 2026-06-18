// Pure, renderer-agnostic stage machine for the scripted check-in flow.
// Knows ONLY about stage transitions — no script text, no React, no I/O. The
// hook maps each stage to scripted lines / cards / tools. Deterministic and
// fully unit-testable.
//
// Morning: state(greeting+capture) → [are_you_done if partial] → wrap → done
// Evening: habits(greeting+review) → [are_you_done if partial] → proud →
//          forgive → grateful → wrap → done

export type CheckinMode = 'morning' | 'evening';

export type CheckinStage =
  | 'state' // morning bounded set: sleep/mood/energy/stress
  | 'habits' // evening bounded set: today's habits
  | 'are_you_done' // shared gate — entered ONLY when the set is partial
  | 'reflect_proud'
  | 'reflect_forgive'
  | 'reflect_grateful'
  | 'wrap'
  | 'done';

export interface CheckinFlowState {
  mode: CheckinMode;
  stage: CheckinStage;
}

// remaining = count of still-unanswered items in the current bounded set.
export type CheckinFlowEvent =
  | { type: 'PROGRESS'; remaining: number } // a capture changed; auto-advance at 0
  | { type: 'USER_DONE'; remaining: number } // user said/tapped "done"
  | { type: 'REFLECTION_ANSWERED' } // one reflection prompt answered
  | { type: 'CONTINUE' }; // advance a non-input stage (wrap → done)

export function initialFlowState(mode: CheckinMode): CheckinFlowState {
  return { mode, stage: mode === 'morning' ? 'state' : 'habits' };
}

function afterBounded(mode: CheckinMode): CheckinStage {
  return mode === 'morning' ? 'wrap' : 'reflect_proud';
}

export function checkinFlowReducer(
  state: CheckinFlowState,
  event: CheckinFlowEvent,
): CheckinFlowState {
  const { mode, stage } = state;
  const next = (stage: CheckinStage): CheckinFlowState => ({ mode, stage });

  switch (stage) {
    // Bounded capture: fully answered → straight to the next phase (no gate);
    // user-done while partial → the "are you done?" gate.
    case 'state':
    case 'habits':
      if (event.type === 'PROGRESS' && event.remaining === 0) return next(afterBounded(mode));
      if (event.type === 'USER_DONE')
        return next(event.remaining === 0 ? afterBounded(mode) : 'are_you_done');
      return state;

    // Gate: completing the set advances; "done" again accepts the partial set.
    case 'are_you_done':
      if (event.type === 'PROGRESS' && event.remaining === 0) return next(afterBounded(mode));
      if (event.type === 'USER_DONE') return next(afterBounded(mode));
      return state;

    case 'reflect_proud':
      return event.type === 'REFLECTION_ANSWERED' ? next('reflect_forgive') : state;
    case 'reflect_forgive':
      return event.type === 'REFLECTION_ANSWERED' ? next('reflect_grateful') : state;
    case 'reflect_grateful':
      return event.type === 'REFLECTION_ANSWERED' ? next('wrap') : state;

    case 'wrap':
      return event.type === 'CONTINUE' ? next('done') : state;
    case 'done':
      return state;
  }
}

// Session = the machine state PLUS the ordered list of stages entered, so the
// transcript can be rebuilt deterministically. Pure — drives the hook's reducer.
export interface CheckinFlowSession {
  flow: CheckinFlowState;
  visited: CheckinStage[];
}

export function initialFlowSession(mode: CheckinMode): CheckinFlowSession {
  const flow = initialFlowState(mode);
  return { flow, visited: [flow.stage] };
}

export function flowSessionReducer(
  session: CheckinFlowSession,
  event: CheckinFlowEvent,
): CheckinFlowSession {
  const flow = checkinFlowReducer(session.flow, event);
  if (flow.stage === session.flow.stage) return session;
  return { flow, visited: [...session.visited, flow.stage] };
}

export interface StageInfo {
  /** Which interactive card to keep visible, if any. */
  card: 'state' | 'habits' | null;
  /** Waiting on a user answer (tap or free text/speech). */
  expectsInput: boolean;
  /** Terminal stage — the check-in is complete. */
  terminal: boolean;
  /** Which fixed reflection prompt this stage asks, if any. */
  reflectionPrompt: 'proud' | 'forgive' | 'grateful' | null;
}

export function stageInfo(state: CheckinFlowState): StageInfo {
  switch (state.stage) {
    case 'state':
      return { card: 'state', expectsInput: true, terminal: false, reflectionPrompt: null };
    case 'habits':
      return { card: 'habits', expectsInput: true, terminal: false, reflectionPrompt: null };
    case 'are_you_done':
      return {
        card: state.mode === 'morning' ? 'state' : 'habits',
        expectsInput: true,
        terminal: false,
        reflectionPrompt: null,
      };
    case 'reflect_proud':
      return { card: null, expectsInput: true, terminal: false, reflectionPrompt: 'proud' };
    case 'reflect_forgive':
      return { card: null, expectsInput: true, terminal: false, reflectionPrompt: 'forgive' };
    case 'reflect_grateful':
      return { card: null, expectsInput: true, terminal: false, reflectionPrompt: 'grateful' };
    case 'wrap':
      return { card: null, expectsInput: false, terminal: false, reflectionPrompt: null };
    case 'done':
      return { card: null, expectsInput: false, terminal: true, reflectionPrompt: null };
  }
}
