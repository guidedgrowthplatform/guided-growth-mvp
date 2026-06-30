import { useMemo } from 'react';
import { validateFlow } from './flowMachine';
import { CHECKIN_FLOWS } from './flows/checkin-flows';
import type { FlowDocument } from './types';

export type CheckinFlowId = keyof typeof CHECKIN_FLOWS;

export function useCheckinFlow(id: CheckinFlowId): {
  flow: FlowDocument;
  tag: string;
  problems: string[];
} {
  return useMemo(() => {
    const flow = CHECKIN_FLOWS[id];
    return { flow, tag: `${flow.flowId}@v${flow.version}`, problems: validateFlow(flow) };
  }, [id]);
}
