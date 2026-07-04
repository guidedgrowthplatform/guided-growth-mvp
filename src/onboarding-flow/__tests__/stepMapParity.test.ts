import { describe, expect, it } from 'vitest';
import {
  BEAT_COMPLETING_TOOL_SCREEN,
  BEAT_COMPLETING_TOOLS,
  beatForStep,
  stepForScreenId,
} from '@/lib/onboarding/onboardingStepBeats';
import { checkAdvanceData } from '../../../api/_lib/llm/onboarding/preconditions';
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
  'path-selection': { path: 'simple' },
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

  it('checkAdvanceData gates each persist step on that beat’s own data', () => {
    // Build "all evidence" once; per beat, remove its own contribution and
    // assert the gate trips, then restore it and assert the gate passes.
    const BEGINNER_SCREENS = new Set([
      'ONBOARD-BEGINNER-01',
      'ONBOARD-BEGINNER-02',
      'ONBOARD-BEGINNER-03',
      'ONBOARD-BEGINNER-04',
    ]);
    for (const n of persistNodes) {
      const lane = ADVANCED_SCREENS.has(n.screenId) ? 'braindump' : 'simple';
      const all: Record<string, unknown> = {};
      for (const m of persistNodes) {
        if (lane === 'braindump' && BEGINNER_SCREENS.has(m.screenId)) continue;
        if (lane === 'simple' && ADVANCED_SCREENS.has(m.screenId)) continue;
        Object.assign(all, EVIDENCE[m.componentType] ?? {});
      }
      const own = EVIDENCE[n.componentType] ?? {};
      const without = { ...all };
      for (const key of Object.keys(own)) delete without[key];
      const argsBase = {
        path: lane,
        brainDumpRaw: lane === 'braindump' ? 'run daily' : null,
      };
      // goals/category double as the shared key for the two habit beats — a
      // missing own-key must trip the gate…
      const missing = checkAdvanceData({
        sourceStep: n.persist.step,
        data: without,
        ...argsBase,
        // the fork gates on the path column, not data
        ...(n.componentType === 'path-selection' ? { path: null } : {}),
        // advanced-capture gates on the brain dump column
        ...(n.componentType === 'advanced-capture' ? { brainDumpRaw: null } : {}),
      });
      expect(missing, `${n.screenId} (step ${n.persist.step}) should gate`).not.toBeNull();
      // …and the full fixture must pass.
      const passing = checkAdvanceData({ sourceStep: n.persist.step, data: all, ...argsBase });
      expect(passing, `${n.screenId} (step ${n.persist.step}) should pass`).toBeNull();
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
