/**
 * PlanEditContext - carries the orchestrator's `patchAnswers` down to the
 * plan-review adapter (ONBOARD-COMPLETE) without threading a prop through every
 * BeatView render branch. Only the plan-review consumes it; every other beat
 * ignores it. null when rendered outside a provider (defensive: edits no-op).
 *
 * NO EM DASHES.
 */
import { createContext, useContext } from 'react';
import type { FlowAnswers } from '../types';

export type PatchAnswers = (
  patch: Partial<FlowAnswers> | ((answers: FlowAnswers) => Partial<FlowAnswers>),
  opts?: { persist?: boolean },
) => void;

const PlanEditContext = createContext<PatchAnswers | null>(null);

export const PlanEditProvider = PlanEditContext.Provider;

export function usePatchAnswers(): PatchAnswers | null {
  return useContext(PlanEditContext);
}
