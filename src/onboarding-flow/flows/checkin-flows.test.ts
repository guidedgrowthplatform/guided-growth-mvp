import { describe, expect, it } from 'vitest';
import { applyCapture, initFlowMachine, validateFlow } from '../flowMachine';
import type { BeatCapture, FlowDocument } from '../types';
import eveningGeneratedJson from './evening-checkin-v1.generated.json';
import morningGeneratedJson from './morning-checkin-v1.generated.json';

// Retargeted at the builder-generated flows (the runtime artifacts) after the
// L1-6/L1-7 cutover; the hand defs live on as __fixtures__/checkin-flows-v1.ts.
const morningCheckinV1 = morningGeneratedJson as unknown as FlowDocument;
const eveningCheckinV1 = eveningGeneratedJson as unknown as FlowDocument;
const CHECKIN_FLOWS = {
  'morning-checkin-v1': morningCheckinV1,
  'evening-checkin-v1': eveningCheckinV1,
} as const;

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
