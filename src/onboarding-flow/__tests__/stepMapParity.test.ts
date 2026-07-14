import { describe, expect, it } from 'vitest';
import {
  BEAT_COMPLETING_TOOL_SCREEN,
  BEAT_COMPLETING_TOOLS,
  beatForStep,
  stepForScreenId,
} from '@/lib/onboarding/onboardingStepBeats';
import { checkAdvanceData } from '../../../api/_lib/llm/onboarding/preconditions';
import {
  ADVANCE_GATE_OWNERS,
  STEP_OWNERS,
} from '../../../api/_lib/llm/onboarding/stepMaps.generated';
import { ONBOARDING_TOOL_ADDENDUM } from '../../../api/_lib/llm/onboarding/systemPromptAddendum';
import flowJson from '../flows/onboarding-beginner-v1.generated.json';
import type { FlowDocument, FlowNode } from '../types';

/**
 * Locks every step map to the generated flow, so the next beat reorder or step
 * renumber fails HERE instead of shipping as a resume/advance bug. The maps
 * drifted apart originally because each was hand-maintained against a flow
 * that changed under them (V3 moved state-check/morning/reflection before the
 * fork while keeping persist steps 6-8).
 */
const flow = flowJson as unknown as FlowDocument;
const persistNodes = flow.nodes.filter((n): n is FlowNode & { persist: { step: number } } =>
  Boolean(n.persist),
);

const ADVANCED_SCREENS = new Set(['ONBOARD-ADVANCED', 'ONBOARD-ADVANCED-FREQUENCY']);

// The data each beat's save contributes, keyed by componentType — used to build
// "everything before beat X is saved" fixtures for the advance-gate parity.
const EVIDENCE: Record<string, Record<string, unknown>> = {
  'profile-input': { age: 30, gender: 'Male' },
  'state-check': { stateCheck: { sleep: 3 } },
  'morning-checkin-setup': { morningCheckin: { time: '08:00', days: [1], reminder: true } },
  'reflection-card': { reflectionConfig: { time: '21:45', days: [1], reminder: true } },
  'weekly-day-picker': { weeklyConfig: { day: 0 } },
  // Fork gates on the top-level path COLUMN (checkAdvanceData's `path` arg), not
  // on data.path — so this evidence carries no data key. Leaving a data.path here
  // would wrongly force the beginner lane on the braindump run (canonical-first read).
  'path-selection': {},
  'category-grid': { category: 'Health & Fitness' },
  'goals-list': { goals: ['Move daily'] },
  'habit-picker': { habitConfigs: { Walking: { days: [1], time: '08:00', reminder: true } } },
  'habit-schedule': { habitConfigs: { Walking: { days: [1, 2], time: '09:00', reminder: true } } },
  'advanced-capture': { brainDumpText: 'run daily' },
  'advanced-frequency': {
    habitConfigs: { Running: { days: [1], time: '07:00', reminder: true } },
  },
};

describe('step map parity with the generated flow', () => {
  it('SCREEN_TO_STEP matches every persist beat', () => {
    for (const n of persistNodes) {
      expect(stepForScreenId(n.screenId), n.screenId).toBe(n.persist.step);
    }
  });

  it('BEAT_COMPLETING_TOOL_SCREEN matches each completing tool to its own beat', () => {
    for (const n of flow.nodes) {
      const tool = n.tool?.toolName;
      if (!tool || !BEAT_COMPLETING_TOOLS.has(tool)) continue;
      expect(BEAT_COMPLETING_TOOL_SCREEN[tool], `${tool} on ${n.screenId}`).toBe(n.screenId);
    }
    for (const tool of BEAT_COMPLETING_TOOLS) {
      expect(BEAT_COMPLETING_TOOL_SCREEN[tool], `${tool} has no beat screen`).toBeDefined();
    }
  });

  it('beatForStep round-trips every persist beat (habit-schedule shares 5 with habit-select)', () => {
    for (const n of persistNodes) {
      const lane = ADVANCED_SCREENS.has(n.screenId) ? 'braindump' : 'simple';
      const beat = beatForStep(n.persist.step, lane);
      expect(beat.step, n.screenId).toBe(n.persist.step);
      const sameStepScreens = persistNodes
        .filter(
          (m) =>
            m.persist.step === n.persist.step &&
            ADVANCED_SCREENS.has(m.screenId) === ADVANCED_SCREENS.has(n.screenId),
        )
        .map((m) => m.screenId);
      expect(sameStepScreens, `${n.screenId} step ${n.persist.step}`).toContain(beat.screenId);
    }
  });

  it('checkAdvanceData gates each stored step on the beat being LEFT there (B50)', () => {
    // Build "all evidence" once; per gated step, remove the gate owner's own
    // contribution and assert the gate trips, then restore it and assert the
    // gate passes. The owner of a forward advance at a stored step is the
    // ADVANCE_GATE_OWNERS entry (the beat being left on the one-ahead display
    // scale), falling back to the STEP_OWNERS identity where no window beat
    // displays there — the same resolution checkAdvanceData applies. Keying
    // this test on each node's own persist step conflated the two scales and
    // locked in the B50 deadlock (state-check data demanded to LEAVE
    // habit-schedule).
    const BEGINNER_SCREENS = new Set([
      'ONBOARD-BEGINNER-01',
      'ONBOARD-BEGINNER-02',
      'ONBOARD-BEGINNER-03',
      'ONBOARD-BEGINNER-04',
    ]);
    const gatedSteps = new Set<number>([
      ...Object.keys(ADVANCE_GATE_OWNERS).map(Number),
      ...Object.keys(STEP_OWNERS).map(Number),
    ]);
    for (const lane of ['simple', 'braindump'] as const) {
      const all: Record<string, unknown> = {};
      for (const m of persistNodes) {
        if (lane === 'braindump' && BEGINNER_SCREENS.has(m.screenId)) continue;
        if (lane === 'simple' && ADVANCED_SCREENS.has(m.screenId)) continue;
        Object.assign(all, EVIDENCE[m.componentType] ?? {});
      }
      for (const step of [...gatedSteps].sort((a, b) => a - b)) {
        const identity = STEP_OWNERS[step];
        const component =
          ADVANCE_GATE_OWNERS[step]?.[lane] ??
          (lane === 'braindump'
            ? (identity?.braindump ?? identity?.simple)
            : (identity?.simple ?? identity?.braindump));
        if (!component) continue;
        const own = EVIDENCE[component] ?? {};
        const without = { ...all };
        for (const key of Object.keys(own)) delete without[key];
        const argsBase = {
          path: lane as string,
          brainDumpRaw: lane === 'braindump' ? 'run daily' : null,
        };
        // a missing own-key must trip the gate…
        const missing = checkAdvanceData({
          sourceStep: step,
          data: without,
          ...argsBase,
          // the fork gates on the path column, not data
          ...(component === 'path-selection' ? { path: null } : {}),
          // advanced-capture gates on the brain dump column
          ...(component === 'advanced-capture' ? { brainDumpRaw: null } : {}),
        });
        expect(missing, `${component} (${lane}, stored step ${step}) should gate`).not.toBeNull();
        // …and the full fixture must pass.
        const passing = checkAdvanceData({ sourceStep: step, data: all, ...argsBase });
        expect(passing, `${component} (${lane}, stored step ${step}) should pass`).toBeNull();
      }
    }
  });

  it('the addendum ladder names only steps that exist on the V3 scale', () => {
    // The prompt teaches target_step per screen: profile(1)→2 … habit-schedule(6)→7.
    // It must never resurrect the retired old tail (morning(8)→9, reflection(9)→10).
    expect(ONBOARDING_TOOL_ADDENDUM).not.toMatch(/morning\(8\)|reflection\(9\)|plan-review\(7\)/);
    // The four self-advancing beats must be named as such.
    for (const screen of [
      'ONBOARD-STATE-CHECK',
      'ONBOARD-MORNING-SETUP',
      'ONBOARD-BEGINNER-07',
      'ONBOARD-WEEKLY-SETUP',
    ]) {
      expect(ONBOARDING_TOOL_ADDENDUM).toContain(screen);
    }
  });
});
