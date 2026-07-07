/**
 * L1-3: the step maps are DERIVED from the flow document. Locks (1) cutover
 * equivalence with the retired hand tables, (2) the committed api module to the
 * flow (a designer edit without flow:sync fails here), (3) the no-hand-edit
 * property: mutate the flow, every derived map follows.
 */
import { describe, expect, it } from 'vitest';
import {
  ADVANCE_GATE_OWNERS,
  ADVANCE_LADDER,
  MAX_STEP,
  SELF_ADVANCING_SCREENS,
  STEP_OWNERS,
} from '../../../api/_lib/llm/onboarding/stepMaps.generated';
import { ONBOARDING_TOOL_ADDENDUM } from '../../../api/_lib/llm/onboarding/systemPromptAddendum';
import flowJson from '../flows/onboarding-beginner-v1.generated.json';
import type { BeatNode, FlowDocument } from '../types';
import { deriveStepMaps } from './deriveStepMaps';

const flow = flowJson as unknown as FlowDocument;
const derived = deriveStepMaps(flow);

describe('deriveStepMaps cutover equivalence (the retired hand tables)', () => {
  it('entryServerStep matches the historical back-nav window table', () => {
    expect(derived.entryServerStep).toEqual({
      'ONBOARD-01--FORM': 1,
      'ONBOARD-FORK--FORM': 2,
      'ONBOARD-BEGINNER-01': 3,
      'ONBOARD-ADVANCED': 3,
      'ONBOARD-BEGINNER-02': 4,
      'ONBOARD-ADVANCED-FREQUENCY': 4,
      'ONBOARD-BEGINNER-03': 5,
      'ONBOARD-BEGINNER-04': 5,
    });
  });

  it('stepToScreenLabel matches the historical session-log labels', () => {
    // Step 9 (ONBOARD-WEEKLY-SETUP) is cut from onboarding, so the scale ends at 8.
    expect(derived.stepToScreenLabel).toEqual({
      1: 'ONBOARD-01',
      2: 'ONBOARD-FORK',
      3: 'ONBOARD-BEGINNER-01',
      4: 'ONBOARD-BEGINNER-02',
      5: 'ONBOARD-BEGINNER-03',
      6: 'ONBOARD-STATE-CHECK',
      7: 'ONBOARD-MORNING-SETUP',
      8: 'ONBOARD-BEGINNER-07',
    });
  });

  it('the advance ladder matches the historical addendum ladder (one-ahead on the shared 5)', () => {
    const ladder = derived.advanceLadder
      .map((r) => `${r.label}(${r.display})→${r.target}`)
      .join(', ');
    expect(ladder).toBe(
      'profile(1)→2, path(2)→3, category(3)→4, goals(4)→5, habit-select(5)→6, habit-schedule(6)→7',
    );
  });

  it('identity beats (self-advancing) are exactly the off-window pre-fork set', () => {
    // WEEKLY-SETUP is cut, so the identity (off-window pre-fork) set is these three.
    expect(derived.selfAdvancingScreens).toEqual([
      'ONBOARD-STATE-CHECK',
      'ONBOARD-MORNING-SETUP',
      'ONBOARD-BEGINNER-07',
    ]);
  });

  it('ambiguous tools (update_habit on two beats) are omitted from toolScreen', () => {
    expect(derived.toolScreen.update_habit).toBeUndefined();
    expect(derived.toolScreen.submit_profile).toBe('ONBOARD-01--FORM');
  });

  it('advanceGateOwners keys the STORED step to the beat being left (B50)', () => {
    expect(derived.advanceGateOwners).toEqual({
      1: { simple: 'profile-input', braindump: 'profile-input' },
      2: { simple: 'path-selection', braindump: 'path-selection' },
      3: { simple: 'category-grid', braindump: 'advanced-capture' },
      4: { simple: 'goals-list', braindump: 'advanced-frequency' },
      5: { simple: 'habit-picker' },
      // The one-ahead seam: habit-schedule shares persist 5 with habit-select,
      // so its stored step is 6. The advance out of it gates on habit data,
      // never on state-check data (the next beat).
      6: { simple: 'habit-schedule' },
    });
  });
});

describe('the committed api module is in sync with the flow', () => {
  it('stepMaps.generated.ts matches a fresh derivation (run npm run flow:sync if this fails)', () => {
    expect(STEP_OWNERS).toEqual(JSON.parse(JSON.stringify(derived.stepOwners)));
    expect(ADVANCE_GATE_OWNERS).toEqual(JSON.parse(JSON.stringify(derived.advanceGateOwners)));
    expect(SELF_ADVANCING_SCREENS).toEqual(derived.selfAdvancingScreens);
    expect(MAX_STEP).toBe(derived.maxStep);
    expect(ADVANCE_LADDER).toBe(
      derived.advanceLadder.map((r) => `${r.label}(${r.display})→${r.target}`).join(', '),
    );
  });

  it('the addendum embeds the derived ladder and names every self-advancing screen', () => {
    expect(ONBOARDING_TOOL_ADDENDUM).toContain(ADVANCE_LADDER);
    for (const screen of derived.selfAdvancingScreens) {
      expect(ONBOARDING_TOOL_ADDENDUM, `${screen} missing from SELF-ADVANCING BEATS`).toContain(
        screen,
      );
    }
    // ...and their data tools.
    for (const screen of derived.selfAdvancingScreens) {
      const node = flow.nodes.find((n) => n.screenId === screen);
      const tool = node?.tool?.toolName;
      expect(tool, `${screen} has no tool`).toBeDefined();
      expect(ONBOARDING_TOOL_ADDENDUM, `${tool} missing from SELF-ADVANCING BEATS`).toContain(
        tool as string,
      );
    }
  });
});

describe('no-hand-edit property: derived maps follow a flow mutation', () => {
  it('dropping the goals beat updates ladder, entry table, and owners together', () => {
    const mutated = structuredClone(flow) as FlowDocument;
    mutated.nodes = mutated.nodes.filter((n) => n.id !== 'goals');
    const category = mutated.nodes.find((n) => n.id === 'category') as BeatNode;
    const habitSelect = mutated.nodes.find((n) => n.id === 'habit-select') as BeatNode;
    category.nextId = 'habit-select';
    habitSelect.backId = 'category';
    const fork = mutated.nodes.find((n) => n.type === 'branch');
    if (fork?.type === 'branch') {
      // lane entry/exit unchanged (category ... habit-schedule)
    }

    const d = deriveStepMaps(mutated);
    const ladder = d.advanceLadder.map((r) => `${r.label}(${r.display})→${r.target}`).join(', ');
    expect(ladder).toBe(
      'profile(1)→2, path(2)→3, category(3)→4, habit-select(5)→6, habit-schedule(6)→7',
    );
    expect(d.entryServerStep['ONBOARD-BEGINNER-02']).toBeUndefined();
    expect(d.stepOwners[4]).toEqual({ braindump: 'advanced-frequency' });
    expect(d.stepScreens[4]).toEqual({ braindump: 'ONBOARD-ADVANCED-FREQUENCY' });
    // Identity beats unaffected by lane edits.
    expect(d.selfAdvancingScreens).toEqual(derived.selfAdvancingScreens);
  });

  it('reordering the pre-fork setup beats leaves the maps stable (order-independent identities)', () => {
    const mutated = structuredClone(flow) as FlowDocument;
    const byId = new Map(mutated.nodes.map((n) => [n.id, n]));
    // Swap morning-checkin-setup and reflection-setup in the rhythm-first walk
    // order: state-check -> reflection -> morning -> path-fork (the fork follows
    // the setup block now that it runs pre-fork).
    const stateCheck = byId.get('state-check') as BeatNode;
    const morning = byId.get('morning-checkin-setup') as BeatNode;
    const reflection = byId.get('reflection-setup') as BeatNode;
    stateCheck.nextId = 'reflection-setup';
    reflection.nextId = 'morning-checkin-setup';
    reflection.backId = 'state-check';
    morning.nextId = 'path-fork';
    morning.backId = 'reflection-setup';

    const d = deriveStepMaps(mutated);
    expect(d.entryServerStep).toEqual(derived.entryServerStep);
    expect(d.stepOwners).toEqual(derived.stepOwners);
    // Walk order changed, so only the self-advancing ORDER flips.
    expect([...d.selfAdvancingScreens].sort()).toEqual([...derived.selfAdvancingScreens].sort());
  });
});
