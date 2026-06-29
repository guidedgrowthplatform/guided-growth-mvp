import { describe, expect, it } from 'vitest';
import type { OnboardingStepData } from '@gg/shared/types';
import { initFlowMachine } from '../flowMachine';
import flowJson from '../flows/onboarding-beginner-v1.generated.json';
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

  it('resumes to the fork at step 2', () => {
    expect(resumedScreenId(2)).toBe('ONBOARD-FORK--FORM');
  });

  it('resumes past the fork to category at step 3 (path resolves the lane)', () => {
    expect(resumedScreenId(3)).toBe('ONBOARD-BEGINNER-01');
  });

  it('without path the fork falls through to the merge node (documents the column-merge bug)', () => {
    // path lives in onboarding_states.path, not data. If the orchestrator fails
    // to merge it in, the fork capture sees no path and applyCapture routes to
    // the branch mergeNodeId (plan review) — skipping the entire lane.
    const noPath = { ...DATA, path: undefined } as unknown as OnboardingStepData;
    expect(resumedScreenId(3, noPath)).toBe('ONBOARD-BEGINNER-06');
  });

  it('resumes to goals at step 4', () => {
    expect(resumedScreenId(4)).toBe('ONBOARD-BEGINNER-02');
  });

  it('resumes to habit-select at step 5', () => {
    expect(resumedScreenId(5, FULL_DATA)).toBe('ONBOARD-BEGINNER-03');
  });

  // The tail (server steps 6-9) is where engine beatStep and the server scale
  // diverge. Before the fix these overshot to plan-review / the end beat.
  it('resumes to habit-schedule at step 6 (not the end beat)', () => {
    expect(resumedScreenId(6, FULL_DATA)).toBe('ONBOARD-BEGINNER-04');
  });

  it('resumes to plan-review at step 7', () => {
    expect(resumedScreenId(7, FULL_DATA)).toBe('ONBOARD-BEGINNER-06');
  });

  it('resumes to morning check-in at step 8', () => {
    expect(resumedScreenId(8, FULL_DATA)).toBe('ONBOARD-MORNING-SETUP');
  });

  it('resumes to reflection setup at step 9', () => {
    expect(resumedScreenId(9, FULL_DATA)).toBe('ONBOARD-BEGINNER-07');
  });

  it('lands on a beat whose ENTRY server step is >= the saved server step', () => {
    for (let step = 1; step <= 9; step++) {
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
