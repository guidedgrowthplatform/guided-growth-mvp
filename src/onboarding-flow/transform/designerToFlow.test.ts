import { describe, expect, it } from 'vitest';
import { validateFlow } from '../flowMachine';
import { onboardingBeginnerV1 } from '../flows/onboarding-beginner-v1';
import generatedJson from '../flows/onboarding-beginner-v1.generated.json';
import { loadPublishedFlow, versionTag } from '../useFlow';
import { DESIGNER_ONBOARDING_FLOW_FROM_JSON } from './designerSourceJson';
import { designerToFlowDocument } from './designerToFlow';

describe('designerToFlow no-op swap correctness', () => {
  it('the transform output matches the committed generated JSON', () => {
    // The generated JSON is the source of truth at runtime. If this fails, run
    // `npm run flow:sync` to regenerate the JSON from the current designer source.
    // NOTE: the hand-authored TS flow (onboardingBeginnerV1) is now intentionally
    // diverged from the v3 transform output -- it is a safe fallback only.
    const fresh = designerToFlowDocument(DESIGNER_ONBOARDING_FLOW_FROM_JSON);
    expect(generatedJson).toEqual(fresh);
  });

  it('the committed generated JSON is up to date with the transform', () => {
    // If this fails, run `npm run flow:sync` to regenerate the JSON.
    const fresh = designerToFlowDocument(DESIGNER_ONBOARDING_FLOW_FROM_JSON);
    expect(generatedJson).toEqual(fresh);
  });

  it('the generated flow passes graph-integrity validation', () => {
    expect(validateFlow(designerToFlowDocument(DESIGNER_ONBOARDING_FLOW_FROM_JSON))).toEqual([]);
  });

  it('skips intro beats (splash / get-started / splash-intro)', () => {
    const flow = designerToFlowDocument(DESIGNER_ONBOARDING_FLOW_FROM_JSON);
    const screenIds = flow.nodes.map((n) => n.screenId);
    expect(flow.nodes.find((n) => n.id === 'auth')).toBeDefined();
    expect(screenIds).not.toContain('SPLASH');
    expect(flow.entryNodeId).toBe('auth');
  });

  it('builds the fork as a BranchNode with both lanes merging at into-app (v3)', () => {
    const flow = designerToFlowDocument(DESIGNER_ONBOARDING_FLOW_FROM_JSON);
    const fork = flow.nodes.find((n) => n.id === 'path-fork');
    expect(fork?.type).toBe('branch');
    if (fork?.type === 'branch') {
      expect(fork.lanes.map((l) => l.value)).toEqual(['simple', 'braindump']);
      // V3: both lanes merge at into-app (plan-review dropped).
      expect(fork.mergeNodeId).toBe('into-app');
      // Advanced lane now has two nodes: capture then frequency.
      const advLane = fork.lanes.find((l) => l.value === 'braindump');
      expect(advLane?.exitNodeId).toBe('advanced-frequency');
    }
  });

  it('keeps the {name} token on the profile opener', () => {
    const flow = designerToFlowDocument(DESIGNER_ONBOARDING_FLOW_FROM_JSON);
    const profile = flow.nodes.find((n) => n.id === 'profile');
    expect(profile?.voice.openerText).toContain('{name}');
  });

  it('v3 flow has why-intro, state-check, advanced-frequency, and 5 weekly-projection nodes', () => {
    const flow = designerToFlowDocument(DESIGNER_ONBOARDING_FLOW_FROM_JSON);
    expect(flow.nodes.find((n) => n.id === 'why-intro')).toBeDefined();
    expect(flow.nodes.find((n) => n.id === 'state-check')).toBeDefined();
    expect(flow.nodes.find((n) => n.id === 'advanced-frequency')).toBeDefined();
    const projections = flow.nodes.filter((n) => n.componentType === 'weekly-projection');
    expect(projections).toHaveLength(5);
    expect(projections[0].screenId).toBe('ONBOARD-WEEKLY-PROJECTION-BLANK');
    expect(projections[4].screenId).toBe('ONBOARD-WEEKLY-PROJECTION-GAPS');
  });
});

describe('useFlow JSON load with safe fallback', () => {
  it('loadPublishedFlow returns the v3 generated flow (not the old TS fallback)', () => {
    // The runtime loader serves the generated JSON. In v3 the generated flow and the
    // hand-authored TS fallback intentionally differ; the generated JSON is the
    // canonical v3 flow and the TS file is the safe fallback only.
    const loaded = loadPublishedFlow();
    const fresh = designerToFlowDocument(DESIGNER_ONBOARDING_FLOW_FROM_JSON);
    expect(loaded).toEqual(fresh);
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
