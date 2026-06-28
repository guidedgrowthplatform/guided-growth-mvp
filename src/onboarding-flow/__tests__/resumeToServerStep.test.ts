import { describe, expect, it } from 'vitest';
import type { OnboardingStepData } from '@gg/shared/types';
import { initFlowMachine } from '../flowMachine';
import flowJson from '../flows/onboarding-beginner-v1.generated.json';
import type { FlowDocument } from '../types';
import { beatStep, resumeToServerStep } from '../useFlowOrchestrator';

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

  it('lands on a beat whose step is >= the saved server step', () => {
    for (let step = 1; step <= 5; step++) {
      const st = resumeToServerStep(flow, initFlowMachine(flow), step, DATA);
      const node = flow.nodes.find((n) => n.id === st.currentNodeId);
      const s = beatStep(node);
      expect(
        s === undefined || s >= step,
        `step ${step} -> ${node?.screenId} (beatStep ${s})`,
      ).toBe(true);
    }
  });
});
