/**
 * Flow document schema — the contract between the flow builder's export and the
 * in-app onboarding engine.
 *
 * Mirrors `gg-spec/docs/flow-builder-export-spec.md` (BeatNode / BranchNode /
 * ContextBlock / VoiceConfig / ToolConfig), with one app-side addition:
 * `persist`, which tells the orchestrator how to save a beat's captured answer
 * by reusing the existing `useOnboarding().saveStep` path.
 *
 * The builder currently exports a thinner per-beat shape
 * ({ beat, name, componentType, context, props }); the richer schema here is the
 * TARGET the renderer consumes. A future transform maps builder export -> this
 * document. See README.md in this folder.
 */
import type { OnboardingPath, OnboardingStepData } from '@gg/shared/types';

/** The per-screen coach instructions, inlined into the flow (from the beats sheet). */
export interface ContextBlock {
  screenId: string;
  screenName: string;
  /** Raw text injected into the coach system prompt for this beat. */
  contextBlock: string;
  /** SHA of contextBlock, for cache busting. Optional. */
  contentHash?: string;
}

export interface VoiceConfig {
  /** First coach line spoken on beat mount. null = no opener. */
  openerText: string | null;
  /** true = coach waits for user speech / input before advancing. */
  expectsInput: boolean;
  /** false = Vapi-only (e.g. mic permission). */
  directLlmAllowed: boolean;
}

export interface BeatRuntimeMeta {
  voiceOut: {
    engine: 'mp3' | 'cartesia' | 'vapi' | 'none';
    mode: 'verbatim' | 'generative';
    voiceId?: string;
    mp3Assets?: Array<{
      id?: string;
      label: string;
      file: string;
      transcript: string;
      opener?: string;
      elementId?: string;
      timing?: 'opener' | 'element' | 'full-beat';
    }>;
    lines?: Array<{
      id: string;
      elementId?: string;
      text: string;
      voiceOnly?: boolean;
      onScreen?: boolean;
      engine?: 'mp3' | 'cartesia' | 'vapi' | 'none';
      assetRef?: string;
    }>;
  };
  voiceIn: {
    engine: 'soniox' | 'vapi' | 'none';
    enabled: boolean;
    micRequired?: boolean;
    armOnBeatLoad?: boolean;
  };
  fill: {
    brain: 'direct-llm' | 'vapi' | 'none';
    llmActive: boolean;
    allowedTools: string[];
  };
  path: 'path-1-vapi' | 'path-2-async' | 'path-3-direct-llm';
  orb: {
    voiceOn?: boolean;
    micOn?: boolean;
    micAsking?: boolean;
    bloomed?: boolean;
  };
  toggles: {
    expectsInput: boolean;
    directLlmAllowed: boolean;
    instantOpenerEligible?: boolean;
    suppressVapiDuringMp3?: boolean;
    continueVapiAfterMp3?: boolean;
    autoplayRequiresUnlock?: boolean;
    qaForceEngineAllowed?: boolean;
  };
  engine?: {
    nodeId?: string;
    backId?: string;
    persistStep?: number | null;
    pathField?: boolean;
    captureFields?: string[];
    toolName?: string;
    toolAdvancesStep?: boolean;
    toolPersistsFields?: string[];
    maxSelections?: number;
    optionSource?: string;
  };
  authoring?: {
    figmaNode?: string;
    status?: 'draft' | 'ready' | 'locked';
    notes?: string;
    feedbackConfig?: string;
    animation?: string;
  };
}

export interface ToolConfig {
  /** Matches a tool name in api/_lib/llm/tools.onboarding.ts. */
  toolName: string;
  /** Keys written into onboarding_states.data (migration safety). */
  persistsFields: string[];
  /** true = firing this tool advances the step counter. */
  advancesStep: boolean;
}

/**
 * App-side persistence descriptor. Drives the orchestrator's reuse of the old
 * Step pages' save path. `step` is the integer passed to saveStep(step, data).
 * `pathField` marks the fork beat, whose captured value is the onboarding path
 * (passed via saveStep options.path, not into the data payload).
 */
export interface PersistConfig {
  step: number;
  pathField?: boolean;
}

/**
 * One ordered segment of a beat's narration script (the STEP-0 schema contract,
 * onboarding-consolidation-plan-2026-07-06). The segments sequence INSIDE one
 * beat, in array order:
 *   - kind 'bubble': a coach speech bubble; `say` types in sync with the audio.
 *   - kind 'reveal': the beat's nth card/element blooms; `say`, when present, is
 *     spoken verbal-only (never drawn as a bubble). Empty `say` = visual-only.
 * `n` is the 1-based index within the segment's kind (bubble 1..N, reveal 1..N;
 * reveal 99 = "all remaining elements at once", the render's convention).
 * `clip` is an MP3-verbatim ref: clip present = play the recorded file (plus its
 * caption file when one exists); no clip = live TTS (only the name greeting) or
 * silent. Beats without narration keep the single-opener behavior unchanged.
 */
export interface NarrationSegment {
  kind: 'bubble' | 'reveal';
  n: number;
  say?: string;
  clip?: string;
}

/** All componentType keys the renderer registry knows how to mount. */
export type FlowComponentType =
  | 'auth'
  | 'mic-permission'
  | 'profile-input'
  | 'path-selection'
  | 'primary-button'
  | 'category-grid'
  | 'goals-list'
  | 'habit-picker'
  | 'habit-schedule'
  | 'advanced-capture'
  | 'advanced-frequency'
  | 'morning-checkin-setup'
  | 'reflection-card'
  | 'weekly-day-picker'
  | 'plan-cards'
  | 'into-app'
  | 'why-intro'
  | 'weekly-projection'
  // Create-your-own goal/habit name-it screens (props.kind: 'goal' | 'habit').
  | 'custom-entry'
  // Check-in flow component types (morning + evening check-in documents).
  | 'state-check'
  | 'habit-review'
  | 'reflection'
  | 'coach-bubble'
  // Home-tour flow component type. Exists in the flow designer (beats/homeTour.tsx)
  // but the engine adapter is not yet in componentRegistry.tsx -- deferred to the
  // app-shell workstream (HANDOFF-app-shell-and-flow-order.md).
  | 'home-tour'
  // The Weekly flow document: the real week-grid beat, fed by useWeekData.
  | 'weekly-habits-summary';

export interface BeatNode {
  id: string;
  type: 'beat';
  beatNumber: number;
  name: string;
  /** Canonical screen ID used in session logs + screen_contexts (e.g. "ONBOARD-01--FORM"). */
  screenId: string;
  /** ID of the next node; null = end of flow. */
  nextId: string | null;
  /** ID of the node the back action returns to; null = no back. */
  backId: string | null;
  context: ContextBlock;
  componentType: FlowComponentType;
  componentProps: Record<string, unknown>;
  voice: VoiceConfig;
  meta?: BeatRuntimeMeta;
  tool: ToolConfig | null;
  /** null = capture-only beat that advances without a save (e.g. mic permission). */
  persist: PersistConfig | null;
  /** Ordered bubble/reveal script inside this beat; absent = single-opener beat. */
  narration?: NarrationSegment[];
  /** Authoring variant tag (e.g. 'female' = the women's art switch); render-time
   * concern on the SAME screenId, never a separate screen (Yair-ruled 2026-07-06). */
  variant?: string;
  /** true = suppress the docked orb on this beat (the component draws its own). */
  hideOrb?: boolean;
  /** true = the component owns its audio/orb sequence (greeting, mic); the
   * narration driver must not double-play it. */
  componentOwned?: boolean;
}

export interface BranchLane {
  /** The enum value to match, e.g. "simple" or "braindump". */
  value: string;
  label: string;
  entryNodeId: string;
  exitNodeId: string;
}

export interface BranchCondition {
  /** Dot-path into the runtime answers, e.g. "answers.path". */
  source: string;
  type: 'enum-match';
}

export interface BranchNode {
  id: string;
  type: 'branch';
  name: string;
  screenId: string;
  condition: BranchCondition;
  lanes: BranchLane[];
  /** Node the renderer jumps to when any lane finishes (linear nextId chaining). */
  mergeNodeId: string;
  context: ContextBlock;
  componentType: FlowComponentType;
  componentProps: Record<string, unknown>;
  voice: VoiceConfig;
  meta?: BeatRuntimeMeta;
  tool: ToolConfig | null;
  persist: PersistConfig | null;
  /** Same presentation contract as BeatNode (the fork beat narrates too). */
  narration?: NarrationSegment[];
  variant?: string;
  hideOrb?: boolean;
  componentOwned?: boolean;
}

export type FlowNode = BeatNode | BranchNode;

export interface FlowDocument {
  flowId: string;
  name: string;
  version: number;
  publishedAt: string;
  entryNodeId: string;
  nodes: FlowNode[];
}

/**
 * Accumulated user answers, held across the whole conversation (the fix for the
 * original per-screen-reset bug). OnboardingStepData already carries `path`.
 */
export type FlowAnswers = Partial<OnboardingStepData>;

/**
 * What a beat's card hands back when its data is captured. `data` is merged into
 * answers and passed to saveStep; `path` (fork only) routes via saveStep options.
 */
export interface BeatCapture {
  data: Partial<OnboardingStepData>;
  path?: OnboardingPath;
}
