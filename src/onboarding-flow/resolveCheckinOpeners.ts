import { type CheckinStageKey, CHECKIN_SCRIPTS } from '@gg/shared/checkin/scriptVariations';
import type { FlowDocument } from './types';

// Beat node id -> rotation stage, per flow. Every opener beat rotates from its pool.
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

// Last variant shown per stage, so consecutive opens don't repeat the same line.
const lastShown = new Map<CheckinStageKey, string>();

function pickFresh(stage: CheckinStageKey): string {
  const pool = CHECKIN_SCRIPTS[stage];
  const fresh = pool.filter((v) => v !== lastShown.get(stage));
  const usable = fresh.length > 0 ? fresh : pool;
  const choice = usable[Math.floor(Math.random() * usable.length)];
  lastShown.set(stage, choice);
  return choice;
}

// Rewrite each opener beat's openerText from its rotation pool (both flows).
export function resolveCheckinOpeners(flow: FlowDocument): FlowDocument {
  return {
    ...flow,
    nodes: flow.nodes.map((n) => {
      const stage = NODE_STAGE[n.id];
      if (!stage) return n;
      return { ...n, voice: { ...n.voice, openerText: pickFresh(stage) } };
    }),
  };
}
