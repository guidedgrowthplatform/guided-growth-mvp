import { describe, expect, it } from 'vitest';
import type { OnboardingStepData } from '@gg/shared/types';
import { applyCapture, getNode, initFlowMachine, type FlowMachineState } from '../flowMachine';
import flowJson from '../flows/onboarding-beginner-v1.generated.json';
import type { BeatCapture, FlowDocument, FlowNode } from '../types';
import { resumeFromServerRow, serverCaptureForBeat } from '../useFlowOrchestrator';

/**
 * The refresh matrix (B9/B10): simulate a real run beat by beat, maintaining the
 * server row EXACTLY as the save path writes it (data merge + GREATEST on
 * current_step), and assert a fresh machine resumes onto the beat the user was
 * on. Derived from the generated flow so a beat reorder fails here instead of
 * shipping — persist steps run 1,6,7,8,2,3,4,5,5 in V3 flow order, so the row's
 * numeric step is NOT a position and resume must be data-evidence driven.
 */
const flow = flowJson as unknown as FlowDocument;

// What each beat's card capture produces (tap path), keyed by componentType.
// Mirrors the componentRegistry adapters.
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
// fork's path column merged back into the data resume reads (the orchestrator's
// serverData memo does the same).
function saveToRow(row: SimulatedRow, node: FlowNode, cap: BeatCapture): SimulatedRow {
  const next: SimulatedRow = {
    current_step: node.persist
      ? Math.max(row.current_step, node.persist.step)
      : row.current_step,
    data: { ...row.data, ...(cap.data as Record<string, unknown>) },
  };
  if (cap.path) next.data.path = cap.path;
  return next;
}

function resumedScreenId(row: SimulatedRow): string | undefined {
  const st = resumeFromServerRow(
    flow,
    initFlowMachine(flow),
    row.current_step,
    row.data as OnboardingStepData,
  );
  return getNode(flow, st.currentNodeId)?.screenId;
}

/** Walk a full run for one path, asserting the refresh target at every beat. */
function runMatrix(path: 'simple' | 'braindump', stateCheckKey: 'checkin' | 'stateCheck') {
  let st: FlowMachineState = initFlowMachine(flow);
  // FlowOnboarding seeds the nickname at mount (saveStep(1, {nickname})).
  let row: SimulatedRow = { current_step: 1, data: { nickname: 'Yonas' } };
  const visited: { screenId: string; resumed: string | undefined }[] = [];

  for (let guard = 0; guard < 50 && st.status === 'running'; guard++) {
    const node = getNode(flow, st.currentNodeId);
    if (!node) break;
    // The user is ON this beat with the row as saved so far — a refresh here
    // must land back on it (head gates + display beats allow one-beat-back).
    visited.push({ screenId: node.screenId, resumed: resumedScreenId(row) });
    let cap: BeatCapture =
      node.type === 'branch' ? { data: {}, path } : (TAP_CAPTURE[node.componentType] ?? { data: {} });
    if (node.componentType === 'state-check' && stateCheckKey === 'stateCheck') {
      cap = { data: { stateCheck: { sleep: 3, mood: 4 } } as BeatCapture['data'] };
    }
    if (node.persist) row = saveToRow(row, node, cap);
    st = applyCapture(flow, st, cap);
  }
  return { visited, finalRow: row };
}

// Beats where landing exactly is required; the rest may land at most one
// stoppable beat earlier (display beats and the shared-field schedule beats
// carry no evidence of their own).
const EXACT = new Set([
  'ONBOARD-01--FORM',
  'ONBOARD-MORNING-SETUP',
  'ONBOARD-BEGINNER-07',
  'ONBOARD-FORK--FORM',
  'ONBOARD-BEGINNER-01',
  'ONBOARD-BEGINNER-02',
  'ONBOARD-BEGINNER-03',
  'ONBOARD-BEGINNER-04',
  'ONBOARD-ADVANCED',
  'ONBOARD-ADVANCED-FREQUENCY',
]);

// Where the conservative one-back landings are allowed to land.
const ALLOWED_FALLBACK: Record<string, string[]> = {
  'ONBOARD-AUTH--FORM': ['ONBOARD-01--FORM'], // head gates walk through on resume
  'MIC-PERMISSION': ['ONBOARD-01--FORM'],
  'ONBOARD-WHY-INTRO': ['ONBOARD-WHY-INTRO'],
  // Entering state-check leaves no trace until its save lands, so a refresh
  // there conservatively re-shows the why-intro display beat (never skips).
  'ONBOARD-STATE-CHECK': ['ONBOARD-WHY-INTRO', 'ONBOARD-STATE-CHECK'],
  'ONBOARD-COMPLETE': ['ONBOARD-BEGINNER-04', 'ONBOARD-ADVANCED-FREQUENCY'],
  'ONBOARD-WEEKLY-PROJECTION-BLANK': ['ONBOARD-BEGINNER-04', 'ONBOARD-ADVANCED-FREQUENCY'],
  'ONBOARD-WEEKLY-PROJECTION-FULL': ['ONBOARD-BEGINNER-04', 'ONBOARD-ADVANCED-FREQUENCY'],
  'ONBOARD-WEEKLY-PROJECTION-P78': ['ONBOARD-BEGINNER-04', 'ONBOARD-ADVANCED-FREQUENCY'],
  'ONBOARD-WEEKLY-PROJECTION-P36': ['ONBOARD-BEGINNER-04', 'ONBOARD-ADVANCED-FREQUENCY'],
  'ONBOARD-WEEKLY-PROJECTION-GAPS': ['ONBOARD-BEGINNER-04', 'ONBOARD-ADVANCED-FREQUENCY'],
};

describe('resumeFromServerRow — refresh matrix over a simulated run', () => {
  for (const [path, key] of [
    ['simple', 'checkin'],
    ['simple', 'stateCheck'], // voice variant: record_checkin writes stateCheck
    ['braindump', 'checkin'],
  ] as const) {
    it(`refresh at every beat lands right (${path} lane, ${key} key)`, () => {
      const { visited } = runMatrix(path, key);
      expect(visited.length).toBeGreaterThan(10);
      for (const { screenId, resumed } of visited) {
        if (EXACT.has(screenId)) {
          expect(resumed, `refresh on ${screenId}`).toBe(screenId);
        } else {
          const allowed = ALLOWED_FALLBACK[screenId] ?? [screenId];
          expect(
            allowed.includes(resumed ?? ''),
            `refresh on ${screenId} landed on ${resumed}, allowed: ${allowed.join(', ')}`,
          ).toBe(true);
        }
      }
    });
  }

  it('B9: GREATEST-pinned step 8, stuck on habit-select → habit-select, never the end', () => {
    const row: SimulatedRow = {
      current_step: 8,
      data: {
        nickname: 'Yonas',
        age: 30,
        gender: 'Male',
        checkin: { sleep: 3 },
        morningCheckin: { time: '08:00', days: [1], reminder: true },
        reflectionConfig: { time: '21:45', days: [1], reminder: true },
        path: 'simple',
        category: 'Health & Fitness',
        goals: ['Move daily'],
      },
    };
    expect(resumedScreenId(row)).toBe('ONBOARD-BEGINNER-03');
    const st = resumeFromServerRow(flow, initFlowMachine(flow), 8, row.data as OnboardingStepData);
    expect(st.status).toBe('running');
  });

  it('B10: advance_step(2) after profile does not catapult past the pre-fork beats', () => {
    const row: SimulatedRow = {
      current_step: 2,
      data: { nickname: 'Yonas', age: 30, gender: 'Male' },
    };
    expect(resumedScreenId(row)).toBe('ONBOARD-WHY-INTRO');
  });

  it('fork with no path stops AT the fork (no fall-through to the merge node)', () => {
    const row: SimulatedRow = {
      current_step: 8,
      data: {
        nickname: 'Yonas',
        gender: 'Male',
        checkin: { sleep: 3 },
        morningCheckin: { time: '08:00', days: [1], reminder: true },
        reflectionConfig: { time: '21:45', days: [1], reminder: true },
      },
    };
    expect(resumedScreenId(row)).toBe('ONBOARD-FORK--FORM');
  });

  it('numeric back-nav intent: steps 2..5 with full data stop at the entry-step beat', () => {
    const fullData = {
      nickname: 'Yonas',
      gender: 'Male',
      checkin: { sleep: 3 },
      morningCheckin: { time: '08:00', days: [1], reminder: true },
      reflectionConfig: { time: '21:45', days: [1], reminder: true },
      path: 'simple',
      category: 'Health & Fitness',
      goals: ['Move daily'],
      habitConfigs: { Walking: { days: [1], time: '08:00', reminder: true } },
    };
    const expected: Record<number, string> = {
      2: 'ONBOARD-FORK--FORM',
      3: 'ONBOARD-BEGINNER-01',
      4: 'ONBOARD-BEGINNER-02',
      5: 'ONBOARD-BEGINNER-03',
    };
    for (const [step, screen] of Object.entries(expected)) {
      expect(
        resumedScreenId({ current_step: Number(step), data: fullData }),
        `back-nav to step ${step}`,
      ).toBe(screen);
    }
  });

  it('never resumes into a completed flow', () => {
    const { finalRow } = runMatrix('simple', 'checkin');
    const st = resumeFromServerRow(
      flow,
      initFlowMachine(flow),
      finalRow.current_step,
      finalRow.data as OnboardingStepData,
    );
    expect(st.status).toBe('running');
  });
});
