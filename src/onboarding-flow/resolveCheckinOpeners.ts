import { pickVariation } from '@gg/shared/checkin/scriptVariations';
import type { FlowDocument } from './types';

const MORNING_FLOW_ID = 'morning-checkin-v1';
const MORNING_STATE_BEAT_ID = 'morning-state';

// Sources the morning state-check opener from the morning_state_prompt rotation.
export function resolveCheckinOpeners(flow: FlowDocument): FlowDocument {
  if (flow.flowId !== MORNING_FLOW_ID) return flow;

  const openerText = pickVariation('morning_state_prompt');
  return {
    ...flow,
    nodes: flow.nodes.map((n) =>
      n.id === MORNING_STATE_BEAT_ID ? { ...n, voice: { ...n.voice, openerText } } : n,
    ),
  };
}
