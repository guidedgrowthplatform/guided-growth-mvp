/**
 * The TRANSFORM: designer source of truth -> engine FlowDocument.
 *
 * Reads the designer's flat DEFAULT_FLOW array (mirrored in ./designerSource.ts
 * from ggmvp-flow-builder FlowBuilder.tsx) and emits the engine's FlowDocument
 * (../types.ts) that the orchestrator + renderer already consume. Running this
 * regenerates flows/onboarding-beginner-v1.generated.json; changing the designer
 * and re-running regenerates it. See ../flows/README-flow-sync.md.
 *
 * WHY a table on top of the flat array. The designer array is presentation-first:
 * an ordered list of beats with a type, a coach line, and a sheet stage. The
 * engine needs three things the flat array does not carry: (1) the fork as a real
 * BranchNode with lanes + a merge, (2) per-beat persist + tool config (which step
 * each save writes, which LLM tool fires), (3) the synthesized advanced lane beat.
 * Those are stable ENGINE facts keyed by the designer component type, so they live
 * in ENGINE_BEAT_SPECS below. The designer owns order, type, opener, screenId, and
 * componentProps; the engine table owns structure, persistence, and tools. This
 * keeps a designer edit a data edit while the engine contract stays type-safe.
 *
 * NO EM DASHES. Pure module, no React, no IO; the script wrapper writes the file.
 */
import type {
  BeatNode,
  BranchNode,
  FlowComponentType,
  FlowDocument,
  FlowNode,
  PersistConfig,
  ToolConfig,
  VoiceConfig,
} from '../types';
import type { DesignerBeat } from './designerSource';

/** designer `type` -> engine `componentType`. Unmapped types are skipped (intro). */
const TYPE_TO_COMPONENT: Record<string, FlowComponentType | null> = {
  // Intro beats render via IntroGate, not as engine nodes. Skipped (null).
  splash: null,
  'get-started': null,
  'splash-intro': null,
  // Real onboarding beats.
  'auth-signup': 'auth',
  'mic-permission': 'mic-permission',
  'profile-beat': 'profile-input',
  // V3: why-intro, state-check, morning-checkin-setup, reflection-card all appear
  // before the path fork now.
  'why-intro': 'why-intro',
  'state-check': 'state-check',
  'morning-checkin-setup': 'morning-checkin-setup',
  'reflection-card': 'reflection-card',
  'path-selection': 'path-selection',
  'category-grid': 'category-grid',
  'goals-list': 'goals-list',
  'habit-picker': 'habit-picker',
  'habit-schedule': 'habit-schedule',
  // Advanced lane: capture then frequency.
  'advanced-capture': 'advanced-capture',
  'advanced-frequency': 'advanced-frequency',
  // V3: plan-cards dropped; into-app is the single convergence point.
  'plan-cards': null,
  'into-app': 'into-app',
  // Five weekly-projection beats appended after into-app.
  'weekly-projection': 'weekly-projection',
};

/**
 * The engine facts the flat designer array cannot express, keyed by designer type.
 * Stable per component type, not per-flow content. The transform layers these onto
 * the designer beat to build a full engine node.
 */
interface EngineBeatSpec {
  /** Stable node id in the engine graph (the orchestrator + tests key off this). */
  nodeId: string;
  /** The engine's beatNumber (its own numbering, NOT the designer beat string). */
  beatNumber: number;
  /** Node the back action returns to in the engine graph; null = no back. */
  backId: string | null;
  /** Fallback screenId when the designer beat carries no sheetStage. */
  screenId: string;
  /** Static componentProps the engine card needs (designer props merge on top). */
  componentProps: Record<string, unknown>;
  voice: VoiceConfig;
  tool: ToolConfig | null;
  persist: PersistConfig | null;
  /** Inlined coach context block (vestigial; canonical copy is beatContexts.ts). */
  contextBlock: string;
  screenName: string;
  /**
   * Beats whose canonical opener is fuller than the designer's greeting/coachLine
   * keep the engine opener verbatim (profile: the greeting prop is only the first
   * sentence). For the rest, the designer coachLine drives the opener.
   */
  openerFromEngine?: boolean;
}

// Not every FlowComponentType the engine declares appears in the onboarding flow
// (e.g. 'primary-button' is a registry option the DEFAULT_FLOW does not use), so
// this is a partial map. Lookups for an unmapped type are guarded in the builder.
const ENGINE_BEAT_SPECS: Partial<Record<FlowComponentType, EngineBeatSpec>> = {
  auth: {
    nodeId: 'auth',
    beatNumber: 0,
    backId: null,
    screenId: 'ONBOARD-AUTH--FORM',
    componentProps: {},
    voice: { openerText: null, expectsInput: false, directLlmAllowed: false },
    tool: null,
    persist: null,
    screenName: 'Auth',
    contextBlock: 'Sign-in beat; captures the user name. Coach stays silent (see beatContexts).',
  },
  'mic-permission': {
    nodeId: 'mic',
    beatNumber: 0,
    backId: null,
    screenId: 'MIC-PERMISSION',
    componentProps: {
      heading: 'Allow your microphone',
      sub: 'So you can talk with your coach out loud.',
      allowLabel: 'Allow microphone',
      skipLabel: 'Not now',
    },
    voice: {
      openerText: 'Allow your microphone so you can talk with your coach out loud.',
      expectsInput: false,
      directLlmAllowed: false,
    },
    tool: null,
    persist: null,
    screenName: 'Mic Permission',
    contextBlock:
      'Ask permission to use the microphone so the user can talk out loud. If they allow, continue warmly. If not now, continue without pushing.',
  },
  'profile-input': {
    nodeId: 'profile',
    beatNumber: 1,
    backId: 'mic',
    openerFromEngine: true,
    screenId: 'ONBOARD-01--FORM',
    componentProps: {
      fields: ['age', 'gender'],
      genderOptions: ['Male', 'Female', 'Other'],
      ageRange: { min: 13, max: 120 },
    },
    voice: {
      openerText:
        "Awesome {name}, two quick things so I can tailor this to you. How old are you? And what's your gender?",
      expectsInput: true,
      directLlmAllowed: true,
    },
    tool: {
      toolName: 'submit_profile',
      persistsFields: ['age', 'gender', 'nickname'],
      advancesStep: true,
    },
    persist: { step: 1 },
    screenName: 'Profile',
    contextBlock: 'Profile beat: age + gender only. Name comes from auth (see beatContexts).',
  },
  // V3 new: state-check, the first check-in performed during onboarding.
  'state-check': {
    nodeId: 'state-check',
    beatNumber: 2,
    backId: 'why-intro',
    screenId: 'ONBOARD-STATE-CHECK',
    componentProps: {},
    voice: {
      openerText:
        "Let's do your first check-in right now. How are you landing in this moment? Mood, energy, sleep, anything on you.",
      expectsInput: true,
      directLlmAllowed: true,
    },
    tool: { toolName: 'record_checkin', persistsFields: ['checkin'], advancesStep: true },
    persist: { step: 6 },
    screenName: 'First State Check',
    contextBlock:
      'The user does their very first check-in right now. Four dimensions: mood, energy, sleep, stress. Accept spoken or tapped answers. Do not over-explain; keep it brief and warm.',
  },
  'path-selection': {
    nodeId: 'path-fork',
    beatNumber: 0,
    backId: 'reflection-setup',
    screenId: 'ONBOARD-FORK--FORM',
    componentProps: {
      bindsTo: 'path',
      options: [
        {
          value: 'simple',
          label: "I'm new to habit tracking",
          description: "I'll help you step by step",
        },
        {
          value: 'braindump',
          label: 'I already have experience',
          description: "Tell me your habits and I'll organize them",
        },
      ],
    },
    voice: {
      openerText: 'Have you tracked habits before, or is this new for you?',
      expectsInput: true,
      directLlmAllowed: true,
    },
    tool: { toolName: 'submit_path_choice', persistsFields: ['path'], advancesStep: false },
    persist: { step: 2, pathField: true },
    screenName: 'Path Choice',
    contextBlock:
      'Ask how they like to work: you can guide them step by step, or they can tell you everything on their mind and you organize it. Record their choice and continue. Do not explain the difference unless they ask.',
  },
  'category-grid': {
    nodeId: 'category',
    beatNumber: 4,
    backId: 'path-fork',
    screenId: 'ONBOARD-BEGINNER-01',
    componentProps: { maxSelections: 1, optionSource: 'categories' },
    voice: {
      openerText: 'What part of your life do you most want to grow right now?',
      expectsInput: true,
      directLlmAllowed: true,
    },
    tool: { toolName: 'submit_category', persistsFields: ['category'], advancesStep: true },
    persist: { step: 3 },
    screenName: 'Focus Area',
    contextBlock:
      'The user picks one life area to focus on first. React to the one they choose, specifically. Do not pick for them.',
  },
  'goals-list': {
    nodeId: 'goals',
    beatNumber: 5,
    backId: 'category',
    screenId: 'ONBOARD-BEGINNER-02',
    componentProps: { maxSelections: 2, optionSource: 'goalsByCategory' },
    voice: {
      openerText: 'Which of these feels most true for you?',
      expectsInput: true,
      directLlmAllowed: true,
    },
    tool: { toolName: 'submit_goals', persistsFields: ['goals'], advancesStep: true },
    persist: { step: 4 },
    screenName: 'Goals',
    contextBlock:
      'Narrow the focus area into one or two specific goals. Keep it to two at most so they are not overwhelmed.',
  },
  'habit-picker': {
    nodeId: 'habit-select',
    beatNumber: 6,
    backId: 'goals',
    screenId: 'ONBOARD-BEGINNER-03',
    componentProps: { maxPerGoal: 2, optionSource: 'habitsByGoal' },
    voice: {
      openerText: "Here are a few habits that fit. Pick the ones you'll actually do.",
      expectsInput: true,
      directLlmAllowed: true,
    },
    tool: { toolName: 'add_habit', persistsFields: ['habits'], advancesStep: false },
    persist: { step: 5 },
    screenName: 'Habit Selection',
    contextBlock:
      'Help them pick up to two small daily habits to start with. Small and doable beats ambitious. They can always add more later.',
  },
  'habit-schedule': {
    nodeId: 'habit-schedule',
    beatNumber: 7,
    backId: 'habit-select',
    screenId: 'ONBOARD-BEGINNER-04',
    componentProps: { showDayPicker: true, showReminderToggle: true },
    voice: {
      openerText: 'When will you do these? Set a time and how often.',
      expectsInput: true,
      directLlmAllowed: true,
    },
    tool: { toolName: 'update_habit', persistsFields: ['habitConfigs'], advancesStep: true },
    persist: { step: 5 },
    screenName: 'Habit Schedule',
    contextBlock:
      'For each habit they chose, set when they will do it: a time, which days, and whether they want a reminder. Parse combined answers when you can. Ask only for the piece that is missing.',
  },
  // The advanced (braindump) lane's capture beat. Routes on the braindump lane
  // and continues to advanced-frequency before rejoining at into-app.
  'advanced-capture': {
    nodeId: 'advanced-input',
    beatNumber: 4,
    backId: 'path-fork',
    screenId: 'ONBOARD-ADVANCED',
    componentProps: {
      brainDump: true,
      placeholder: 'Tell me everything on your mind, what you want to build, drop, or change.',
    },
    voice: {
      openerText: "Read me the habits you already track. Less is more to start, you can always build on it.",
      expectsInput: true,
      directLlmAllowed: true,
    },
    tool: { toolName: 'submit_brain_dump', persistsFields: ['brainDumpText'], advancesStep: true },
    persist: { step: 3 },
    screenName: 'Brain Dump',
    contextBlock:
      'The user wants to tell you everything on their mind at once. Let them. Listen for the habits and goals inside it; do not interrupt with structure yet.',
  },
  // V3 new: advanced frequency, the day-picker step after the braindump capture.
  'advanced-frequency': {
    nodeId: 'advanced-frequency',
    beatNumber: 5,
    backId: 'advanced-input',
    screenId: 'ONBOARD-ADVANCED-FREQUENCY',
    componentProps: {},
    voice: {
      openerText: "Now the days. Tell me how often each one runs and I'll fill them in.",
      expectsInput: true,
      directLlmAllowed: true,
    },
    tool: { toolName: 'update_habit', persistsFields: ['habitConfigs'], advancesStep: true },
    persist: { step: 4 },
    screenName: 'Habit Days',
    contextBlock:
      'For each habit in the braindump, set how often it runs. Parse spoken answers when you can. Ask only for missing pieces.',
  },
  // V3: morning-checkin-setup and reflection-card appear BEFORE the path fork.
  'morning-checkin-setup': {
    nodeId: 'morning-checkin-setup',
    beatNumber: 3,
    backId: 'state-check',
    screenId: 'ONBOARD-MORNING-SETUP',
    componentProps: { showDayPicker: true, showReminderToggle: true },
    voice: {
      openerText: "When do you want this each day? I'll nudge you then.",
      expectsInput: true,
      directLlmAllowed: true,
    },
    tool: {
      toolName: 'submit_morning_checkin',
      persistsFields: ['morningCheckin'],
      advancesStep: true,
    },
    persist: { step: 7 },
    screenName: 'Morning Check-in',
    contextBlock:
      'Set up a short morning check-in: when they want the nudge, which days, and whether they want a reminder. Keep it light, a quick way to start the day with intention.',
  },
  'reflection-card': {
    nodeId: 'reflection-setup',
    beatNumber: 3,
    backId: 'morning-checkin-setup',
    screenId: 'ONBOARD-BEGINNER-07',
    componentProps: { showDayPicker: true, showReminderToggle: true, showModePicker: true },
    voice: {
      openerText:
        'One more. An evening reflection, a couple of minutes to close the day. How do you want to do it, and when?',
      expectsInput: true,
      directLlmAllowed: true,
    },
    tool: {
      toolName: 'submit_reflection_config',
      persistsFields: ['reflectionConfig'],
      advancesStep: true,
    },
    persist: { step: 8 },
    screenName: 'Reflection Setup',
    contextBlock:
      'Set up a short evening reflection: when, which days, whether they want a reminder, and the style (guided prompts, custom prompts, or freeform). Frame it as a moment for their mind, not a chore.',
  },
  // V3: into-app is the single convergence point for both paths (plan-cards dropped).
  // No tool: the engine does not need to fire confirm_plan; completion is detected
  // when the machine reaches a null nextId after walking through weekly-projections.
  'into-app': {
    nodeId: 'into-app',
    beatNumber: 9,
    backId: null,
    screenId: 'ONBOARD-COMPLETE',
    componentProps: {},
    voice: {
      openerText:
        "Here's your plan. Your check-in, your reflection, and the habits you picked. Want to start here, or change anything first?",
      expectsInput: false,
      directLlmAllowed: true,
    },
    tool: null,
    persist: null,
    screenName: 'Into the App',
    contextBlock:
      'Onboarding is done. Warmly tell the user they are all set and take them in. Do not collect anything else.',
  },
  // V3 new: why-intro, a coach-only framing beat before the first check-in.
  'why-intro': {
    nodeId: 'why-intro',
    beatNumber: 2,
    backId: 'profile',
    screenId: 'ONBOARD-WHY-INTRO',
    componentProps: {},
    voice: {
      openerText:
        "Here's the idea. The first habit isn't a workout or a diet. It's just checking in with yourself. It takes a minute, and it changes everything else. Let's start yours right now.",
      expectsInput: false,
      directLlmAllowed: false,
    },
    tool: null,
    persist: null,
    screenName: 'Why Intro',
    contextBlock:
      'A short coach framing: the first habit is a check-in, not a workout. Frame it warmly and move on.',
  },
  // V3 new: weekly-projection, five frames shown in sequence after into-app.
  // Each frame is a separate beat with a state prop ('blank'|'full'|'p78'|'p36'|'gaps').
  // The adapter auto-advances after the MP3 plays. The ENGINE_BEAT_SPECS here is
  // shared across all five frames; the transform produces five distinct nodes by
  // consuming all five designer beats of this type in sequence.
  'weekly-projection': {
    nodeId: 'weekly-projection',
    beatNumber: 10,
    backId: null,
    screenId: 'ONBOARD-WEEKLY-PROJECTION-BLANK',
    componentProps: { state: 'blank' },
    voice: {
      openerText: 'This is your week. Blank, starting today.',
      expectsInput: false,
      directLlmAllowed: false,
    },
    tool: null,
    persist: null,
    screenName: 'Weekly Projection',
    contextBlock:
      'A visual projection of the habit week. Show five states in sequence; no user input needed.',
  },
};

/**
 * V3 fork: the engine forks at path-selection into:
 *   - beginner lane: category -> goals -> habit-select -> habit-schedule
 *   - advanced lane: advanced-input -> advanced-frequency
 * Both lanes merge at into-app (plan-review is dropped in v3).
 *
 * Before the fork (shared spine): auth -> mic -> profile -> why-intro ->
 *   state-check -> morning-checkin-setup -> reflection-setup -> path-fork.
 * After the merge (shared spine): into-app -> weekly-projection x5.
 */
const FORK_LANES = [
  { value: 'simple', label: 'Beginner', entryNodeId: 'category', exitNodeId: 'habit-schedule' },
  {
    value: 'braindump',
    label: 'Advanced',
    entryNodeId: 'advanced-input',
    exitNodeId: 'advanced-frequency',
  },
] as const;
const FORK_MERGE_NODE_ID = 'into-app';
const FORK_CONDITION_SOURCE = 'answers.path';
// Designer component types that back the advanced lane nodes. Both are pulled
// out of the linear spine and handled in a dedicated pass (pass 2).
const ADVANCED_LANE_COMPONENTS: FlowComponentType[] = ['advanced-capture', 'advanced-frequency'];

export interface TransformOptions {
  flowId?: string;
  name?: string;
  version?: number;
  publishedAt?: string;
}

const DEFAULTS: Required<TransformOptions> = {
  flowId: 'onboarding-beginner-v1',
  name: 'Beginner Onboarding',
  version: 1,
  publishedAt: '2026-06-23T00:00:00Z',
};

/** Look up the engine spec for a component type, asserting it exists. */
function specFor(component: FlowComponentType): EngineBeatSpec {
  const spec = ENGINE_BEAT_SPECS[component];
  if (!spec) throw new Error(`designerToFlow: no engine spec for componentType "${component}"`);
  return spec;
}

/** Pull the screenId out of a "SCREEN-ID: Label" sheetStage string. */
function screenIdFromSheetStage(sheetStage: string | undefined): string | undefined {
  if (!sheetStage) return undefined;
  const [id] = sheetStage.split(':');
  const trimmed = id?.trim();
  return trimmed || undefined;
}

/**
 * Resolve the opener for a beat. Beats flagged openerFromEngine keep the engine's
 * canonical opener verbatim (profile: the designer greeting is only the first
 * sentence). Otherwise the designer coachLine drives the opener, falling back to
 * the engine opener when the designer authored none.
 */
function resolveOpener(beat: DesignerBeat | undefined, spec: EngineBeatSpec): string | null {
  if (spec.openerFromEngine) return spec.voice.openerText;
  const coachLine = beat?.props?.coachLine;
  const greeting = beat?.props?.greeting;
  return coachLine ?? greeting ?? spec.voice.openerText;
}

/**
 * Transform the designer flow into the engine FlowDocument.
 *
 * V3 graph topology (beats in node order):
 *   auth -> mic -> profile -> why-intro -> state-check ->
 *   morning-checkin-setup -> reflection-setup -> path-fork ->
 *     [beginner lane] category -> goals -> habit-select -> habit-schedule
 *     [advanced lane] advanced-input -> advanced-frequency
 *   -> into-app ->
 *   weekly-projection-blank -> weekly-projection-full -> weekly-projection-p78
 *   -> weekly-projection-p36 -> weekly-projection-gaps
 *
 * Built in four passes:
 *   1. Map each designer beat to a component type in spine order. Skip:
 *      intro types (null mapping), advanced-lane types, weekly-projection types.
 *   2. Build each spine node, turning path-selection into a BranchNode.
 *   3. Build the two advanced-lane nodes (advanced-input, advanced-frequency),
 *      chained to each other with advanced-frequency -> into-app.
 *   4. Build the five weekly-projection nodes from the five designer beats,
 *      chaining them blank -> full -> p78 -> p36 -> gaps -> null.
 *   5. Assemble all nodes in canonical order.
 */
export function designerToFlowDocument(
  designerFlow: DesignerBeat[],
  options: TransformOptions = {},
): FlowDocument {
  const opts = { ...DEFAULTS, ...options };

  // Collect all designer beats of a given designer type in authoring order.
  const beatsByDesignerType = new Map<string, DesignerBeat[]>();
  for (const beat of designerFlow) {
    const arr = beatsByDesignerType.get(beat.type) ?? [];
    arr.push(beat);
    beatsByDesignerType.set(beat.type, arr);
  }
  // First designer beat for each type (opener + screenId lookup for non-multi types).
  const firstByDesignerType = new Map<string, DesignerBeat>();
  for (const [type, beats] of beatsByDesignerType) firstByDesignerType.set(type, beats[0]);

  // Resolve a designer beat to its component type (null = skip).
  const componentFor = (type: string): FlowComponentType | null =>
    TYPE_TO_COMPONENT[type] ?? null;

  // Pass 1: spine component types in order. Skip: null-mapped, advanced-lane,
  // weekly-projection (all handled in dedicated passes).
  const SKIP_IN_SPINE = new Set<FlowComponentType>([
    ...ADVANCED_LANE_COMPONENTS,
    'weekly-projection',
  ]);
  const spineComponents: FlowComponentType[] = [];
  // Track which designer types we have seen to avoid duplicates (multiple designer
  // beats of the same type, e.g. weekly-projection, must not appear in the spine).
  const seenDesignerTypes = new Set<string>();
  for (const beat of designerFlow) {
    if (seenDesignerTypes.has(beat.type)) continue;
    seenDesignerTypes.add(beat.type);
    const component = componentFor(beat.type);
    if (component == null) continue; // null-mapped
    if (SKIP_IN_SPINE.has(component)) continue;
    if (!ENGINE_BEAT_SPECS[component]) continue; // no spec
    spineComponents.push(component);
  }

  // Spine node IDs in order (for nextId chaining).
  const spineNodeIds = spineComponents.map((c) => specFor(c).nodeId);

  // First designer beat for each engine component type. A component may be reached
  // by multiple designer types (unlikely) or multiple beats of the same type; we
  // want the first one in authoring order.
  const firstDesignerBeatByComponent = new Map<FlowComponentType, DesignerBeat>();
  for (const beat of designerFlow) {
    const component = componentFor(beat.type);
    if (component && !firstDesignerBeatByComponent.has(component)) {
      firstDesignerBeatByComponent.set(component, beat);
    }
  }

  // Pass 2: build spine nodes.
  const nodeById = new Map<string, FlowNode>();

  spineComponents.forEach((component, i) => {
    const spec = specFor(component);
    const designerBeat = firstDesignerBeatByComponent.get(component);
    const screenId = screenIdFromSheetStage(designerBeat?.sheetStage) ?? spec.screenId;
    const opener = resolveOpener(designerBeat, spec);
    const componentProps = { ...spec.componentProps };
    const baseVoice: VoiceConfig = { ...spec.voice, openerText: opener };
    const context = { screenId, screenName: spec.screenName, contextBlock: spec.contextBlock };

    // The next spine node (null when we are at path-fork, which diverges into lanes).
    // The merge node (into-app) follows naturally at the end of the shared spine.
    const nextId = i < spineNodeIds.length - 1 ? spineNodeIds[i + 1] : null;

    if (component === 'path-selection') {
      const branch: BranchNode = {
        id: spec.nodeId,
        type: 'branch',
        name: 'Path Fork',
        screenId,
        condition: { source: FORK_CONDITION_SOURCE, type: 'enum-match' },
        lanes: FORK_LANES.map((l) => ({ ...l })),
        mergeNodeId: FORK_MERGE_NODE_ID,
        context,
        componentType: component,
        componentProps,
        voice: baseVoice,
        tool: spec.tool,
        persist: spec.persist,
      };
      nodeById.set(spec.nodeId, branch);
      return;
    }

    const node: BeatNode = {
      id: spec.nodeId,
      type: 'beat',
      beatNumber: spec.beatNumber,
      name: spec.screenName,
      screenId,
      nextId,
      backId: spec.backId,
      context,
      componentType: component,
      componentProps,
      voice: baseVoice,
      tool: spec.tool,
      persist: spec.persist,
    };
    nodeById.set(spec.nodeId, node);
  });

  // Pass 3: advanced lane nodes. Two nodes: advanced-input -> advanced-frequency.
  // advanced-input backId = path-fork (from spec).
  // advanced-frequency nextId = into-app (FORK_MERGE_NODE_ID), backId = advanced-input.
  const advCaptureDesigner = firstDesignerBeatByComponent.get('advanced-capture');
  const advCaptureSpec = specFor('advanced-capture');
  const advCaptureScreenId =
    screenIdFromSheetStage(advCaptureDesigner?.sheetStage) ?? advCaptureSpec.screenId;
  const advCaptureNode: BeatNode = {
    id: advCaptureSpec.nodeId,
    type: 'beat',
    beatNumber: advCaptureSpec.beatNumber,
    name: 'Brain Dump (Advanced)',
    screenId: advCaptureScreenId,
    nextId: 'advanced-frequency',
    backId: advCaptureSpec.backId,
    context: {
      screenId: advCaptureScreenId,
      screenName: advCaptureSpec.screenName,
      contextBlock: advCaptureSpec.contextBlock,
    },
    componentType: 'advanced-capture',
    componentProps: { ...advCaptureSpec.componentProps },
    voice: { ...advCaptureSpec.voice, openerText: resolveOpener(advCaptureDesigner, advCaptureSpec) },
    tool: advCaptureSpec.tool,
    persist: advCaptureSpec.persist,
  };

  const advFreqDesigner = firstDesignerBeatByComponent.get('advanced-frequency');
  const advFreqSpec = specFor('advanced-frequency');
  const advFreqScreenId =
    screenIdFromSheetStage(advFreqDesigner?.sheetStage) ?? advFreqSpec.screenId;
  const advFreqNode: BeatNode = {
    id: advFreqSpec.nodeId,
    type: 'beat',
    beatNumber: advFreqSpec.beatNumber,
    name: 'Habit Days (Advanced)',
    screenId: advFreqScreenId,
    nextId: FORK_MERGE_NODE_ID,
    backId: 'advanced-input',
    context: {
      screenId: advFreqScreenId,
      screenName: advFreqSpec.screenName,
      contextBlock: advFreqSpec.contextBlock,
    },
    componentType: 'advanced-frequency',
    componentProps: { ...advFreqSpec.componentProps },
    voice: { ...advFreqSpec.voice, openerText: resolveOpener(advFreqDesigner, advFreqSpec) },
    tool: advFreqSpec.tool,
    persist: advFreqSpec.persist,
  };

  // Pass 4: five weekly-projection nodes, one per designer beat, chained in order.
  const projectionDesignerBeats = beatsByDesignerType.get('weekly-projection') ?? [];
  const projectionNodeIds = projectionDesignerBeats.map(
    (_, idx) => `weekly-projection-${['blank', 'full', 'p78', 'p36', 'gaps'][idx] ?? String(idx)}`,
  );
  const projectionNodes: BeatNode[] = projectionDesignerBeats.map((beat, idx) => {
    const spec = specFor('weekly-projection');
    const screenId = screenIdFromSheetStage(beat.sheetStage) ?? spec.screenId;
    const opener = resolveOpener(beat, spec);
    const state = beat.props?.state ?? 'blank';
    return {
      id: projectionNodeIds[idx],
      type: 'beat' as const,
      beatNumber: spec.beatNumber + idx,
      name: `Weekly Projection (${state})`,
      screenId,
      nextId: idx < projectionNodeIds.length - 1 ? projectionNodeIds[idx + 1] : null,
      backId: null,
      context: {
        screenId,
        screenName: `Weekly Projection (${state})`,
        contextBlock: spec.contextBlock,
      },
      componentType: 'weekly-projection' as FlowComponentType,
      componentProps: { ...spec.componentProps, state },
      voice: { ...spec.voice, openerText: opener },
      tool: spec.tool,
      persist: spec.persist,
    };
  });

  // Pass 5: assemble all nodes in canonical order.
  // Spine up to (not including) path-fork, then beginner lane nodes, then
  // advanced lane nodes, then merge node + post-merge spine, then projections.
  // The path-fork node itself is in spineNodeIds, just before the beginner lane.
  const nodes: FlowNode[] = [];

  // Pre-fork spine (auth through reflection-setup).
  const forkIdx = spineNodeIds.indexOf(specFor('path-selection').nodeId);
  for (let i = 0; i < forkIdx && i < spineNodeIds.length; i++) {
    const n = nodeById.get(spineNodeIds[i]);
    if (n) nodes.push(n);
  }
  // The fork node itself.
  const forkNode = nodeById.get(specFor('path-selection').nodeId);
  if (forkNode) nodes.push(forkNode);

  // Beginner lane nodes (category through habit-schedule).
  const beginnerComponents: FlowComponentType[] = ['category-grid', 'goals-list', 'habit-picker', 'habit-schedule'];
  for (const c of beginnerComponents) {
    const n = nodeById.get(specFor(c).nodeId);
    if (n) nodes.push(n);
  }

  // Advanced lane nodes.
  nodes.push(advCaptureNode);
  nodes.push(advFreqNode);

  // Post-fork merge node and any post-merge spine nodes (into-app etc.).
  const mergeIdx = spineNodeIds.indexOf(FORK_MERGE_NODE_ID);
  for (let i = mergeIdx; i < spineNodeIds.length; i++) {
    const n = nodeById.get(spineNodeIds[i]);
    if (n) nodes.push(n);
  }

  // Weekly projection nodes.
  for (const pn of projectionNodes) nodes.push(pn);

  // Patch into-app's nextId to point at the first projection node (if any).
  if (projectionNodeIds.length > 0) {
    const intoAppNode = nodes.find((n) => n.id === 'into-app');
    if (intoAppNode && intoAppNode.type === 'beat') {
      (intoAppNode as BeatNode).nextId = projectionNodeIds[0];
    }
  }

  return {
    flowId: opts.flowId,
    name: opts.name,
    version: opts.version,
    publishedAt: opts.publishedAt,
    entryNodeId: spineNodeIds[0] ?? 'auth',
    nodes,
  };
}
