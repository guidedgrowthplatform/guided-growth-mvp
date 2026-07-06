/**
 * Timeline stability (Loop 4, B21 family): over a scripted full run of the real
 * generated flow, the visible timeline of completed beats only GROWS (visited is
 * append-only except the explicit back action), and exactly one beat is active
 * at a time (the machine's current node is always the tail of visited).
 *
 * Also pins the two B21 mechanisms:
 * - fastForwardToNode resolves the fork TOWARD the target lane instead of
 *   falling through to the merge and burning the machine to completion
 *   (?startAt=goals used to render the whole flow at once, with both habit
 *   beats "simultaneously" and no lane beats at all).
 * - captureCompletesBeat blocks a coach-driven advance past a data beat when
 *   the server data cannot replay its capture (the empty-picker skip).
 */
import { describe, expect, it } from 'vitest';
import { applyCapture, type FlowMachineState, getNode, initFlowMachine } from '../flowMachine';
import type { BeatCapture } from '../types';
import { loadPublishedFlow } from '../useFlow';
import {
  captureCompletesBeat,
  fastForwardToNode,
  serverCaptureForBeat,
} from '../useFlowOrchestrator';

const flow = loadPublishedFlow();

/** The scripted beginner run: node id -> the capture a user tap would produce. */
const BEGINNER_RUN: Array<{ node: string; cap: BeatCapture }> = [
  { node: 'auth', cap: { data: {} } },
  { node: 'mic', cap: { data: {} } },
  { node: 'profile', cap: { data: { age: 25, gender: 'Male' } } },
  // B47 reorder: the fork directly follows profile; the setup block
  // (state-check, morning, reflection, weekly-day) runs after the lanes merge.
  { node: 'path-fork', cap: { data: {}, path: 'simple' } },
  { node: 'category', cap: { data: { category: 'Sleep better' } } },
  { node: 'goals', cap: { data: { goals: ['Fall asleep earlier'] } } },
  {
    node: 'habit-select',
    cap: {
      data: {
        habitConfigs: {
          'No screens after 10 PM': {
            days: [1, 2, 3],
            time: '22:00',
            reminder: true,
            schedule: 'Weekday',
          },
        },
      },
    },
  },
  {
    node: 'habit-schedule',
    cap: {
      data: {
        habitConfigs: {
          'No screens after 10 PM': {
            days: [1, 2, 3],
            time: '22:00',
            reminder: true,
            schedule: 'Weekday',
          },
        },
      },
    },
  },
  { node: 'state-check', cap: { data: { checkin: { mood: 4 } } as BeatCapture['data'] } },
  {
    node: 'morning-checkin-setup',
    cap: {
      data: {
        morningCheckin: { time: '08:00', days: [1, 2, 3], reminder: true, schedule: 'Weekday' },
      },
    },
  },
  {
    node: 'reflection-setup',
    cap: {
      data: {
        reflectionConfig: { time: '21:45', days: [1, 2, 3], reminder: true, schedule: 'Weekday' },
      },
    },
  },
  {
    node: 'weekly-day-setup',
    cap: { data: { weeklyConfig: { day: 0 } } as BeatCapture['data'] },
  },
  { node: 'into-app', cap: { data: {} } },
  { node: 'weekly-projection-blank', cap: { data: {} } },
  { node: 'weekly-projection-full', cap: { data: {} } },
  { node: 'weekly-projection-p78', cap: { data: {} } },
  { node: 'weekly-projection-p36', cap: { data: {} } },
  { node: 'weekly-projection-gaps', cap: { data: {} } },
];

describe('scripted full run: the timeline of completed beats only grows', () => {
  it('visited is append-only and the active beat is always the single tail', () => {
    let state: FlowMachineState = initFlowMachine(flow);
    for (const step of BEGINNER_RUN) {
      // The scripted step must match the machine's actual position.
      expect(state.currentNodeId).toBe(step.node);
      // Exactly one active beat: the current node is the tail of visited.
      expect(state.visited[state.visited.length - 1]).toBe(step.node);
      expect(new Set(state.visited).size).toBe(state.visited.length);

      const prevVisited = state.visited;
      state = applyCapture(flow, state, step.cap);

      // Append-only: the previous timeline is a strict prefix of the new one.
      expect(state.visited.slice(0, prevVisited.length)).toEqual(prevVisited);
      expect(state.visited.length).toBeLessThanOrEqual(prevVisited.length + 1);
    }
    expect(state.status).toBe('complete');
    // The completed run visited every beginner-lane beat exactly once.
    expect(state.visited).toContain('goals');
    expect(state.visited).toContain('habit-select');
    expect(state.visited).toContain('habit-schedule');
    expect(state.visited).not.toContain('advanced-input');
  });
});

describe('fastForwardToNode (B21: ?startAt burn-through)', () => {
  it('reaches a beginner-lane node by resolving the fork toward it', () => {
    const st = fastForwardToNode(flow, initFlowMachine(flow), 'goals');
    expect(st.currentNodeId).toBe('goals');
    expect(st.status).toBe('running');
    expect(st.visited[st.visited.length - 1]).toBe('goals');
    // The lane path was walked, not skipped to the merge.
    expect(st.visited).toContain('category');
    expect(st.visited).not.toContain('into-app');
    expect(st.answers.path).toBe('simple');
  });

  it('reaches an advanced-lane node the same way', () => {
    const st = fastForwardToNode(flow, initFlowMachine(flow), 'advanced-frequency');
    expect(st.currentNodeId).toBe('advanced-frequency');
    expect(st.answers.path).toBe('braindump');
  });

  it('returns the START state for an unreachable target instead of a burned-through flow', () => {
    const init = initFlowMachine(flow);
    const st = fastForwardToNode(flow, init, 'no-such-node');
    expect(st).toBe(init);
    expect(st.status).toBe('running');
    expect(st.currentNodeId).toBe(flow.entryNodeId);
  });
});

describe('captureCompletesBeat (B21: a step climb alone must not skip a data beat)', () => {
  const node = (id: string) => getNode(flow, id);

  it('blocks habit-select when the server data has no habitConfigs yet', () => {
    const cap = serverCaptureForBeat(node('habit-select'), {});
    expect(captureCompletesBeat(node('habit-select'), cap)).toBe(false);
  });

  it('passes habit-select once habitConfigs exist', () => {
    const cap = serverCaptureForBeat(node('habit-select'), {
      habitConfigs: { Walk: { days: [1], time: '09:00', reminder: true, schedule: 'Weekday' } },
    });
    expect(captureCompletesBeat(node('habit-select'), cap)).toBe(true);
  });

  it('passes the fork via the path field', () => {
    const cap = serverCaptureForBeat(node('path-fork'), { path: 'simple' } as never);
    expect(captureCompletesBeat(node('path-fork'), cap)).toBe(true);
  });

  it('blocks the fork without a path', () => {
    const cap = serverCaptureForBeat(node('path-fork'), {});
    expect(captureCompletesBeat(node('path-fork'), cap)).toBe(false);
  });

  it('lets persist-less beats advance freely (into-app, projections)', () => {
    for (const id of ['into-app', 'weekly-projection-blank']) {
      const cap = serverCaptureForBeat(node(id), {});
      expect(captureCompletesBeat(node(id), cap)).toBe(true);
    }
  });

  it('state-check completes only on real evidence (proxy removed by Loop 2)', () => {
    // The old morningCheckin proxy for state-check was removed deliberately in
    // !398: it fabricated a default that pushed the resume walk through beats
    // the user never did (B9) and poisoned the morning-setup prefill. An empty
    // server row must therefore HOLD the gate; a row carrying stateCheck (the
    // record_checkin voice tool) or checkin (the tap path) completes it.
    const empty = serverCaptureForBeat(node('state-check'), {});
    expect(captureCompletesBeat(node('state-check'), empty)).toBe(false);
    const voiced = serverCaptureForBeat(node('state-check'), { stateCheck: { mood: 3 } } as never);
    expect(captureCompletesBeat(node('state-check'), voiced)).toBe(true);
  });
});
