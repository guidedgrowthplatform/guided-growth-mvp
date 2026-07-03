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
// the engine step from habit-schedule on.
//
// V3 flow order: auth -> mic -> profile (1) -> why-intro -> state-check (6) ->
//   morning-checkin-setup (7) -> reflection-setup (8) -> path-fork (2) ->
//   [beginner] category (3) -> goals (4) -> habit-select (5) -> habit-schedule (5)
//   [advanced] advanced-capture (3) -> advanced-frequency (4)
//   -> into-app -> weekly-projection x5
//
// Persist steps are non-monotonic vs flow order (1,6,7,8,2,3,4,5,5) and the tap
// save path pins current_step with GREATEST — so past state-check the numeric
// step is an identity label, not a position. Resume is therefore data-evidence
// driven (resumeFromServerRow); this table survives only as the numeric stop for
// the steps-2..5 back-nav window, where advance_step bare-sets restore meaning.
const ENTRY_SERVER_STEP: Record<string, number> = {
  'ONBOARD-01--FORM': 1,
  'ONBOARD-FORK--FORM': 2,
  'ONBOARD-BEGINNER-01': 3,
  'ONBOARD-ADVANCED': 3,
  'ONBOARD-BEGINNER-02': 4,
  'ONBOARD-ADVANCED-FREQUENCY': 4,
  'ONBOARD-BEGINNER-03': 5,
  'ONBOARD-BEGINNER-04': 5,
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
  toolSaveFor,
} from './flowMachine';
import { composeBeatContext } from './generalContext';
import type { FlowPersistence } from './persistence';
import type { BeatCapture, BranchNode, FlowAnswers, FlowDocument, FlowNode } from './types';

/** The fields PlanReviewPage.complete() persists at the end of onboarding. */
function deriveFinalData(answers: FlowAnswers): Partial<OnboardingStepData> {
  const { category, goals, habitConfigs, reflectionConfig } = answers;
  return { category, goals, habitConfigs, reflectionConfig };
}

/**
 * Which fork lane (if any) contains `targetNodeId`, walking each lane's chain
 * from its entry to its exit. Lets the fast-forward walk resolve a branch
 * TOWARD the target instead of falling through to the merge node (which used
 * to skip the whole lane and run the machine to completion).
 */
function laneValueContaining(
  flow: FlowDocument,
  branch: BranchNode,
  targetNodeId: string,
): string | null {
  for (const lane of branch.lanes) {
    let id: string | null = lane.entryNodeId;
    for (let guard = 0; guard < 50 && id; guard++) {
      if (id === targetNodeId) return lane.value;
      if (id === lane.exitNodeId) break;
      const node = getNode(flow, id);
      if (!node || node.type === 'branch') break;
      id = node.nextId;
    }
  }
  return null;
}

/**
 * Walk the machine forward from `fromState` until `currentNodeId === targetNodeId`
 * (or until no progress). Used by the QA startAtNodeId seed to skip pre-beat
 * nodes (auth, mic) so a tester can jump straight to, e.g., the profile beat.
 * Each intermediate node is advanced with an empty capture (no data written);
 * a branch node is advanced with the path of the lane that contains the target
 * (so ?startAt=goals lands ON goals instead of skipping the beginner lane).
 * For merge-side targets (into-app, the weekly beats) no lane path applies, so
 * the walk passes the unanswered fork via the branchFallthrough opt-in (QA-walk
 * only; the machine's default contract holds at the fork). Pure; does not
 * mutate state. Returns the original state unchanged if the target node is not
 * reached (e.g. an unknown id), instead of a fully-walked, already-complete
 * machine.
 */
export function fastForwardToNode(
  flow: FlowDocument,
  fromState: FlowMachineState,
  targetNodeId: string,
): FlowMachineState {
  let st = fromState;
  for (let guard = 0; guard < 50; guard++) {
    if (st.currentNodeId === targetNodeId) return st;
    if (st.status === 'complete') break;
    const node = getNode(flow, st.currentNodeId);
    const cap: BeatCapture = { data: {} };
    if (node?.type === 'branch') {
      const laneValue = laneValueContaining(flow, node, targetNodeId);
      if (laneValue === 'simple' || laneValue === 'braindump') cap.path = laneValue;
    }
    const next = applyCapture(flow, st, cap, { branchFallthrough: true });
    if (next.currentNodeId === st.currentNodeId) break; // no progress
    st = next;
  }
  // Target never reached: seed at the entry instead of a burned-through flow.
  return fromState;
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
    case 'state-check': {
      // Tap capture saves data.checkin; the record_checkin voice tool saves
      // data.stateCheck. Replay whichever exists (never fabricate defaults — the
      // old morningCheckin proxy poisoned the morning-setup card's prefill).
      const d = (data ?? {}) as Record<string, unknown>;
      const checkin = d.stateCheck ?? d.checkin;
      if (checkin != null) out.data = { ...out.data, checkin } as BeatCapture['data'];
      break;
    }
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
 * Whether a server-derived capture actually proves the beat completed. A beat
 * that persists fields must replay at least one of them (or the fork's path)
 * before a server current_step climb may advance past it. Two failure classes
 * this gate closes: (1) B21, a bare step overshoot skipping the habit picker so
 * habit-select and habit-schedule rendered SIMULTANEOUSLY (an empty frozen card
 * next to the schedule card); (2) the branch node: the reflection save's climb
 * (7 to 8) landing AFTER the fork became active used to push an EMPTY capture
 * through the fork, which fell through to the merge node and ran the flow to
 * the end with path=null (the live jump-to-end past an unanswered fork). Beats
 * that persist nothing (why-intro, into-app, weekly projections) advance
 * freely. Pure, unit-tested; used ONLY by the live leading-edge advance (the
 * resume walk keeps its own pass-through semantics, see resumeFromServerRow).
 */
export function captureCompletesBeat(node: FlowNode | undefined, cap: BeatCapture): boolean {
  if (!node) return false;
  const persistsData = node.persist != null || (node.tool?.persistsFields?.length ?? 0) > 0;
  if (!persistsData) return true;
  if (cap.path) return true;
  return Object.keys(cap.data).length > 0;
}

/**
 * Completion evidence: did the server row prove this persist-bearing beat was
 * completed? `undefined` = the beat carries no evidence signal of its own
 * (display beats, the head auth/mic gates, and habit-schedule/advanced-frequency,
 * which share their field with the beat before them and so can never be proven
 * separately — resume conservatively stops there once the shared field exists).
 */
export function beatCompletionEvidence(
  node: FlowNode,
  data: OnboardingStepData,
): boolean | undefined {
  const d = data as Record<string, unknown>;
  switch (node.componentType) {
    case 'profile-input':
      // nickname is auto-seeded from sign-in at flow mount. The beat itself
      // collects age AND gender, and submit_profile saves partial fields, so
      // gender alone is NOT proof of completion (a voice user can state gender,
      // refresh, and resume past the beat with age missing forever). Require both.
      return d.age != null && d.gender != null;
    case 'state-check':
      return d.stateCheck != null || d.checkin != null;
    case 'morning-checkin-setup':
      return d.morningCheckin != null;
    case 'reflection-card':
      return d.reflectionConfig != null;
    case 'path-selection':
      return d.path === 'simple' || d.path === 'braindump' || d.path === 'advanced';
    case 'category-grid':
      return d.category != null;
    case 'goals-list':
      return Array.isArray(d.goals) && d.goals.length > 0;
    case 'habit-picker':
      return d.habitConfigs != null && Object.keys(d.habitConfigs as object).length > 0;
    case 'advanced-capture':
      return d.brainDumpText != null || d.brainDumpRaw != null;
    case 'habit-schedule':
    case 'advanced-frequency':
      // Shares habitConfigs with the beat before it — unprovable, never passed.
      return false;
    default:
      return undefined;
  }
}

/** Any persist-bearing beat reachable from `node` (both fork lanes) with evidence? */
function anyDownstreamEvidence(
  flow: FlowDocument,
  node: FlowNode,
  data: OnboardingStepData,
): boolean {
  const seen = new Set<string>();
  const queue: (string | null)[] = [];
  const pushNext = (n: FlowNode) => {
    if (n.type === 'branch') {
      for (const lane of n.lanes) queue.push(lane.entryNodeId);
      queue.push(n.mergeNodeId);
    } else {
      queue.push(n.nextId);
    }
  };
  pushNext(node);
  for (let guard = 0; guard < 100 && queue.length > 0; guard++) {
    const id = queue.shift();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const n = getNode(flow, id);
    if (!n) continue;
    if (n.persist && beatCompletionEvidence(n, data) === true) return true;
    pushNext(n);
  }
  return false;
}

/**
 * Fast-forward a fresh machine to the beat a refresh should land on.
 *
 * Evidence-first: walk the flow in order, replaying each beat's server capture
 * (answers populate, the fork resolves), and stop at the first persist-bearing
 * beat whose completion evidence is missing from the server row. The numeric
 * current_step CANNOT drive this walk on its own: persist steps run 1,6,7,8,
 * 2,3,4,5,5 in V3 flow order and the tap path pins current_step with GREATEST,
 * so every post-reflection row reads 8 forever (the old numeric-only walk found
 * no stop target and pushed the user to the end of the flow — B9).
 *
 * The numeric scale keeps ONE job: for serverStep 2..5 (an advance_step bare-set
 * or a voice back-nav, the only writers of those values under V3) the walk also
 * stops at the first beat whose ENTRY step reaches serverStep, so an intentional
 * back-nav survives a refresh even when all data exists.
 *
 * Head gates (auth, mic) always pass — on resume the user is authed and
 * mic-granted. Display beats pass only while some later beat has evidence;
 * otherwise they ARE the frontier and resume stops there (never skips unseen
 * content, never walks into 'complete'). Pure → unit-testable.
 */
export function resumeFromServerRow(
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
    const isHeadGate = node.componentType === 'auth' || node.componentType === 'mic-permission';
    if (!isHeadGate) {
      if (node.persist) {
        if (beatCompletionEvidence(node, data) !== true) break; // frontier: resume here
        const eStep = entryServerStep(node);
        if (serverStep >= 2 && serverStep <= 5 && eStep !== undefined && eStep >= serverStep) {
          break; // numeric back-nav intent
        }
      } else if (!anyDownstreamEvidence(flow, node, data)) {
        break; // display beat at the frontier
      }
    }
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

      // Check-in beats save via a tool, not the onboarding step path. The
      // adapter owns which tools it handles (onboarding omits saveTool: no-op).
      const toolSave = toolSaveFor(node, save);
      if (toolSave) persistence.saveTool?.(toolSave.toolName, cap.data);

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
  const startAtNodeIdRef = useRef(options?.startAtNodeId);
  const resumedRef = useRef(false);
  useEffect(() => {
    if (resumedRef.current) return;
    // QA startAt seeds the machine directly at a target node; the server resume
    // walk must not run at all in that mode, or the up-front nickname persist
    // (which creates a server row) lets the walk yank the machine off the seeded
    // beat (race-sensitive: seen as intermittently flashing past profile).
    if (startAtNodeIdRef.current) {
      resumedRef.current = true;
      return;
    }
    if (typeof serverStep !== 'number') return; // no server row (preview / not loaded yet)
    resumedRef.current = true;
    const resumed = resumeFromServerRow(
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

  // Baseline for the fork's evidence-arrival advance below: the path value the
  // server row already held when the branch node became active (null = none,
  // undefined = not yet observed). A back-nav to an already-answered fork must
  // not be yanked straight forward by its own stale answer.
  const forkEntryPathRef = useRef<OnboardingPath | null | undefined>(undefined);

  // Reset the per-beat baseline + fired-flag whenever the active beat changes, so
  // each beat judges advancement against the step seen on entry (not a prior
  // beat's) and a re-entered beat can advance again.
  useEffect(() => {
    baselineStepRef.current = null;
    advancedNodeRef.current = null;
    forkEntryPathRef.current = undefined;
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
    const cap = serverCaptureForBeat(node, (serverData ?? {}) as OnboardingStepData);
    // Data gate (parity with !400's B21 gate): a bare step climb must not push a
    // beat forward with a capture the server row cannot replay yet. At the branch
    // node this is the jump-to-end fix: under V3's non-monotonic persist steps a
    // pre-fork save (reflection, step 8) lands its climb AFTER the fork becomes
    // active, and the fork's own step (2) sits far below it — without the gate
    // that stale climb advanced the fork with an empty capture. The once-per-beat
    // latch is consumed only on a real advance, so a later row that does carry
    // the data still advances this beat.
    if (!captureCompletesBeat(node, cap)) return;
    advancedNodeRef.current = activeNodeId;
    applyAndAdvance(cap, false);
  }, [activeNodeId, serverStep, serverData, state.status, flow, applyAndAdvance]);

  // Answered-fork advance (evidence arrival, no climb required). The fork can be
  // answered with NO current_step movement at all: Vapi's submit_path_choice runs
  // server-side and writes the path column, but the tap path's GREATEST pin keeps
  // current_step at 8 (the pre-fork setup saves), so the leading-edge climb above
  // never fires at the fork (its step, 2, is already far below the pin). Realtime
  // still mirrors the row in — so at a branch node, advance the moment the row
  // holds a lane value that was NOT there when the fork became active. A card tap
  // advances synchronously in capture() and never reaches here; a pre-answered
  // fork (voice back-nav) records its stale answer as the entry baseline and
  // waits for the user.
  useEffect(() => {
    if (!activeNodeId || state.status === 'complete') return;
    if (typeof serverStep !== 'number') return; // no server row (preview / not loaded)
    const node = getNode(flow, activeNodeId);
    if (!node || node.type !== 'branch') return;
    const cap = serverCaptureForBeat(node, (serverData ?? {}) as OnboardingStepData);
    if (forkEntryPathRef.current === undefined) {
      forkEntryPathRef.current = cap.path ?? null;
      if (cap.path) return; // entered with an existing answer: back-nav, hold
    }
    if (!cap.path || cap.path === forkEntryPathRef.current) return;
    if (advancedNodeRef.current === activeNodeId) return; // fire once per beat
    advancedNodeRef.current = activeNodeId;
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
