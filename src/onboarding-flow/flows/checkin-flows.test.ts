import { describe, expect, it } from 'vitest';
import { applyCapture, canGoBack, goBack, initFlowMachine, validateFlow } from '../flowMachine';
import type { BeatCapture, FlowDocument } from '../types';
import { CHECKIN_FLOWS, eveningCheckinV1, morningCheckinV1 } from './checkin-flows';

/** Drive a flow to completion with empty captures, returning the final state. */
function walkToEnd(doc: FlowDocument): ReturnType<typeof initFlowMachine> {
  let state = initFlowMachine(doc);
  let guard = 0;
  while (state.status === 'running' && guard++ < 50) {
    const capture: BeatCapture = { data: {} };
    state = applyCapture(doc, state, capture);
  }
  return state;
}

describe('check-in flows: validity', () => {
  it('the morning check-in flow has no dangling references', () => {
    expect(validateFlow(morningCheckinV1)).toEqual([]);
  });

  it('the evening check-in flow has no dangling references', () => {
    expect(validateFlow(eveningCheckinV1)).toEqual([]);
  });
});

describe('check-in flows: shape mirrors the builder', () => {
  it('morning: greeting -> state-check -> are-you-done -> wrap', () => {
    expect(morningCheckinV1.entryNodeId).toBe('morning-greeting');
    expect(morningCheckinV1.nodes.map((n) => n.componentType)).toEqual([
      'coach-bubble',
      'state-check',
      'coach-bubble',
      'coach-bubble',
    ]);
  });

  it('evening: greeting -> habit-review -> are-you-done -> reflection -> wrap', () => {
    expect(eveningCheckinV1.entryNodeId).toBe('evening-greeting');
    expect(eveningCheckinV1.nodes.map((n) => n.componentType)).toEqual([
      'coach-bubble',
      'habit-review',
      'coach-bubble',
      'reflection',
      'coach-bubble',
    ]);
  });

  it('the state-check beat wires to record_checkin', () => {
    const beat = morningCheckinV1.nodes.find((n) => n.componentType === 'state-check');
    expect(beat?.tool?.toolName).toBe('record_checkin');
  });

  it('the habit-review beat wires to complete_habit and reflection to log_reflection', () => {
    const review = eveningCheckinV1.nodes.find((n) => n.componentType === 'habit-review');
    const reflection = eveningCheckinV1.nodes.find((n) => n.componentType === 'reflection');
    expect(review?.tool?.toolName).toBe('complete_habit');
    expect(reflection?.tool?.toolName).toBe('log_reflection');
  });
});

describe('check-in flows: run to completion', () => {
  it('the morning flow walks start to finish', () => {
    const state = walkToEnd(morningCheckinV1);
    expect(state.status).toBe('complete');
    expect(state.visited).toEqual([
      'morning-greeting',
      'morning-state',
      'morning-are-you-done',
      'morning-wrap',
    ]);
  });

  it('the evening flow walks start to finish', () => {
    const state = walkToEnd(eveningCheckinV1);
    expect(state.status).toBe('complete');
    expect(state.visited).toEqual([
      'evening-greeting',
      'evening-habit-review',
      'evening-are-you-done',
      'evening-reflection',
      'evening-wrap',
    ]);
  });

  it('CHECKIN_FLOWS indexes both documents by id', () => {
    expect(Object.keys(CHECKIN_FLOWS).sort()).toEqual(['evening-checkin-v1', 'morning-checkin-v1']);
  });
});

describe('check-in flows: "are you done?" fires only when partial', () => {
  it('morning: fully-answered state check SKIPS are-you-done -> wrap', () => {
    let state = initFlowMachine(morningCheckinV1);
    state = applyCapture(morningCheckinV1, state, { data: {} }); // greeting -> state
    state = applyCapture(morningCheckinV1, state, {
      data: { checkin: { sleep: 3, mood: 3, energy: 3, stress: 3 } },
    });
    expect(state.currentNodeId).toBe('morning-wrap');
    expect(state.visited).not.toContain('morning-are-you-done');
  });

  it('morning: partial state check SHOWS are-you-done', () => {
    let state = initFlowMachine(morningCheckinV1);
    state = applyCapture(morningCheckinV1, state, { data: {} });
    state = applyCapture(morningCheckinV1, state, { data: { checkin: { sleep: 3 } } });
    expect(state.currentNodeId).toBe('morning-are-you-done');
  });

  it('evening: all habits non-pending SKIPS are-you-done -> reflection', () => {
    let state = initFlowMachine(eveningCheckinV1);
    state = applyCapture(eveningCheckinV1, state, { data: {} }); // greeting -> habit review
    state = applyCapture(eveningCheckinV1, state, {
      data: { habitStatuses: { a: 'done', b: 'missed' } } as Record<string, unknown>,
    });
    expect(state.currentNodeId).toBe('evening-reflection');
    expect(state.visited).not.toContain('evening-are-you-done');
  });

  it('evening: a pending habit SHOWS are-you-done', () => {
    let state = initFlowMachine(eveningCheckinV1);
    state = applyCapture(eveningCheckinV1, state, { data: {} });
    state = applyCapture(eveningCheckinV1, state, {
      data: { habitStatuses: { a: 'done', b: 'pending' } } as Record<string, unknown>,
    });
    expect(state.currentNodeId).toBe('evening-are-you-done');
  });

  it('evening: back from reflection skips the skipped are-you-done back to habit review', () => {
    let state = initFlowMachine(eveningCheckinV1);
    state = applyCapture(eveningCheckinV1, state, { data: {} });
    state = applyCapture(eveningCheckinV1, state, {
      data: { habitStatuses: { a: 'done', b: 'missed' } } as Record<string, unknown>,
    });
    expect(state.currentNodeId).toBe('evening-reflection');
    expect(canGoBack(state, eveningCheckinV1)).toBe(true);
    state = goBack(eveningCheckinV1, state);
    expect(state.currentNodeId).toBe('evening-habit-review');
  });
});
