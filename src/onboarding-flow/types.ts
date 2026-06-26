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
  | 'morning-checkin-setup'
  | 'reflection-card'
  | 'plan-cards'
  | 'into-app'
  | 'coach-bubble';

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
  tool: ToolConfig | null;
  /** null = capture-only beat that advances without a save (e.g. mic permission). */
  persist: PersistConfig | null;
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
  tool: ToolConfig | null;
  persist: PersistConfig | null;
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
