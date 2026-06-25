import { describe, expect, it } from 'vitest';
import { validateFlow } from '../flowMachine';
import { onboardingBeginnerV1 } from '../flows/onboarding-beginner-v1';
import generatedJson from '../flows/onboarding-beginner-v1.generated.json';
import { loadPublishedFlow, versionTag } from '../useFlow';
import { DESIGNER_ONBOARDING_FLOW } from './designerSource';
import { designerToFlowDocument } from './designerToFlow';

describe('designerToFlow no-op swap correctness', () => {
  it('the transform reproduces the hand-authored TS flow exactly', () => {
    // The proof that the data swap is a no-op: transforming the designer source of
    // truth yields the SAME document the engine ran by hand. Any future designer
    // change that unintentionally diverges from the TS flow trips this test.
    const generated = designerToFlowDocument(DESIGNER_ONBOARDING_FLOW);
    expect(generated).toEqual(onboardingBeginnerV1);
  });

  it('the committed generated JSON is up to date with the transform', () => {
    // If this fails, run `npm run flow:sync` to regenerate the JSON.
    const fresh = designerToFlowDocument(DESIGNER_ONBOARDING_FLOW);
    expect(generatedJson).toEqual(fresh);
  });

  it('the generated flow passes graph-integrity validation', () => {
    expect(validateFlow(designerToFlowDocument(DESIGNER_ONBOARDING_FLOW))).toEqual([]);
  });

  it('skips intro beats (splash / get-started / splash-intro)', () => {
    const flow = designerToFlowDocument(DESIGNER_ONBOARDING_FLOW);
    const screenIds = flow.nodes.map((n) => n.screenId);
    expect(flow.nodes.find((n) => n.id === 'auth')).toBeDefined();
    expect(screenIds).not.toContain('SPLASH');
    expect(flow.entryNodeId).toBe('auth');
  });

  it('builds the fork as a BranchNode with both lanes', () => {
    const flow = designerToFlowDocument(DESIGNER_ONBOARDING_FLOW);
    const fork = flow.nodes.find((n) => n.id === 'path-fork');
    expect(fork?.type).toBe('branch');
    if (fork?.type === 'branch') {
      expect(fork.lanes.map((l) => l.value)).toEqual(['simple', 'braindump']);
      expect(fork.mergeNodeId).toBe('plan-review');
    }
  });

  it('keeps the {name} token on the profile opener', () => {
    const flow = designerToFlowDocument(DESIGNER_ONBOARDING_FLOW);
    const profile = flow.nodes.find((n) => n.id === 'profile');
    expect(profile?.voice.openerText).toContain('{name}');
  });
});

describe('useFlow JSON load with safe fallback', () => {
  it('loadPublishedFlow returns a flow that deep-equals the proven TS flow', () => {
    // The runtime loader serves the generated JSON; it must match the TS flow.
    expect(loadPublishedFlow()).toEqual(onboardingBeginnerV1);
  });

  it('the loaded flow validates clean (the engine never serves a broken flow)', () => {
    expect(validateFlow(loadPublishedFlow())).toEqual([]);
  });

  it('an unknown pin tag falls through to the latest published flow', () => {
    expect(loadPublishedFlow('does-not-exist@v99')).toEqual(loadPublishedFlow());
  });

  it('the version tag is stable', () => {
    expect(versionTag(loadPublishedFlow())).toBe('onboarding-beginner-v1@v1');
  });
});
