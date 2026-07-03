/**
 * L1-5 items 2+3: fork passes are conditional (linear flows route to the linear
 * builder) and the check-in components transform from authored Exports with NO
 * onboarding spec leakage. Equivalence proof: each authored Export produces the
 * hand-authored FlowDocument node-for-node (minus the meta block the linear
 * transform adds; the hand defs never carried one).
 */
import { describe, expect, it } from 'vitest';
import { validateFlow, validateFlowAuthoring } from '../flowMachine';
import { eveningCheckinV1, morningCheckinV1 } from '../flows/__fixtures__/checkin-flows-v1';
import eveningExportJson from '../flows/designer-source.evening-checkin.json';
import morningExportJson from '../flows/designer-source.morning-checkin.json';
import type { FlowDocument } from '../types';
import { designerBeatsFromExport, parseExportDocument } from './designerSourceJson';
import { designerToFlowDocument, designerToLinearFlowDocument } from './designerToFlow';

function transformExport(raw: unknown): FlowDocument {
  const doc = parseExportDocument(raw);
  return designerToFlowDocument(designerBeatsFromExport(doc), {
    flowId: doc.flowId,
    ...(doc.name ? { name: doc.name } : {}),
    ...(doc.version != null ? { version: doc.version } : {}),
    ...(doc.publishedAt ? { publishedAt: doc.publishedAt } : {}),
  });
}

function withoutMeta(flow: FlowDocument): FlowDocument {
  return {
    ...flow,
    nodes: flow.nodes.map((node) => {
      const { meta: _meta, ...rest } = node;
      return rest as FlowDocument['nodes'][number];
    }),
  };
}

describe('linear transform: check-in Exports reproduce the hand-authored flows', () => {
  it('morning check-in Export -> morningCheckinV1 (node-for-node, minus added meta)', () => {
    const flow = transformExport(morningExportJson);
    expect(withoutMeta(flow)).toEqual(morningCheckinV1);
    for (const node of flow.nodes) expect(node.meta, node.id).toBeDefined();
  });

  it('evening check-in Export -> eveningCheckinV1 (node-for-node, minus added meta)', () => {
    const flow = transformExport(eveningExportJson);
    expect(withoutMeta(flow)).toEqual(eveningCheckinV1);
  });

  it('generated check-in flows pass authoring validation (graph + meta + persist)', () => {
    expect(validateFlowAuthoring(transformExport(morningExportJson))).toEqual([]);
    expect(validateFlowAuthoring(transformExport(eveningExportJson))).toEqual([]);
  });

  it('no onboarding spec leakage: check-in state-check has no persist and index beatNumbers', () => {
    const flow = transformExport(morningExportJson);
    const beats = flow.nodes.filter((n) => n.type === 'beat');
    const state = beats.find((n) => n.componentType === 'state-check');
    // Onboarding's state-check spec carries persist step 6 / backId why-intro.
    expect(state?.persist).toBeNull();
    expect(state?.backId).toBe('morning-greeting');
    expect(beats.map((n) => n.beatNumber)).toEqual([0, 1, 2, 3]);
  });
});

describe('linear transform: fail-loud boundaries', () => {
  const morningBeats = () => designerBeatsFromExport(parseExportDocument(morningExportJson));

  it('requires a flowId (no onboarding default leaks onto a linear flow)', () => {
    expect(() => designerToLinearFlowDocument(morningBeats())).toThrow(/flowId is required/);
  });

  it('requires a sheetStage screen id on every linear beat', () => {
    const beats = morningBeats();
    delete beats[1].sheetStage;
    expect(() => designerToLinearFlowDocument(beats, { flowId: 'morning-checkin-v1' })).toThrow(
      /needs a "SCREEN-ID: Name" sheetStage/,
    );
  });

  it('rejects duplicate node ids', () => {
    const beats = morningBeats();
    beats[2].meta = { engine: { nodeId: 'morning-greeting' } };
    expect(() => designerToLinearFlowDocument(beats, { flowId: 'morning-checkin-v1' })).toThrow(
      /duplicate node id/,
    );
  });

  it('still validates as a walkable linear graph', () => {
    const flow = designerToLinearFlowDocument(morningBeats(), { flowId: 'morning-checkin-v1' });
    expect(validateFlow(flow)).toEqual([]);
    expect(flow.entryNodeId).toBe('morning-greeting');
    const last = flow.nodes.at(-1);
    expect(last?.type === 'beat' ? last.nextId : 'not-a-beat').toBeNull();
  });
});
