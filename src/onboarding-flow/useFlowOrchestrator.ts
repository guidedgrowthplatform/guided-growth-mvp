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
import { useOnboarding } from '@/hooks/useOnboarding';
// Persist-null beats write no step, so they have no canonical save step. Their
// advance threshold must sit strictly BELOW the next persist beat's step for the
// leading-edge climb to fire (plan-cards precedes morning-setup at step 7).
// Engine-local on purpose: the legacy chat lane's SCREEN_TO_STEP maps BEGINNER-06
// to its terminal step-7 plan review, so we must NOT reuse it here.
const ENGINE_PERSISTLESS_STEP: Record<string, number> = {
  'ONBOARD-BEGINNER-06': 6,
};
import type { OnboardingPath, OnboardingState, OnboardingStepData } from '@gg/shared/types';
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

/** The step this beat completes (persist.step is the canonical save step). */
export function beatStep(node: FlowNode | undefined): number | undefined {
  if (!node) return undefined;
  if (node.persist) return node.persist.step;
  // Terminal into-app (COMPLETE) is intentionally absent → undefined → no
  // auto-advance; completion fires when the machine reaches its null nextId.
  return ENGINE_PERSISTLESS_STEP[node.screenId];
}

/**
 * Build the capture a beat would have produced, from the server's persisted
 * onboarding data. Used when the coach saves a beat by voice (Vapi tool call /
 * Direct-LLM advance): the server already holds the captured values, so we pull
 * them back out by the beat's componentType and replay them as a capture so the
 * machine advances with the SAME answers a card tap would have set (the fork
 * resolves, past-beat summaries render). data fields mirror the card adapters.
 */
export function serverCaptureForBeat(
  node: FlowNode | undefined,
  data: OnboardingStepData,
): BeatCapture {
  const out: BeatCapture = { data: {} };
  if (!node) return out;
  switch (node.componentType) {
    case 'profile-input':
      if (data.age != null) out.data.age = data.age;
      if (data.gender != null) out.data.gender = data.gender;
      break;
    case 'path-selection':
      if (data.path === 'simple' || data.path === 'braindump') {
        out.path = data.path as OnboardingPath;
      }
      break;
    case 'category-grid':
      if (data.category != null) out.data.category = data.category;
      break;
    case 'goals-list':
      if (data.goals != null) out.data.goals = data.goals;
      break;
    case 'habit-picker':
      if (data.habitConfigs != null) out.data.habitConfigs = data.habitConfigs;
      break;
    case 'reflection-card':
      if (data.reflectionConfig != null) out.data.reflectionConfig = data.reflectionConfig;
      break;
    case 'habit-schedule':
      if (data.habitConfigs != null) out.data.habitConfigs = data.habitConfigs;
      break;
    case 'advanced-capture':
      // brain dump is its own componentType now, no longer coach-bubble.
      if (data.brainDumpText != null) out.data.brainDumpText = data.brainDumpText;
      break;
    case 'morning-checkin-setup':
      if (data.morningCheckin != null) out.data.morningCheckin = data.morningCheckin;
      break;
    case 'plan-cards':
    case 'into-app':
      // persist-null beats — no field to replay; advance with empty capture.
      break;
    default:
      break;
  }
  return out;
}

/**
 * Fast-forward a fresh machine to the saved server step so a page refresh lands
 * on the beat the user was on, not back at the entry node. Walks from `fromState`,
 * replaying each passed beat's server capture (so answers populate + the fork
 * resolves), and stops at the first beat whose step is >= `serverStep` (the
 * resume target). Pre-step beats (auth/mic, undefined beatStep) are walked
 * through — on resume the user is already authed and mic-granted. Guarded against
 * non-progress and the terminal node. Pure → unit-testable.
 */
export function resumeToServerStep(
  flow: FlowDocument,
  fromState: FlowMachineState,
  serverStep: number,
  data: OnboardingStepData,
): FlowMachineState {
  let st = fromState;
  for (let guard = 0; guard < 50; guard++) {
    if (st.status === 'complete') break;
    const node = getNode(flow, st.currentNodeId);
    if (!node) break;
    const bStep = beatStep(node);
    if (bStep !== undefined && bStep >= serverStep) break; // reached the saved beat
    const next = applyCapture(flow, st, serverCaptureForBeat(node, data));
    if (next.currentNodeId === st.currentNodeId) break; // no progress → stop
    st = next;
  }
  return st;
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
  // Server onboarding row (current_step + data). Mirrored from Supabase Realtime
  // on the voice path; null in the auth-free preview. Drives the coach-save
  // advance below.
  const { state: serverState } = useOnboarding();

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

  // Advance the machine with a captured answer. `save` is true for a tap (write
  // to Supabase via saveStep); false when the coach already saved the beat
  // server-side and we are only catching the local engine up (no double-write).
  const applyAndAdvance = useCallback(
    (cap: BeatCapture, save: boolean) => {
      const prev = stateRef.current;
      if (prev.status === 'complete') return;
      const node = getNode(flow, prev.currentNodeId);
      if (!node) return;

      const next = applyCapture(flow, prev, cap);

      if (node.persist) {
        // Reuse the real Step save path (tap only, since a coach-driven advance
        // has already persisted server-side, so re-saving would be a redundant write).
        if (save) {
          if (node.persist.pathField) {
            persistence.saveStep(node.persist.step, {}, cap.path ? { path: cap.path } : undefined);
          } else {
            persistence.saveStep(node.persist.step, cap.data);
          }
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

  const capture = useCallback((cap: BeatCapture) => applyAndAdvance(cap, true), [applyAndAdvance]);

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

  // Coach-driven advance (the explicit signal for the voice path).
  //
  // Vapi carries audio only. Its submit_*/navigate_next tool calls run
  // server-side and write onboarding_states; the browser sees the result as a
  // current_step climb mirrored in via Supabase Realtime (useOnboardingRealtimeSync).
  // The Direct-LLM path writes the same current_step from its tool dispatch. So a
  // single watch on the server current_step advances the local engine for BOTH
  // voice paths, with the captured answer pulled back out of the persisted data
  // (the fork resolves, the past-beat summary renders).
  //
  // Leading-edge only: we record the step observed when this beat became active
  // and advance solely on a later climb PAST the active beat's step. A tap save
  // lands at the just-completed (lower) step, and a back-nav arrives already
  // ahead, so neither is a transition past the active beat and neither double-fires.
  const serverStep = serverState?.current_step;
  const serverData = serverState?.data;
  const activeNodeId = state.currentNodeId;
  const baselineStepRef = useRef<number | null>(null);
  const advancedNodeRef = useRef<string | null>(null);

  // One-time resume: on the first load with a server row ahead of the entry,
  // fast-forward the local engine to the saved current_step so a refresh lands on
  // the beat the user was on (not back at AUTH). Runs once; afterwards the
  // leading-edge effect below owns live advances + back-nav semantics.
  const resumedRef = useRef(false);
  useEffect(() => {
    if (resumedRef.current) return;
    if (typeof serverStep !== 'number') return; // no server row (preview / not loaded yet)
    resumedRef.current = true;
    const resumed = resumeToServerStep(
      flow,
      stateRef.current,
      serverStep,
      (serverData ?? {}) as OnboardingStepData,
    );
    if (resumed.currentNodeId !== stateRef.current.currentNodeId) {
      stateRef.current = resumed;
      setState(resumed);
    }
  }, [serverStep, serverData, flow]);

  // Reset the per-beat baseline + fired-flag whenever the active beat changes, so
  // each beat judges advancement against the step seen on entry (not a prior
  // beat's) and a re-entered beat can advance again.
  useEffect(() => {
    baselineStepRef.current = null;
    advancedNodeRef.current = null;
  }, [activeNodeId]);
  useEffect(() => {
    if (!activeNodeId || state.status === 'complete') return;
    if (typeof serverStep !== 'number') return; // no server row (preview / not loaded)
    const node = getNode(flow, activeNodeId);
    const thisStep = beatStep(node);
    if (thisStep === undefined) return;
    // First observation for this beat: record the baseline, never advance off it
    // (mirror useAgentNavigation's leading-edge rule so a back-nav / resume that
    // arrives already-ahead doesn't yank the user forward).
    if (baselineStepRef.current === null) {
      baselineStepRef.current = serverStep;
      return;
    }
    if (advancedNodeRef.current === activeNodeId) return; // fire once per beat
    // Advance only on a genuine climb past this beat's step (the coach saved it).
    if (serverStep <= baselineStepRef.current) return;
    if (serverStep <= thisStep) return;
    advancedNodeRef.current = activeNodeId;
    const cap = serverCaptureForBeat(node, (serverData ?? {}) as OnboardingStepData);
    applyAndAdvance(cap, false);
  }, [activeNodeId, serverStep, serverData, state.status, flow, applyAndAdvance]);

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
