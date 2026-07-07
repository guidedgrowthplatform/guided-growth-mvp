import { describe, expect, it } from 'vitest';
import type { OnboardingStepData } from '@gg/shared/types';
import { applyCapture, getNode, initFlowMachine, type FlowMachineState } from '../flowMachine';
import flowJson from '../flows/onboarding-beginner-v1.generated.json';
import type { BeatCapture, FlowDocument, FlowNode } from '../types';
import {
  captureCompletesBeat,
  fastForwardToNode,
  serverCaptureForBeat,
} from '../useFlowOrchestrator';

/**
 * The LIVE advance path at the fork (the 2026-07-02 signed-in failures).
 *
 * FAIL-A (jump-to-end) history: under the pre-B47 flow order the last pre-fork
 * setup save (weekly-day-setup, step 9, GREATEST-pinned) landed its climb
 * AFTER the machine moved to the branch node, and the old merge fallthrough
 * carried an EMPTY fork capture straight to into-app (a "completed" run with
 * path=null). The B47 reorder puts the fork right after profile, but the
 * two-layer fix stays load-bearing: a stale climb must never traverse an
 * unanswered fork, on any order.
 *
 * These tests script the live sequence against the GENERATED flow (the one
 * production loads), asserting:
 *   1. flowMachine: an unanswered branch is a hard stop (no merge fallthrough
 *      on the default/live contract);
 *   2. orchestrator gate: captureCompletesBeat refuses the empty fork capture,
 *      and accepts it the moment the row holds a lane value — with or without
 *      a current_step climb (the Vapi server-side answer writes path via
 *      submit_path_choice, whose upsert leaves current_step untouched).
 */
const flow = flowJson as unknown as FlowDocument;

// What each beat's card capture produces (tap path), keyed by componentType.
// Mirrors the componentRegistry adapters (same table as the refresh matrix).
const TAP_CAPTURE: Record<string, BeatCapture> = {
  auth: { data: {} },
  'mic-permission': { data: {} },
  'profile-input': { data: { age: 30, gender: 'Male' } as BeatCapture['data'] },
  'why-intro': { data: {} },
  'state-check': { data: { checkin: { sleep: 3, mood: 4 } } as BeatCapture['data'] },
  'morning-checkin-setup': {
    data: {
      morningCheckin: { time: '08:00', days: [1, 2, 3, 4, 5], reminder: true, schedule: 'Weekday' },
    } as BeatCapture['data'],
  },
  'reflection-card': {
    data: {
      reflectionConfig: { time: '21:45', days: [1, 2, 3, 4, 5], reminder: true },
    } as BeatCapture['data'],
  },
  'weekly-day-picker': {
    data: { weeklyConfig: { day: 0 } } as BeatCapture['data'],
  },
  'category-grid': { data: { category: 'Health & Fitness' } as BeatCapture['data'] },
  'goals-list': { data: { goals: ['Move daily'] } as BeatCapture['data'] },
  'habit-picker': {
    data: {
      habitConfigs: { Walking: { days: [1, 2, 3], time: '08:00', reminder: true } },
    } as BeatCapture['data'],
  },
  'habit-schedule': {
    data: {
      habitConfigs: { Walking: { days: [1, 2, 3, 4], time: '09:00', reminder: true } },
    } as BeatCapture['data'],
  },
  'advanced-capture': { data: { brainDumpText: 'run daily, read more' } as BeatCapture['data'] },
  'advanced-frequency': {
    data: {
      habitConfigs: { Running: { days: [1, 3, 5], time: '07:00', reminder: true } },
    } as BeatCapture['data'],
  },
  'into-app': { data: {} },
  'weekly-projection': { data: {} },
};

interface SimulatedRow {
  current_step: number;
  data: Record<string, unknown>;
}

// The tap save path: data merge (jsonb ||) + GREATEST on current_step, with the
// fork's path column merged back into the data the live advance reads (the
// orchestrator's serverData memo does the same).
function saveToRow(row: SimulatedRow, node: FlowNode, cap: BeatCapture): SimulatedRow {
  const next: SimulatedRow = {
    current_step: node.persist ? Math.max(row.current_step, node.persist.step) : row.current_step,
    data: { ...row.data, ...(cap.data as Record<string, unknown>) },
  };
  if (cap.path) next.data.path = cap.path;
  return next;
}

/** Tap-drive the machine up to (and including entering) the branch node. */
function runToFork(): { st: FlowMachineState; row: SimulatedRow } {
  let st = initFlowMachine(flow);
  let row: SimulatedRow = { current_step: 1, data: { nickname: 'Yonas' } };
  for (let guard = 0; guard < 50; guard++) {
    const node = getNode(flow, st.currentNodeId);
    if (!node || node.type === 'branch') break;
    const cap = TAP_CAPTURE[node.componentType] ?? { data: {} };
    if (node.persist) row = saveToRow(row, node, cap);
    st = applyCapture(flow, st, cap);
  }
  return { st, row };
}

const forkNode = () => getNode(flow, 'path-fork')!;

describe('live advance at the fork — scripted run over the generated flow', () => {
  it('reaches the fork after the setup block with no path (rhythm-first order)', () => {
    const { st, row } = runToFork();
    expect(st.currentNodeId).toBe('path-fork');
    // Rhythm-first: profile (1) + the setup block (state-check 6, morning 7,
    // reflection 8) save before the fork, so the GREATEST-pinned step is 8.
    expect(row.current_step).toBe(8);
    expect(row.data.path).toBeUndefined();
  });

  it('FAIL-A: a stale current_step climb cannot traverse the unanswered fork', () => {
    const { st, row } = runToFork();
    // The leading-edge advance would replay the fork's server capture. The row
    // holds no path, so the orchestrator gate must refuse it outright...
    const cap = serverCaptureForBeat(forkNode(), row.data as OnboardingStepData);
    expect(cap.path).toBeUndefined();
    expect(captureCompletesBeat(forkNode(), cap)).toBe(false);
    // ...and even if a capture slipped through, the machine itself holds.
    let next = st;
    for (let i = 0; i < 3; i++) next = applyCapture(flow, next, cap);
    expect(next.currentNodeId).toBe('path-fork');
    expect(next.status).toBe('running');
    expect(next.visited).not.toContain('into-app');
  });

  for (const [path, laneEntry] of [
    ['simple', 'category'],
    ['braindump', 'advanced-input'],
  ] as const) {
    it(`answered fork (card tap) enters the ${path} lane at ${laneEntry}`, () => {
      const { st } = runToFork();
      const next = applyCapture(flow, st, { data: {}, path });
      expect(next.currentNodeId).toBe(laneEntry);
      expect(next.answers.path).toBe(path);
    });

    it(`answered fork (server row path, NO step climb — the Vapi case) enters ${laneEntry}`, () => {
      const { st, row } = runToFork();
      // Vapi's submit_path_choice writes the path column server-side; its
      // upsert leaves current_step untouched, so the climb detector never
      // fires. The fork must still advance off the replayed evidence alone.
      const answered = { ...row, data: { ...row.data, path } };
      expect(answered.current_step).toBe(8); // unchanged by the path write: no climb
      const cap = serverCaptureForBeat(forkNode(), answered.data as OnboardingStepData);
      expect(cap.path).toBe(path);
      expect(captureCompletesBeat(forkNode(), cap)).toBe(true);
      const next = applyCapture(flow, st, cap);
      expect(next.currentNodeId).toBe(laneEntry);
    });
  }

  it('full beginner run: stops at the fork, then visits the WHOLE lane before the merge', () => {
    const { st, row } = runToFork();
    // Hold at the unanswered fork first (the live hard stop)...
    expect(
      applyCapture(flow, st, serverCaptureForBeat(forkNode(), row.data as OnboardingStepData))
        .currentNodeId,
    ).toBe('path-fork');
    // ...then answer and tap-drive to completion.
    let cur = applyCapture(flow, st, { data: {}, path: 'simple' });
    for (let guard = 0; guard < 50 && cur.status === 'running'; guard++) {
      const node = getNode(flow, cur.currentNodeId);
      if (!node) break;
      const cap =
        node.type === 'branch'
          ? { data: {}, path: 'simple' as const }
          : (TAP_CAPTURE[node.componentType] ?? { data: {} });
      cur = applyCapture(flow, cur, cap);
    }
    expect(cur.status).toBe('complete');
    const idx = (id: string) => cur.visited.indexOf(id);
    for (const laneBeat of ['category', 'goals', 'habit-select', 'habit-schedule']) {
      expect(cur.visited, `lane beat ${laneBeat} skipped`).toContain(laneBeat);
      expect(idx(laneBeat)).toBeLessThan(idx('into-app'));
    }
    expect(cur.visited).not.toContain('advanced-input');
  });
});

describe('captureCompletesBeat — the live-advance data gate (parity with !400)', () => {
  const node = (id: string) => getNode(flow, id)!;

  it('fork: empty capture refused, path capture accepted', () => {
    expect(captureCompletesBeat(node('path-fork'), { data: {} })).toBe(false);
    expect(captureCompletesBeat(node('path-fork'), { data: {}, path: 'simple' })).toBe(true);
  });

  it('data beats: refused until the row replays their field', () => {
    expect(captureCompletesBeat(node('category'), { data: {} })).toBe(false);
    expect(captureCompletesBeat(node('category'), { data: { category: 'Health & Fitness' } })).toBe(
      true,
    );
    expect(captureCompletesBeat(node('state-check'), { data: {} })).toBe(false);
  });

  it('display beats advance freely (nothing to replay)', () => {
    // why-intro left the flow with the consolidation seed (merged into state-check).
    expect(captureCompletesBeat(node('into-app'), { data: {} })).toBe(true);
    expect(captureCompletesBeat(node('weekly-projection-blank'), { data: {} })).toBe(true);
  });
});

describe('fastForwardToNode after the hard stop (QA startAt semantics)', () => {
  it('still crosses the fork to merge-side targets via the explicit fallthrough', () => {
    const st = fastForwardToNode(flow, initFlowMachine(flow), 'into-app');
    expect(st.currentNodeId).toBe('into-app');
    expect(st.status).toBe('running');
  });

  it('lands exactly ON the branch node when targeted', () => {
    const st = fastForwardToNode(flow, initFlowMachine(flow), 'path-fork');
    expect(st.currentNodeId).toBe('path-fork');
  });
});
