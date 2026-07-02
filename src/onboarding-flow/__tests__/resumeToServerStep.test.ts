import { describe, expect, it } from 'vitest';
import type { OnboardingStepData } from '@gg/shared/types';
import { initFlowMachine } from '../flowMachine';
import flowJson from '../flows/onboarding-v1.generated.json';
import type { FlowDocument } from '../types';
import { entryServerStep, resumeToServerStep } from '../useFlowOrchestrator';

// Resume must land a refresh on the saved beat, not back at the entry node.
const flow = flowJson as unknown as FlowDocument;

const DATA = {
  nickname: 'Yonas',
  age: 25,
  gender: 'Male',
  path: 'simple',
  category: 'Eat better',
  goals: ['Eat more intentionally'],
} as unknown as OnboardingStepData;

// Tail data (habit-schedule onward) so the walk passes through the habit/plan/
// morning beats to land on the saved one.
const FULL_DATA = {
  ...DATA,
  habitConfigs: { 'No caffeine after 2 PM': { time: '09:00', days: [1, 2, 3, 4, 5] } },
  morningCheckin: { time: '08:00', days: [1, 2, 3, 4, 5], reminder: true, schedule: 'Weekday' },
  reflectionConfig: { time: '21:45', days: [1, 2, 3, 4, 5], reminder: true, schedule: 'Weekday' },
} as unknown as OnboardingStepData;

function resumedScreenId(serverStep: number, data: OnboardingStepData = DATA): string | undefined {
  const st = resumeToServerStep(flow, initFlowMachine(flow), serverStep, data);
  const node = flow.nodes.find((n) => n.id === st.currentNodeId);
  return node?.screenId;
}

describe('resumeToServerStep', () => {
  it('a fresh machine starts at the entry node (auth), not resumed', () => {
    const st = initFlowMachine(flow);
    const node = flow.nodes.find((n) => n.id === st.currentNodeId);
    expect(node?.screenId).toBe('ONBOARD-AUTH--FORM');
  });

  it('resumes to the profile beat at step 1', () => {
    expect(resumedScreenId(1)).toBe('ONBOARD-01--FORM');
  });

  // V3: why-intro, state-check, morning-checkin-setup, reflection-setup appear
  // BEFORE the fork in flow order but their persist steps are 6-8. They are
  // absent from ENTRY_SERVER_STEP so the resume walk passes through them when
  // seeking steps 2-5 (the fork and lane beats).
  it('resumes to the fork at step 2 (pre-fork v3 beats walked through)', () => {
    expect(resumedScreenId(2)).toBe('ONBOARD-FORK--FORM');
  });

  it('resumes past the fork to category at step 3 (path resolves the lane)', () => {
    expect(resumedScreenId(3)).toBe('ONBOARD-BEGINNER-01');
  });

  it('without path the fork falls through to the merge node (documents the column-merge bug)', () => {
    // path lives in onboarding_states.path, not data. If the orchestrator fails
    // to merge it in, the fork capture sees no path and applyCapture routes to
    // the branch mergeNodeId (into-app in v3). The walk continues through the
    // weekly-projection display beats until the flow reaches completion.
    const noPath = { ...DATA, path: undefined } as unknown as OnboardingStepData;
    const st = resumeToServerStep(flow, initFlowMachine(flow), 3, noPath);
    // V3: into-app -> weekly-projection x5 -> null (complete). With no path the
    // machine walks all the way through and reaches status='complete'.
    expect(st.status).toBe('complete');
  });

  it('resumes to goals at step 4', () => {
    expect(resumedScreenId(4)).toBe('ONBOARD-BEGINNER-02');
  });

  it('resumes to habit-select at step 5', () => {
    // V3: habit-select (BEGINNER-03) and habit-schedule (BEGINNER-04) both have
    // ENTRY_SERVER_STEP 5; the walk stops at the first one encountered (habit-select).
    expect(resumedScreenId(5, FULL_DATA)).toBe('ONBOARD-BEGINNER-03');
  });

  // V3 design note: steps 6-8 (state-check, morning-setup, reflection-setup) are
  // pre-fork beats. The resume walk reaches them by walking through the full flow
  // (auth -> mic -> profile -> why-intro -> state-check -> ... -> path-fork -> lanes
  // -> into-app). Since they are absent from ENTRY_SERVER_STEP, resume will not
  // stop at them in the current linear-walk model. Pre-fork beat resume is handled
  // differently: on first load the engine always starts at the entry node and walks
  // through them; they do not need to be resume targets in the table.

  it('lands on a beat whose ENTRY server step is >= the saved server step', () => {
    for (let step = 1; step <= 5; step++) {
      const st = resumeToServerStep(flow, initFlowMachine(flow), step, FULL_DATA);
      const node = flow.nodes.find((n) => n.id === st.currentNodeId);
      const s = entryServerStep(node);
      expect(
        s === undefined || s >= step,
        `step ${step} -> ${node?.screenId} (entryServerStep ${s})`,
      ).toBe(true);
    }
  });
});
