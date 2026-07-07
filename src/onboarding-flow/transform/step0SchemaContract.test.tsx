/** @vitest-environment jsdom */
/**
 * STEP-0 schema contract (onboarding-consolidation-plan-2026-07-06, Lane A).
 *
 * Locks the extended flow-document contract: narration[] bubble/reveal segments
 * with per-line clip refs, the render-time `variant` art switch, `hideOrb`,
 * `componentOwned`, and the two new componentTypes (custom-entry kind goal|habit,
 * weekly-projection state blank|full|p78|p36|gaps). Each new kind round-trips
 * designer-source JSON -> parse -> transform -> generated nodes -> renderer
 * adapter without hand edits. Backward compatibility (pre-STEP-0 flows emit
 * byte-identical JSON) is locked by designerToFlow.test.ts's generated-JSON
 * equality tests, which must stay green alongside this file.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { validateFlow } from '../flowMachine';
import eveningCheckinJson from '../flows/designer-source.evening-checkin.json';
import homeTourJson from '../flows/designer-source.home-tour.json';
import morningCheckinJson from '../flows/designer-source.morning-checkin.json';
import weeklyCheckinJson from '../flows/designer-source.weekly-checkin.json';
import { getAdapter } from '../renderer/componentRegistry';
import type { BeatCapture, BeatNode, FlowNode, NarrationSegment } from '../types';
import {
  DESIGNER_ONBOARDING_FLOW_FROM_JSON,
  designerBeatsFromExport,
  parseExportDocument,
} from './designerSourceJson';
import { designerToFlowDocument } from './designerToFlow';

/* ----------------------------------------------------- sample designer source */

// A linear sample Export carrying every STEP-0 field, exactly as Lane B's
// converter will author them (narration normalized to {kind, n, say?, clip?}).
const SAMPLE_EXPORT = {
  flowId: 'step0-schema-sample',
  beats: [
    {
      beat: '1',
      name: 'Create your own goal',
      componentType: 'custom-entry',
      sheetStage: 'ONBOARD-BEGINNER-02-CUSTOM: Create Goal',
      props: {
        kind: 'goal',
        coachLine: "Tell me the goal you want to add, and I'll set it up.",
        title: 'Your goal',
        placeholder: 'For example, sleep more consistently',
        addLabel: 'Add goal',
      },
      meta: { engine: { nodeId: 'goal-custom' } },
      hideOrb: false,
      narration: [
        { kind: 'bubble', n: 1, say: "Tell me the goal you want to add, and I'll set it up." },
      ],
    },
    {
      beat: '2',
      name: 'Weekly projection (most likely)',
      componentType: 'weekly-projection',
      sheetStage: 'ONBOARD-WEEKLY-PROJECTION-P78: Weekly Projection P78',
      // 'female' is a render-time art variant and must flow through to the node.
      variant: 'female',
      props: {
        state: 'p78',
        coachLine: 'Most likely your week looks somewhere around here.',
      },
      meta: { engine: { nodeId: 'weekly-p78-sample' } },
      componentOwned: false,
      narration: [
        {
          kind: 'bubble',
          n: 1,
          say: 'Most likely your week looks somewhere around here.',
          clip: 'onboard_weekly_projection_p78_1',
        },
        { kind: 'reveal', n: 1 },
      ],
    },
    {
      beat: '3',
      name: 'Advanced capture (close sample)',
      componentType: 'advanced-capture',
      sheetStage: 'ONBOARD-ADVANCED: Brain Dump',
      props: {
        coachLine: 'Read me the list of the habits that you already track.',
      },
      meta: {
        engine: { nodeId: 'advanced-close-sample' },
        mp3Assets: [
          {
            id: 'close',
            label: 'ONBOARD-ADVANCED close',
            file: '/voice/ob/close.wav',
            transcript: 'Those are all in, and I marked each as build or break.',
            timing: 'close',
          },
        ],
      },
      narration: [
        {
          kind: 'bubble',
          n: 1,
          say: 'Read me the list of the habits that you already track.',
          clip: 'onboard_advanced_1',
        },
        { kind: 'reveal', n: 99 },
        {
          kind: 'close',
          n: 1,
          say: 'Those are all in, and I marked each as build or break.',
          clip: 'close',
        },
      ],
    },
    {
      beat: '4',
      name: 'Component-owned sample',
      componentType: 'mic-permission',
      // 'qa' is a builder visibility tag, NOT a render variant; it must be
      // filtered out of the generated node.
      variant: 'qa',
      sheetStage: 'MIC-PERMISSION: Mic Permission',
      props: { coachLine: "I'd love to actually talk with you." },
      meta: {
        engine: { nodeId: 'mic-sample' },
        perElement: [
          { elementId: 'allow', line: 'Allow microphone', order: 1, clip: 'mic_permission_1' },
        ],
      },
      hideOrb: true,
      componentOwned: true,
    },
  ],
};

const sampleFlow = () =>
  designerToFlowDocument(designerBeatsFromExport(parseExportDocument(SAMPLE_EXPORT)), {
    flowId: 'step0-schema-sample',
  });

/* ------------------------------------------------------------- parse + types */

describe('STEP-0: Export parse', () => {
  it('accepts narration, variant, hideOrb, componentOwned, per-element clip', () => {
    expect(() => parseExportDocument(SAMPLE_EXPORT)).not.toThrow();
  });

  it('rejects unknown narration keys loud (strict schema)', () => {
    const bad = JSON.parse(JSON.stringify(SAMPLE_EXPORT));
    bad.beats[0].narration[0].oops = true;
    expect(() => parseExportDocument(bad)).toThrow(/narration/);
  });

  it('rejects a narration kind outside bubble|reveal|close', () => {
    const bad = JSON.parse(JSON.stringify(SAMPLE_EXPORT));
    bad.beats[0].narration[0].kind = 'card';
    expect(() => parseExportDocument(bad)).toThrow();
  });

  it('accepts the close segment kind and the close mp3Assets timing slot', () => {
    const doc = parseExportDocument(SAMPLE_EXPORT);
    const adv = doc.beats.find((b) => b.name === 'Advanced capture (close sample)');
    expect(adv?.narration?.[2]).toEqual({
      kind: 'close',
      n: 1,
      say: 'Those are all in, and I marked each as build or break.',
      clip: 'close',
    });
    expect(adv?.meta.mp3Assets?.[0].timing).toBe('close');
  });
});

/* -------------------------------------------------------- transform round-trip */

describe('STEP-0: transform carries the contract onto generated nodes', () => {
  it('linear flow: custom-entry and weekly-projection nodes round-trip', () => {
    const flow = sampleFlow();
    expect(validateFlow(flow)).toEqual([]);

    const goal = flow.nodes.find((n) => n.id === 'goal-custom') as BeatNode;
    expect(goal).toBeDefined();
    expect(goal.componentType).toBe('custom-entry');
    expect(goal.componentProps.kind).toBe('goal');
    expect(goal.narration).toEqual<NarrationSegment[]>([
      { kind: 'bubble', n: 1, say: "Tell me the goal you want to add, and I'll set it up." },
    ]);
    expect(goal.hideOrb).toBe(false);

    const proj = flow.nodes.find((n) => n.id === 'weekly-p78-sample') as BeatNode;
    expect(proj).toBeDefined();
    expect(proj.componentType).toBe('weekly-projection');
    expect(proj.componentProps.state).toBe('p78');
    expect(proj.variant).toBe('female');
    expect(proj.componentOwned).toBe(false);
    expect(proj.narration).toHaveLength(2);
    expect(proj.narration?.[0].clip).toBe('onboard_weekly_projection_p78_1');
    expect(proj.narration?.[1]).toEqual({ kind: 'reveal', n: 1 });

    // Close segment (the advanced-capture closeCoachLine shape) round-trips
    // onto the node, alongside its close-timed mp3Assets entry.
    const adv = flow.nodes.find((n) => n.id === 'advanced-close-sample') as BeatNode;
    expect(adv).toBeDefined();
    expect(adv.narration?.[2]).toEqual({
      kind: 'close',
      n: 1,
      say: 'Those are all in, and I marked each as build or break.',
      clip: 'close',
    });
    expect(adv.meta?.voiceOut.mp3Assets?.[0].timing).toBe('close');
  });

  it('hideOrb + componentOwned flow through; builder visibility variants do not', () => {
    const flow = sampleFlow();
    const mic = flow.nodes.find((n) => n.id === 'mic-sample') as BeatNode;
    expect(mic.hideOrb).toBe(true);
    expect(mic.componentOwned).toBe(true);
    // 'qa' is a builder view tag, not a render variant.
    expect(mic.variant).toBeUndefined();
  });

  it('beats without STEP-0 fields gain NO new keys (backward compatibility)', () => {
    // The onboarding doc authors STEP-0 fields since the consolidation seed
    // (2026-07-06), so the no-invention probe runs over the linear flows, which
    // stay pre-STEP-0 authored. The transform must never invent the fields.
    for (const raw of [morningCheckinJson, eveningCheckinJson, homeTourJson, weeklyCheckinJson]) {
      const doc = parseExportDocument(raw);
      const flow = designerToFlowDocument(designerBeatsFromExport(doc), { flowId: doc.flowId });
      for (const node of flow.nodes) {
        expect('narration' in node, `${doc.flowId}/${node.id} gained narration`).toBe(false);
        expect('variant' in node, `${doc.flowId}/${node.id} gained variant`).toBe(false);
        expect('hideOrb' in node, `${doc.flowId}/${node.id} gained hideOrb`).toBe(false);
        expect('componentOwned' in node, `${doc.flowId}/${node.id} gained componentOwned`).toBe(
          false,
        );
      }
    }
  });

  it('forked onboarding flow: custom-entry beats become detour nodes, graph stays valid', () => {
    // The seeded onboarding doc ships its own custom-entry beats; strip them so
    // the fixture pair below defines the expectations without id collisions.
    const withCustom = [
      ...DESIGNER_ONBOARDING_FLOW_FROM_JSON.filter((b) => b.type !== 'custom-entry'),
      {
        type: 'custom-entry',
        beat: '90',
        name: 'Create your own goal',
        sheetStage: 'ONBOARD-BEGINNER-02-CUSTOM: Create Goal',
        props: { kind: 'goal', coachLine: 'Tell me the goal you want to add.' },
        meta: { engine: { nodeId: 'goal-custom', backId: 'goals' } },
      },
      {
        type: 'custom-entry',
        beat: '91',
        name: 'Create your own habit',
        sheetStage: 'ONBOARD-BEGINNER-03-CUSTOM: Create Habit',
        props: { kind: 'habit', coachLine: 'Tell me the habit you want to add.' },
        meta: { engine: { nodeId: 'habit-custom', backId: 'habit-select' } },
      },
    ];
    const flow = designerToFlowDocument(withCustom);
    expect(validateFlow(flow)).toEqual([]);

    const detours = flow.nodes.filter((n) => n.componentType === 'custom-entry') as BeatNode[];
    expect(detours.map((n) => n.id)).toEqual(['goal-custom', 'habit-custom']);
    for (const d of detours) {
      expect(d.nextId).toBeNull(); // detours never advance the spine
      expect(d.persist).toBeNull();
    }
    expect(detours[0].backId).toBe('goals');
    expect(detours[1].backId).toBe('habit-select');
    // No detour node leaks into any nextId chain.
    const chained = new Set(
      flow.nodes.flatMap((n) => (n.type === 'beat' && n.nextId ? [n.nextId] : [])),
    );
    expect(chained.has('goal-custom')).toBe(false);
    expect(chained.has('habit-custom')).toBe(false);
  });
});

/* --------------------------------------------------------- renderer round-trip */

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('STEP-0: renderer mounts the new kinds from generated nodes', () => {
  it('custom-entry (kind goal): type a name, add, capture merges into goals', () => {
    const flow = sampleFlow();
    const node = flow.nodes.find((n) => n.id === 'goal-custom') as FlowNode;
    const Adapter = getAdapter('custom-entry')!;
    expect(Adapter).toBeDefined();

    const captures: BeatCapture[] = [];
    act(() => {
      root.render(
        <Adapter
          node={node}
          answers={{ goals: ['Sleep better'] }}
          onCapture={(c) => captures.push(c)}
        />,
      );
    });

    const input = container.querySelector('input') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.placeholder).toBe('For example, sleep more consistently');
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setter.call(input, 'Wind down by 11pm');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const button = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Add goal',
    ) as HTMLButtonElement;
    expect(button).toBeTruthy();
    expect(button.disabled).toBe(false);
    act(() => button.click());

    expect(captures).toHaveLength(1);
    expect(captures[0].data.goals).toEqual(['Sleep better', 'Wind down by 11pm']);
  });

  it('weekly-projection (state p78) mounts from the generated node', () => {
    const flow = sampleFlow();
    const node = flow.nodes.find((n) => n.id === 'weekly-p78-sample') as FlowNode;
    const Adapter = getAdapter('weekly-projection')!;
    expect(Adapter).toBeDefined();
    // W3-B: the morning ritual row only renders when morningCheckin was
    // actually saved (server truth) — pass a realistic saved config here so
    // this test still proves the generated node mounts and renders all three
    // ritual rows, not just two.
    act(() => {
      root.render(
        <Adapter
          node={node}
          answers={{
            morningCheckin: {
              time: '08:00',
              days: [1, 2, 3, 4, 5],
              reminder: true,
              schedule: 'Weekday',
            },
          }}
          onCapture={() => {}}
        />,
      );
    });
    // The real projection grid renders its ritual rows (A2).
    expect(container.textContent).toContain('Morning state check-in');
  });
});
