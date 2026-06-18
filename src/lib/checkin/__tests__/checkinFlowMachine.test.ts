import { describe, expect, it } from 'vitest';
import {
  type CheckinFlowState,
  checkinFlowReducer,
  flowSessionReducer,
  initialFlowSession,
  initialFlowState,
  stageInfo,
} from '../checkinFlowMachine';

describe('initialFlowState', () => {
  it('morning starts at the state-capture stage', () => {
    expect(initialFlowState('morning')).toEqual({ mode: 'morning', stage: 'state' });
  });
  it('evening starts at the habits stage', () => {
    expect(initialFlowState('evening')).toEqual({ mode: 'evening', stage: 'habits' });
  });
});

describe('morning flow', () => {
  const start = initialFlowState('morning');

  it('all four answered → straight to wrap (no gate)', () => {
    const s = checkinFlowReducer(start, { type: 'PROGRESS', remaining: 0 });
    expect(s.stage).toBe('wrap');
  });

  it('user-done while partial → the are-you-done gate', () => {
    const s = checkinFlowReducer(start, { type: 'USER_DONE', remaining: 2 });
    expect(s.stage).toBe('are_you_done');
  });

  it('user-done with nothing left → wrap, skipping the gate', () => {
    const s = checkinFlowReducer(start, { type: 'USER_DONE', remaining: 0 });
    expect(s.stage).toBe('wrap');
  });

  it('gate → completing the set advances to wrap', () => {
    let s: CheckinFlowState = { mode: 'morning', stage: 'are_you_done' };
    s = checkinFlowReducer(s, { type: 'PROGRESS', remaining: 0 });
    expect(s.stage).toBe('wrap');
  });

  it('gate → saying done again accepts the partial set and advances', () => {
    let s: CheckinFlowState = { mode: 'morning', stage: 'are_you_done' };
    s = checkinFlowReducer(s, { type: 'USER_DONE', remaining: 3 });
    expect(s.stage).toBe('wrap');
  });

  it('wrap → CONTINUE → done (terminal)', () => {
    let s: CheckinFlowState = { mode: 'morning', stage: 'wrap' };
    s = checkinFlowReducer(s, { type: 'CONTINUE' });
    expect(s.stage).toBe('done');
    expect(stageInfo(s).terminal).toBe(true);
  });

  it('partial progress (remaining > 0) does not advance', () => {
    const s = checkinFlowReducer(start, { type: 'PROGRESS', remaining: 1 });
    expect(s).toEqual(start);
  });
});

describe('evening flow', () => {
  const start = initialFlowState('evening');

  it('all habits resolved → reflection (proud first)', () => {
    const s = checkinFlowReducer(start, { type: 'PROGRESS', remaining: 0 });
    expect(s.stage).toBe('reflect_proud');
  });

  it('partial habits + done → gate → reflection', () => {
    let s = checkinFlowReducer(start, { type: 'USER_DONE', remaining: 1 });
    expect(s.stage).toBe('are_you_done');
    s = checkinFlowReducer(s, { type: 'USER_DONE', remaining: 1 });
    expect(s.stage).toBe('reflect_proud');
  });

  it('walks the three fixed reflection prompts in order, then wraps', () => {
    let s: CheckinFlowState = { mode: 'evening', stage: 'reflect_proud' };
    expect(stageInfo(s).reflectionPrompt).toBe('proud');
    s = checkinFlowReducer(s, { type: 'REFLECTION_ANSWERED' });
    expect(s.stage).toBe('reflect_forgive');
    expect(stageInfo(s).reflectionPrompt).toBe('forgive');
    s = checkinFlowReducer(s, { type: 'REFLECTION_ANSWERED' });
    expect(s.stage).toBe('reflect_grateful');
    expect(stageInfo(s).reflectionPrompt).toBe('grateful');
    s = checkinFlowReducer(s, { type: 'REFLECTION_ANSWERED' });
    expect(s.stage).toBe('wrap');
  });

  it('wrap → done', () => {
    const s = checkinFlowReducer({ mode: 'evening', stage: 'wrap' }, { type: 'CONTINUE' });
    expect(s.stage).toBe('done');
  });
});

describe('reducer ignores irrelevant events', () => {
  it('REFLECTION_ANSWERED in a capture stage is a no-op', () => {
    const s: CheckinFlowState = { mode: 'morning', stage: 'state' };
    expect(checkinFlowReducer(s, { type: 'REFLECTION_ANSWERED' })).toEqual(s);
  });
  it('done is terminal — every event is a no-op', () => {
    const s: CheckinFlowState = { mode: 'evening', stage: 'done' };
    expect(checkinFlowReducer(s, { type: 'CONTINUE' })).toEqual(s);
    expect(checkinFlowReducer(s, { type: 'PROGRESS', remaining: 0 })).toEqual(s);
  });
});

describe('flowSession — accumulates visited stages for the transcript', () => {
  it('starts with just the entry stage', () => {
    expect(initialFlowSession('morning').visited).toEqual(['state']);
    expect(initialFlowSession('evening').visited).toEqual(['habits']);
  });

  it('appends each NEW stage, ignoring no-op events', () => {
    let s = initialFlowSession('evening');
    s = flowSessionReducer(s, { type: 'PROGRESS', remaining: 2 }); // no change
    expect(s.visited).toEqual(['habits']);
    s = flowSessionReducer(s, { type: 'USER_DONE', remaining: 1 }); // → gate
    s = flowSessionReducer(s, { type: 'USER_DONE', remaining: 1 }); // → proud
    s = flowSessionReducer(s, { type: 'REFLECTION_ANSWERED' }); // → forgive
    s = flowSessionReducer(s, { type: 'REFLECTION_ANSWERED' }); // → grateful
    s = flowSessionReducer(s, { type: 'REFLECTION_ANSWERED' }); // → wrap
    s = flowSessionReducer(s, { type: 'CONTINUE' }); // → done
    expect(s.visited).toEqual([
      'habits',
      'are_you_done',
      'reflect_proud',
      'reflect_forgive',
      'reflect_grateful',
      'wrap',
      'done',
    ]);
  });

  it('a fully-answered morning skips the gate in the visited list', () => {
    let s = initialFlowSession('morning');
    s = flowSessionReducer(s, { type: 'PROGRESS', remaining: 0 }); // → wrap
    s = flowSessionReducer(s, { type: 'CONTINUE' }); // → done
    expect(s.visited).toEqual(['state', 'wrap', 'done']);
  });
});

describe('stageInfo', () => {
  it('capture stages keep the right card up and expect input', () => {
    expect(stageInfo({ mode: 'morning', stage: 'state' })).toMatchObject({
      card: 'state',
      expectsInput: true,
      terminal: false,
    });
    expect(stageInfo({ mode: 'evening', stage: 'habits' })).toMatchObject({
      card: 'habits',
      expectsInput: true,
    });
  });

  it('the gate keeps the mode-appropriate card visible', () => {
    expect(stageInfo({ mode: 'morning', stage: 'are_you_done' }).card).toBe('state');
    expect(stageInfo({ mode: 'evening', stage: 'are_you_done' }).card).toBe('habits');
  });

  it('reflection stages show no card but expect a spoken/typed answer', () => {
    const s = stageInfo({ mode: 'evening', stage: 'reflect_proud' });
    expect(s).toMatchObject({ card: null, expectsInput: true, reflectionPrompt: 'proud' });
  });

  it('wrap expects no input; done is terminal', () => {
    expect(stageInfo({ mode: 'morning', stage: 'wrap' }).expectsInput).toBe(false);
    expect(stageInfo({ mode: 'morning', stage: 'done' }).terminal).toBe(true);
  });
});
