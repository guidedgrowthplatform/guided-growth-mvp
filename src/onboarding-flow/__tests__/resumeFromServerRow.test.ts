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
 * shipping. The render reconcile makes the flow rhythm-first: the setup block
 * (state-check 6, morning 7, reflection 8) runs BEFORE the fork (2) + lanes
 * (3..5), so the persist scale is NON-monotonic in flow order (1,6,7,8,2,3,4,5).
 * Resume is data-evidence driven, not numeric, so it lands correctly regardless:
 * each beat resumes onto itself off its own completion evidence, and the numeric
 * step keeps only the 2..5 back-nav window.
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
// fork's path column merged back into the data resume reads (the orchestrator's
// serverData memo does the same).
function saveToRow(row: SimulatedRow, node: FlowNode, cap: BeatCapture): SimulatedRow {
  const next: SimulatedRow = {
    current_step: node.persist ? Math.max(row.current_step, node.persist.step) : row.current_step,
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
      node.type === 'branch'
        ? { data: {}, path }
        : (TAP_CAPTURE[node.componentType] ?? { data: {} });
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
  // Rhythm-first: the setup block now runs before the fork, so state-check is a
  // normal exact-landing beat (was the post-lane merge beat under B47).
  'ONBOARD-STATE-CHECK',
  'ONBOARD-MORNING-SETUP',
  'ONBOARD-BEGINNER-07',
  // WEEKLY-SETUP is cut from onboarding (Yair ruling 2026-07-07), never visited.
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
  // R2 guard: while the row holds no beat evidence (nickname-only, the up-front
  // sign-in persist), a refresh is a FRESH start at the entry node. The old
  // expectation here (resume to profile) codified the bug that skipped the
  // welcome and mic beats for every account with a nickname.
  'ONBOARD-AUTH--FORM': ['ONBOARD-AUTH--FORM'],
  'MIC-PERMISSION': ['ONBOARD-AUTH--FORM'],
  'ONBOARD-01--FORM': ['ONBOARD-AUTH--FORM'], // visited before its save lands: still no evidence
  // Rhythm-first: the plan review (into-app / COMPLETE) and the projection
  // frames after it are persistless display beats immediately following the
  // lanes, so they carry NO server evidence. The last provable beat is the
  // lane's schedule beat (which shares its field with habit-select and cannot
  // self-prove), so a refresh there conservatively lands one back on it. Safe:
  // habitConfigs are saved, the user taps forward. (Under B47 the evidence-
  // bearing setup block sat between the lanes and into-app, so the frontier was
  // COMPLETE; the reorder moves the setup block upstream.)
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
        weeklyConfig: { day: 0 },
        path: 'simple',
        category: 'Health & Fitness',
        goals: ['Move daily'],
      },
    };
    expect(resumedScreenId(row)).toBe('ONBOARD-BEGINNER-03');
    const st = resumeFromServerRow(flow, initFlowMachine(flow), 8, row.data as OnboardingStepData);
    expect(st.status).toBe('running');
  });

  it('R2: a nickname-only row is a FRESH start, not a resume (mic/welcome must render)', () => {
    // Every real signup writes this row shape at flow mount (saveStep(1, {nickname})).
    // Pre-fix, resume walked the head gates and landed first runs on profile,
    // so the welcome and mic beats never rendered for any named account.
    const row: SimulatedRow = { current_step: 1, data: { nickname: 'Fable' } };
    const st = resumeFromServerRow(flow, initFlowMachine(flow), 1, row.data as OnboardingStepData);
    expect(getNode(flow, st.currentNodeId)?.screenId).toBe('ONBOARD-AUTH--FORM');
    expect(st.status).toBe('running');
  });

  it('R2: an entirely empty row is also a fresh start', () => {
    const st = resumeFromServerRow(flow, initFlowMachine(flow), 0, {} as OnboardingStepData);
    expect(getNode(flow, st.currentNodeId)?.screenId).toBe('ONBOARD-AUTH--FORM');
  });

  it('R2: the guard lifts the moment any beat evidence exists (profile done → state-check)', () => {
    // Rhythm-first: state-check directly follows profile, so a row proving profile
    // completion resumes onto the next unanswered beat, state-check (not the fork,
    // which now sits after the setup block).
    const row: SimulatedRow = {
      current_step: 1,
      data: { nickname: 'Fable', age: 30, gender: 'Male' },
    };
    expect(resumedScreenId(row)).toBe('ONBOARD-STATE-CHECK');
  });

  it('advance_step(2) after profile lands on the frontier, never past unseen beats', () => {
    // Only profile is answered; nothing beyond it exists in the row. Even with a
    // numeric step of 2 (the fork), resume must NOT skip the unanswered setup
    // block. It stops at the evidence frontier, state-check.
    const row: SimulatedRow = {
      current_step: 2,
      data: { nickname: 'Yonas', age: 30, gender: 'Male' },
    };
    expect(resumedScreenId(row)).toBe('ONBOARD-STATE-CHECK');
  });

  it('fork with no path stops AT the fork (no fall-through to the merge node)', () => {
    const row: SimulatedRow = {
      current_step: 8,
      data: {
        nickname: 'Yonas',
        age: 30,
        gender: 'Male',
        checkin: { sleep: 3 },
        morningCheckin: { time: '08:00', days: [1], reminder: true },
        reflectionConfig: { time: '21:45', days: [1], reminder: true },
        weeklyConfig: { day: 0 },
      },
    };
    expect(resumedScreenId(row)).toBe('ONBOARD-FORK--FORM');
  });

  it('numeric back-nav intent: steps 2..5 with full data stop at the entry-step beat', () => {
    const fullData = {
      nickname: 'Yonas',
      age: 30,
      gender: 'Male',
      checkin: { sleep: 3 },
      morningCheckin: { time: '08:00', days: [1], reminder: true },
      reflectionConfig: { time: '21:45', days: [1], reminder: true },
      weeklyConfig: { day: 0 },
      path: 'simple',
      category: 'Health & Fitness',
      goals: ['Move daily'],
      habitConfigs: { Walking: { days: [1], time: '08:00', reminder: true } },
    };
    const expected: Record<number, string> = {
      2: 'ONBOARD-FORK--FORM',
      3: 'ONBOARD-BEGINNER-01',
      4: 'ONBOARD-BEGINNER-02',
      // Step 5 is shared by habit-select AND habit-schedule. With full data and
      // no downstream evidence (the setup block is upstream in rhythm-first
      // order), the back-nav stop cannot single out habit-select, so resume
      // lands on the conservative frontier, habit-schedule (BEGINNER-04). Safe:
      // both are the habit step and habitConfigs are preserved.
      5: 'ONBOARD-BEGINNER-04',
    };
    for (const [step, screen] of Object.entries(expected)) {
      expect(
        resumedScreenId({ current_step: Number(step), data: fullData }),
        `back-nav to step ${step}`,
      ).toBe(screen);
    }
  });

  it('partial profile (gender without age) resumes AT profile, not past it', () => {
    // submit_profile saves partial fields; gender alone must not count as
    // completion evidence or a voice user who stated only gender loses the
    // age question forever on refresh.
    const st = resumeFromServerRow(flow, initFlowMachine(flow), 1, {
      nickname: 'Yair',
      gender: 'Male',
    } as never);
    expect(getNode(flow, st.currentNodeId)?.componentType).toBe('profile-input');
  });

  it('full profile (age AND gender) resumes past profile', () => {
    const st = resumeFromServerRow(flow, initFlowMachine(flow), 1, {
      nickname: 'Yair',
      age: 30,
      gender: 'Male',
    } as never);
    expect(getNode(flow, st.currentNodeId)?.componentType).not.toBe('profile-input');
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

describe('explicit morning refusal (B58 follow-up): skip marker resumes past the beat', () => {
  it('a row holding morningCheckinSkipped (no config) does not land back on the refused beat', () => {
    // Walk the beginner tap path up to the morning beat, maintaining the row
    // exactly as the save path writes it.
    let st: FlowMachineState = initFlowMachine(flow);
    let row: SimulatedRow = { current_step: 1, data: { nickname: 'Yonas' } };
    for (let guard = 0; guard < 50; guard++) {
      const node = getNode(flow, st.currentNodeId)!;
      if (node.screenId === 'ONBOARD-MORNING-SETUP') break;
      const cap: BeatCapture =
        node.type === 'branch'
          ? { data: {}, path: 'simple' }
          : (TAP_CAPTURE[node.componentType] ?? { data: {} });
      if (node.persist) row = saveToRow(row, node, cap);
      st = applyCapture(flow, st, cap);
    }
    expect(getNode(flow, st.currentNodeId)!.screenId).toBe('ONBOARD-MORNING-SETUP');

    // The refusal path persists ONLY the marker (markMorningCheckinSkipped in
    // submitMorningCheckin.ts): jsonb merge + GREATEST(current_step, 7) — no
    // config is fabricated.
    row = {
      current_step: Math.max(row.current_step, 7),
      data: { ...row.data, morningCheckinSkipped: true },
    };

    // The live machine advances off the marker (evidence arrival)...
    st = applyCapture(flow, st, { data: { morningCheckinSkipped: true } as BeatCapture['data'] });
    const after = getNode(flow, st.currentNodeId)!;
    expect(after.screenId).not.toBe('ONBOARD-MORNING-SETUP');

    // ...and a refresh lands on that SAME next beat — a refused morning
    // check-in must never pull the user back onto the beat they declined.
    expect(resumedScreenId(row)).toBe(after.screenId);
  });
});
