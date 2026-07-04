/**
 * L1-1 boundary validation: a malformed builder Export or a broken transform
 * output must fail LOUD with the offending path named, never silently drop
 * beats or ship a flow the resume machinery cannot walk.
 */
import { describe, expect, it } from 'vitest';
import { validateFlowAuthoring } from '../flowMachine';
import designerSourceJson from '../flows/designer-source.json';
import type { BeatNode, FlowDocument } from '../types';
import { DESIGNER_ONBOARDING_FLOW_FROM_JSON, parseExportDocument } from './designerSourceJson';
import { designerToFlowDocument } from './designerToFlow';

type MutableExport = {
  flowId?: string;
  beats: Array<Record<string, unknown> & { meta?: Record<string, unknown> }>;
} & Record<string, unknown>;

const cloneExport = (): MutableExport =>
  structuredClone(designerSourceJson) as unknown as MutableExport;

describe('parseExportDocument (builder Export boundary)', () => {
  it('accepts the committed designer-source.json', () => {
    expect(() => parseExportDocument(designerSourceJson)).not.toThrow();
    expect(parseExportDocument(designerSourceJson).beats.length).toBeGreaterThan(0);
  });

  it('fails loud on an unknown top-level field, naming it', () => {
    const doc = cloneExport();
    doc.publishedBy = 'nobody';
    expect(() => parseExportDocument(doc)).toThrow(/publishedBy/);
  });

  it('fails loud on an unknown beat field, naming the path', () => {
    const doc = cloneExport();
    doc.beats[2].coachLien = 'typo of coachLine';
    expect(() => parseExportDocument(doc)).toThrow(/beats\.2.*coachLien|coachLien/s);
  });

  it('fails loud on an unknown meta field, naming the path', () => {
    const doc = cloneExport();
    doc.beats[5].meta = { ...doc.beats[5].meta, voiceEngin: 'mp3' };
    expect(() => parseExportDocument(doc)).toThrow(/beats\.5\.meta.*voiceEngin|voiceEngin/s);
  });

  it('fails loud on a missing componentType', () => {
    const doc = cloneExport();
    delete doc.beats[3].componentType;
    expect(() => parseExportDocument(doc)).toThrow(/beats\.3\.componentType/);
  });

  it('fails loud on a missing meta block', () => {
    const doc = cloneExport();
    delete doc.beats[4].meta;
    expect(() => parseExportDocument(doc)).toThrow(/beats\.4\.meta/);
  });

  it('fails loud on a wrongly-typed engine field', () => {
    const doc = cloneExport();
    doc.beats[6].meta = { ...doc.beats[6].meta, engine: { pathField: 'yes' } };
    expect(() => parseExportDocument(doc)).toThrow(/engine\.pathField/);
  });
});

describe('designerToFlowDocument (unrecognized designer types)', () => {
  it('throws on a designer type absent from TYPE_TO_COMPONENT instead of dropping the beat', () => {
    const flow = structuredClone(DESIGNER_ONBOARDING_FLOW_FROM_JSON);
    flow[3].type = 'bogus-card';
    expect(() => designerToFlowDocument(flow)).toThrow(
      /unrecognized designer componentType "bogus-card"/,
    );
  });

  it('still skips the deliberately null-mapped types (qa-control, splash)', () => {
    expect(() => designerToFlowDocument(DESIGNER_ONBOARDING_FLOW_FROM_JSON)).not.toThrow();
  });
});

describe('validateFlowAuthoring (post-transform invariants)', () => {
  const generated = (): FlowDocument => designerToFlowDocument(DESIGNER_ONBOARDING_FLOW_FROM_JSON);

  it('passes the real generated flow (non-monotonic-by-design steps included)', () => {
    expect(validateFlowAuthoring(generated())).toEqual([]);
  });

  it('flags a node missing runtime meta', () => {
    const flow = generated();
    delete (flow.nodes.find((n) => n.id === 'goals') as BeatNode).meta;
    expect(validateFlowAuthoring(flow)).toEqual([
      expect.stringMatching(/goals\.meta -> missing runtime meta/),
    ]);
  });

  it('flags non-monotonic persist steps inside a lane', () => {
    const flow = generated();
    // Beginner lane runs 3,4,5,5; demoting goals to step 2 breaks the back-nav window.
    (flow.nodes.find((n) => n.id === 'goals') as BeatNode).persist = { step: 2 };
    const problems = validateFlowAuthoring(flow);
    expect(problems.some((p) => /not monotonic in lane "simple".*"goals"/s.test(p))).toBe(true);
  });

  it('flags a persist step recurring after other steps intervened', () => {
    const flow = generated();
    // Reusing profile's step 1 on habit-schedule corrupts step-as-identity resume.
    (flow.nodes.find((n) => n.id === 'habit-schedule') as BeatNode).persist = { step: 1 };
    const problems = validateFlowAuthoring(flow);
    expect(problems.some((p) => /persist\.step 1 recurs at "habit-schedule"/.test(p))).toBe(true);
  });

  it('allows the deliberate adjacent duplicate (habit-select + habit-schedule share step 5)', () => {
    const flow = generated();
    const select = flow.nodes.find((n) => n.id === 'habit-select') as BeatNode;
    const schedule = flow.nodes.find((n) => n.id === 'habit-schedule') as BeatNode;
    expect(select.persist?.step).toBe(5);
    expect(schedule.persist?.step).toBe(5);
    expect(validateFlowAuthoring(flow)).toEqual([]);
  });
});
