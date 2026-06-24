/**
 * The beat orchestrator (React layer).
 *
 * Wraps the pure flow machine and adds the three things a real session needs:
 *   1. Persistence — reuses the existing Step save path (saveStep / complete)
 *      via an injected FlowPersistence adapter. Optimistic + fire-and-forget so
 *      a slow/failed write never blocks the conversation moving forward.
 *   2. Coach wiring — registers each active beat's screen id with the voice
 *      provider (drives the existing per-screen context injection) and pushes
 *      the accumulated answers so the coach never re-asks. The composed
 *      [general + beat] context is exposed as `activeContext`.
 *   3. Version pinning — fires `onPin(tag)` on the first real save so the user
 *      is locked to the flow version they started on.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useOnboardingVoice } from '@/contexts/useOnboardingVoiceSession';
import type { OnboardingStepData } from '@gg/shared/types';
import {
  applyCapture,
  canGoBack as machineCanGoBack,
  type FlowMachineState,
  getNode,
  goBack,
  initFlowMachine,
} from './flowMachine';
import { composeBeatContext } from './generalContext';
import type { FlowPersistence } from './persistence';
import type { BeatCapture, FlowAnswers, FlowDocument, FlowNode } from './types';

/** The fields PlanReviewPage.complete() persists at the end of onboarding. */
function deriveFinalData(answers: FlowAnswers): Partial<OnboardingStepData> {
  const { category, goals, habitConfigs, reflectionConfig } = answers;
  return { category, goals, habitConfigs, reflectionConfig };
}

export interface FlowOrchestrator {
  flow: FlowDocument;
  state: FlowMachineState;
  currentNode: FlowNode | undefined;
  answers: FlowAnswers;
  /** Composed [general context + current beat context] fed to the coach. */
  activeContext: string | null;
  /** Capture the active beat's answer, persist it, and advance. */
  capture: (capture: BeatCapture) => void;
  back: () => void;
  canGoBack: boolean;
  isComplete: boolean;
}

export interface FlowOrchestratorOptions {
  /** Pin tag for the loaded flow; fired via onPin on the first save. */
  flowTag?: string;
  onPin?: (tag: string) => void;
}

export function useFlowOrchestrator(
  flow: FlowDocument,
  persistence: FlowPersistence,
  options?: FlowOrchestratorOptions,
): FlowOrchestrator {
  const [state, setState] = useState<FlowMachineState>(() => initFlowMachine(flow));
  const voice = useOnboardingVoice();

  // Mirror state into a ref so capture() reads the latest synchronously and runs
  // its save side effects exactly once (not inside a setState updater, which can
  // double-invoke under StrictMode).
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const pinnedRef = useRef(false);
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const currentNode = getNode(flow, state.currentNodeId);
  const activeContext = currentNode ? composeBeatContext(currentNode.context.contextBlock) : null;

  const capture = useCallback(
    (cap: BeatCapture) => {
      const prev = stateRef.current;
      if (prev.status === 'complete') return;
      const node = getNode(flow, prev.currentNodeId);
      if (!node) return;

      const next = applyCapture(flow, prev, cap);

      // Reuse the real Step save path.
      if (node.persist) {
        if (node.persist.pathField) {
          persistence.saveStep(node.persist.step, {}, cap.path ? { path: cap.path } : undefined);
        } else {
          persistence.saveStep(node.persist.step, cap.data);
        }
        // Pin the user to this flow version on their first real save.
        const opts = optionsRef.current;
        if (!pinnedRef.current && opts?.flowTag) {
          pinnedRef.current = true;
          opts.onPin?.(opts.flowTag);
        }
      }

      if (next.status === 'complete') {
        persistence.complete(deriveFinalData(next.answers));
      }

      stateRef.current = next;
      setState(next);
    },
    [flow, persistence],
  );

  const back = useCallback(() => {
    setState((prev) => {
      const nextState = goBack(flow, prev);
      stateRef.current = nextState;
      return nextState;
    });
  }, [flow]);

  // Coach wiring: register the active beat's screen id (the existing per-screen
  // context pipeline keys off this) whenever the beat changes. Null-safe.
  useEffect(() => {
    if (!voice || !currentNode) return;
    voice.registerScreen(currentNode.screenId);
  }, [voice, currentNode]);

  // Keep the coach's view of already-filled fields current so it never re-asks.
  useEffect(() => {
    if (!voice) return;
    voice.setFormSnapshot(state.answers as Record<string, unknown>);
  }, [voice, state.answers]);

  const canGoBack = machineCanGoBack(state, flow);

  return {
    flow,
    state,
    currentNode,
    answers: state.answers,
    activeContext,
    capture,
    back,
    canGoBack,
    isComplete: state.status === 'complete',
  };
}
