import { describe, expect, it } from 'vitest';
import { type CheckinStageKey, CHECKIN_SCRIPTS } from '@gg/shared/checkin/scriptVariations';
import { CHECKIN_FLOWS } from './flows/checkin-flows';
import { resolveCheckinOpeners } from './resolveCheckinOpeners';

const morning = CHECKIN_FLOWS['morning-checkin-v1'];
const evening = CHECKIN_FLOWS['evening-checkin-v1'];

const NODE_STAGE: Record<string, CheckinStageKey> = {
  'morning-greeting': 'morning_greeting',
  'morning-state': 'morning_state_prompt',
  'morning-are-you-done': 'are_you_done',
  'morning-wrap': 'morning_wrap',
  'evening-greeting': 'evening_greeting_habits',
  'evening-habit-review': 'evening_habit_prompt',
  'evening-are-you-done': 'are_you_done',
  'evening-reflection': 'reflection_transition',
  'evening-wrap': 'evening_wrap',
};

const openerOf = (flow: typeof morning, id: string) =>
  flow.nodes.find((n) => n.id === id)!.voice.openerText!;

describe('resolveCheckinOpeners', () => {
  it('rotates every mapped opener beat from its pool, in both flows', () => {
    for (const flow of [morning, evening]) {
      const resolved = resolveCheckinOpeners(flow);
      for (const [id, stage] of Object.entries(NODE_STAGE)) {
        if (!flow.nodes.some((n) => n.id === id)) continue;
        expect(CHECKIN_SCRIPTS[stage]).toContain(openerOf(resolved, id));
      }
    }
  });

  it('does not return the same variant on consecutive opens when the pool has options', () => {
    const stage: CheckinStageKey = 'morning_greeting';
    expect(CHECKIN_SCRIPTS[stage].length).toBeGreaterThan(1);
    const a = openerOf(resolveCheckinOpeners(morning), 'morning-greeting');
    const b = openerOf(resolveCheckinOpeners(morning), 'morning-greeting');
    expect(b).not.toBe(a);
  });

  it('does not mutate the source flow', () => {
    const before = openerOf(morning, 'morning-state');
    resolveCheckinOpeners(morning);
    expect(openerOf(morning, 'morning-state')).toBe(before);
  });
});
