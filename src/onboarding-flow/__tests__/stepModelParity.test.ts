import { describe, expect, it } from 'vitest';
import flowJson from '../flows/onboarding-beginner-v1.generated.json';
import type { BeatNode, FlowDocument, FlowNode } from '../types';
import { beatStep } from '../useFlowOrchestrator';

// Locks the leading-edge advance model (useFlowOrchestrator): a beat advances only
// when the server current_step climbs strictly PAST the beat's step. So a coach-
// advanced persist-null beat (e.g. plan-cards) must carry a step strictly below the
// next stepped beat, or the climb never fires and the user strands.
const flow = flowJson as unknown as FlowDocument;
const byId = new Map(flow.nodes.map((n) => [n.id, n]));

const isBeat = (n: FlowNode): n is BeatNode => n.type === 'beat';

// Follow nextId until the first node with a defined beatStep.
function nextDefinedStep(node: BeatNode): number | undefined {
  const seen = new Set<string>();
  let cur: FlowNode | undefined = node.nextId ? byId.get(node.nextId) : undefined;
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    const s = beatStep(cur);
    if (s !== undefined) return s;
    cur = isBeat(cur) && cur.nextId ? byId.get(cur.nextId) : undefined;
  }
  return undefined;
}

describe('step model parity', () => {
  it('persist beats: beatStep equals persist.step', () => {
    for (const n of flow.nodes) {
      if (n.persist) expect(beatStep(n), n.screenId).toBe(n.persist.step);
    }
  });

  it('coach-advanced persist-null beats sit strictly below the next stepped beat', () => {
    // Coach-advanced = has a tool (auth / mic-permission self-advance via UI and
    // carry no tool, so they're exempt). Terminal nodes (into-app in v3) have no
    // tool so they're also exempt. V3 dropped plan-cards, so this set may be empty.
    const coachPersistless = flow.nodes.filter(
      (n): n is BeatNode => isBeat(n) && !n.persist && n.tool != null && n.nextId != null,
    );
    // V3: plan-cards dropped, into-app tool set to null. Set can be empty.

    for (const node of coachPersistless) {
      const step = beatStep(node);
      expect(
        step,
        `${node.screenId} persist-null/coach-advanced has no engine step → strands`,
      ).not.toBeUndefined();
      const next = nextDefinedStep(node);
      expect(next, `${node.screenId} has no downstream stepped beat`).not.toBeUndefined();
      expect(
        (step as number) < (next as number),
        `${node.screenId} step ${step} must be < next stepped beat ${next} for the climb to fire`,
      ).toBe(true);
    }
  });
});
