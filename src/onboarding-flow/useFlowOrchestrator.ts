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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOnboardingVoice } from '@/contexts/useOnboardingVoiceSession';
import { useOnboarding } from '@/hooks/useOnboarding';
// V3: all pre-fork beats (why-intro, state-check, morning-checkin-setup, reflection-card)
// have persist steps 6-8 but appear BEFORE the fork in flow order. No ENGINE_PERSISTLESS_STEP
// entries are needed in v3: into-app has persistsFields=[] so its tool is cosmetic, and
// the weekly-projection nodes are pure display with no step.
const ENGINE_PERSISTLESS_STEP: Record<string, number> = {};
// Server-scale `current_step` each beat ENTERS at (v3 canonical step table).
// Distinct from engine `beatStep`: the leading-edge model's two consecutive 5s
// (habit-select + habit-schedule) make the stored server step run one AHEAD of
// the engine step from habit-schedule on. Resume maps a stored SERVER step back
// to its beat on THIS scale, not engine beatStep.
//
// V3 flow order: auth -> mic -> profile (1) -> why-intro -> state-check ->
//   morning-checkin-setup -> reflection-setup -> path-fork (2) ->
//   [beginner] category (3) -> goals (4) -> habit-select (5) -> habit-schedule (5)
//   [advanced] advanced-capture (3) -> advanced-frequency (4)
//   -> into-app -> weekly-projection x5
// (state-check=6, morning-setup=7, reflection=8 have large persist steps but
// appear before the fork; they are ABSENT from this table so the resume walk
// passes through them when seeking steps 2-5, and they become stop targets only
// when current_step is >= their persist step.)
const ENTRY_SERVER_STEP: Record<string, number> = {
  'ONBOARD-01--FORM': 1,
  'ONBOARD-FORK--FORM': 2,
  'ONBOARD-BEGINNER-01': 3,
  'ONBOARD-ADVANCED': 3,
  'ONBOARD-BEGINNER-02': 4,
  'ONBOARD-ADVANCED-FREQUENCY': 4,
  'ONBOARD-BEGINNER-03': 5,
  'ONBOARD-BEGINNER-04': 5,
  // V3 note: ONBOARD-STATE-CHECK (persist step 6), ONBOARD-MORNING-SETUP (7), and
  // ONBOARD-BEGINNER-07 (8) appear BEFORE the fork in flow order but hold persist
  // steps 6-8. They are intentionally absent from this resume table: the resume
  // walk passes through them (serverCaptureForBeat is called but they are not stop
  // targets for steps 2-5). For steps 6-8, the user is mid pre-fork setup; the
  // leading-edge coach-advance handles those transitions, not the resume walk.
};

/** The server `current_step` a beat is active at — the resume scale (NOT beatStep). */
export function entryServerStep(node: FlowNode | undefined): number | undefined {
  if (!node) return undefined;
  return ENTRY_SERVER_STEP[node.screenId];
}
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

/**
 * Walk the machine forward from `fromState` until `currentNodeId === targetNodeId`
 * (or until no progress). Used by the QA startAtNodeId seed to skip pre-beat
 * nodes (auth, mic) so a tester can jump straight to, e.g., the profile beat.
 * Each intermediate node is advanced with an empty capture (no data written).
 * Pure; does not mutate state. Returns the original state unchanged if the
 * target node is not reachable from the start.
 */
export function fastForwardToNode(
  flow: FlowDocument,
  fromState: FlowMachineState,
  targetNodeId: string,
): FlowMachineState {
  let st = fromState;
  for (let guard = 0; guard < 50; guard++) {
    if (st.currentNodeId === targetNodeId) break;
    if (st.status === 'complete') break;
    const next = applyCapture(flow, st, { data: {} });
    if (next.currentNodeId === st.currentNodeId) break; // no progress
    st = next;
  }
  return st;
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
    case 'advanced-frequency':
      // V3: day-picker for braindump habits. Same field as habit-schedule.
      if (data.habitConfigs != null) out.data.habitConfigs = data.habitConfigs;
      break;
    case 'state-check':
      // V3: first check-in during onboarding. The checkin record is stored in
      // its own server table, not in OnboardingStepData, so there is nothing to
      // pull back here. Return morningCheckin as a proxy so the machine sees a
      // non-empty replay and advances past this beat on resume (the actual checkin
      // data is not needed by the engine for downstream routing).
      out.data.morningCheckin = data.morningCheckin ?? { time: '08:00', days: [1,2,3,4,5], reminder: true, schedule: 'Weekday' };
      break;
    case 'morning-checkin-setup':
      if (data.morningCheckin != null) out.data.morningCheckin = data.morningCheckin;
      break;
    case 'plan-cards':
    case 'into-app':
    case 'why-intro':
    case 'weekly-projection':
      // No fields to replay; advance with empty capture.
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
 * resolves), and stops at the first beat whose ENTRY server step is >= `serverStep`
 * (the resume target). The comparison is on the server `current_step` scale
 * (`entryServerStep`), NOT engine `beatStep` — the two diverge past habit-schedule,
 * and using beatStep here overshoots the user to the end. Pre-step beats (auth/mic,
 * undefined entry step) are walked through — on resume the user is already authed and
 * mic-granted. Guarded against non-progress and the terminal node. Pure → unit-testable.
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
    const eStep = entryServerStep(node);
    if (eStep !== undefined && eStep >= serverStep) break; // reached the saved beat
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
  /** Seed answers known before the flow starts (e.g. nickname from sign-in) so the
   *  coach treats them as filled and never re-asks. A later capture overrides them. */
  initialAnswers?: Partial<FlowAnswers>;
  /**
   * QA only: if set, the machine is seeded at the node matching this id
   * on mount. Pre-beat nodes (auth, mic) are walked with empty captures so
   * their data requirements are satisfied. The user MUST already be signed
   * in (ensureSignedIn ran in QAControlScreen) before navigating here.
   * Has no effect once the server-step resume fires on a non-zero serverStep.
   */
  startAtNodeId?: string;
}

export function useFlowOrchestrator(
  flow: FlowDocument,
  persistence: FlowPersistence,
  options?: FlowOrchestratorOptions,
): FlowOrchestrator {
  const [state, setState] = useState<FlowMachineState>(() => {
    const init = initFlowMachine(flow);
    // Seed known answers (e.g. nickname from sign-in) so the coach never re-asks.
    const seeded = options?.initialAnswers
      ? { ...init, answers: { ...options.initialAnswers, ...init.answers } }
      : init;
    // QA only: if a startAtNodeId is requested, walk to that node synchronously
    // so the machine starts there rather than at the entry node. The server-step
    // resume effect (resumedRef) will see the machine already past step 0 and
    // not rewind it; the leading-edge advance effect will record the correct
    // baseline on the first serverStep observation.
    if (options?.startAtNodeId) {
      return fastForwardToNode(flow, seeded, options.startAtNodeId);
    }
    return seeded;
  });
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
  // `path` lives in its OWN column (onboarding_states.path), not in `data` — but
  // serverCaptureForBeat reads data.path to resolve the fork lane. Without merging
  // it in, the fork capture sees no path → applyCapture falls through to the
  // branch's mergeNodeId (plan review) and the engine SKIPS the whole beginner/
  // advanced lane. Merge the column back into the data the capture reads.
  const serverData = useMemo<OnboardingStepData>(
    () => ({
      ...(serverState?.data ?? {}),
      ...(serverState?.path ? { path: serverState.path } : {}),
    }),
    [serverState?.data, serverState?.path],
  );
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
