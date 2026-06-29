import { hasStateIntroCopy, pickVariation } from '@gg/shared/checkin/scriptVariations';
import type { FlowDocument } from './types';

export const MORNING_FLOW_ID = 'morning-checkin-v1';
const MORNING_STATE_BEAT_ID = 'morning-state';

// intro present -> two bubbles (renderer splits on the blank line); else ask alone.
export function buildMorningStateOpener({ intro, ask }: { intro: string | null; ask: string }): {
  openerText: string;
  introShown: boolean;
} {
  return intro
    ? { openerText: `${intro}\n\n${ask}`, introShown: true }
    : { openerText: ask, introShown: false };
}

// Sources the morning state-check opener from the script rotation. First run (with
// real copy) prepends the one-time state_intro; later runs are the ask alone.
export function resolveCheckinOpeners(
  flow: FlowDocument,
  { firstRun }: { firstRun: boolean },
): { flow: FlowDocument; introShown: boolean } {
  if (flow.flowId !== MORNING_FLOW_ID) return { flow, introShown: false };

  const intro = firstRun && hasStateIntroCopy() ? pickVariation('state_intro') : null;
  const { openerText, introShown } = buildMorningStateOpener({
    intro,
    ask: pickVariation('morning_state_prompt'),
  });

  return {
    flow: {
      ...flow,
      nodes: flow.nodes.map((n) =>
        n.id === MORNING_STATE_BEAT_ID ? { ...n, voice: { ...n.voice, openerText } } : n,
      ),
    },
    introShown,
  };
}
