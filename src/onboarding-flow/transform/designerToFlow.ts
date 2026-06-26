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
  'path-selection': 'path-selection',
  'category-grid': 'category-grid',
  'goals-list': 'goals-list',
  'habit-picker': 'habit-picker',
  'habit-schedule': 'habit-schedule',
  // The advanced (braindump) lane's single capture beat. Maps to its own engine
  // component now (was a synthesized coach-bubble lane before the resync).
  'advanced-capture': 'advanced-capture',
  'plan-cards': 'plan-cards',
  'morning-checkin-setup': 'morning-checkin-setup',
  'reflection-card': 'reflection-card',
  'into-app': 'into-app',
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
    tool: { toolName: 'submit_profile', persistsFields: ['age', 'gender'], advancesStep: true },
    persist: { step: 1 },
    screenName: 'Profile',
    contextBlock: 'Profile beat: age + gender only. Name comes from auth (see beatContexts).',
  },
  'path-selection': {
    nodeId: 'path-fork',
    beatNumber: 0,
    backId: null,
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
  // The advanced (braindump) lane's single capture beat. A real designer beat now
  // (was synthesized as coach-bubble before the resync). Routes only on the
  // braindump lane and rejoins at plan-review.
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
      openerText: "Perfect. Read me the habits you already track and I'll get them organized.",
      expectsInput: true,
      directLlmAllowed: true,
    },
    tool: { toolName: 'submit_brain_dump', persistsFields: ['brainDumpText'], advancesStep: true },
    persist: { step: 3 },
    screenName: 'Brain Dump',
    contextBlock:
      'The user wants to tell you everything on their mind at once. Let them. Listen for the habits and goals inside it; do not interrupt with structure yet.',
  },
  'plan-cards': {
    nodeId: 'plan-review',
    beatNumber: 8,
    backId: 'habit-schedule',
    screenId: 'ONBOARD-BEGINNER-06',
    componentProps: { showJournalCard: true },
    voice: {
      openerText: 'Here are your habits. Do these look right, or want to change anything?',
      expectsInput: true,
      directLlmAllowed: true,
    },
    tool: { toolName: 'update_habit', persistsFields: [], advancesStep: true },
    persist: null,
    screenName: 'Plan Review',
    contextBlock:
      'Show them the habits you built together and ask if they want to change anything before moving on. Handle one edit at a time, then continue.',
  },
  'morning-checkin-setup': {
    nodeId: 'morning-checkin-setup',
    beatNumber: 9,
    backId: 'plan-review',
    screenId: 'ONBOARD-MORNING-SETUP',
    componentProps: { showDayPicker: true, showReminderToggle: true },
    voice: {
      openerText: "When do you want your morning check-in? I'll nudge you then.",
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
    beatNumber: 10,
    backId: 'morning-checkin-setup',
    screenId: 'ONBOARD-BEGINNER-07',
    componentProps: { showDayPicker: true, showReminderToggle: true, showModePicker: true },
    voice: {
      openerText: 'Now your evening reflection. When works for you?',
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
  'into-app': {
    nodeId: 'into-app',
    beatNumber: 11,
    backId: null,
    screenId: 'ONBOARD-COMPLETE',
    componentProps: {},
    voice: {
      openerText: "You're all set. Let's get started.",
      expectsInput: false,
      directLlmAllowed: true,
    },
    tool: { toolName: 'confirm_plan', persistsFields: [], advancesStep: true },
    persist: null,
    screenName: 'Into the App',
    contextBlock:
      "Onboarding is done. Warmly tell the user they are all set and take them in. Do not collect anything else.",
  },
};

/**
 * The fork's lanes and the merge target. The flat designer array has no fork; the
 * engine forks at the path-selection beat into a beginner lane (category through
 * habit-schedule) and the advanced lane (the single advanced-capture brain-dump
 * beat), both rejoining at plan-review. From plan-review the spine continues
 * shared: morning-checkin-setup -> reflection-setup -> into-app.
 */
const FORK_LANES = [
  { value: 'simple', label: 'Beginner', entryNodeId: 'category', exitNodeId: 'habit-schedule' },
  {
    value: 'braindump',
    label: 'Advanced',
    entryNodeId: 'advanced-input',
    exitNodeId: 'advanced-input',
  },
] as const;
const FORK_MERGE_NODE_ID = 'plan-review';
const FORK_CONDITION_SOURCE = 'answers.path';
// The designer component type that backs the advanced (braindump) lane node. It
// is pulled out of the linear beginner spine and inserted as a lane node, the way
// the synthesized coach-bubble beat used to be, but now it is a real designer beat.
const ADVANCED_LANE_COMPONENT: FlowComponentType = 'advanced-capture';

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
 * The graph is built in three passes:
 *   1. Map each designer beat (skipping intro types) to an engine node, in order.
 *   2. Insert the synthesized advanced-input lane beat (no designer counterpart).
 *   3. Chain nextId across the BEGINNER spine and turn the path beat into a
 *      BranchNode, so the result matches the hand-authored flow exactly. beatNumber
 *      and backId come from the engine spec, not the designer's beat string.
 */
export function designerToFlowDocument(
  designerFlow: DesignerBeat[],
  options: TransformOptions = {},
): FlowDocument {
  const opts = { ...DEFAULTS, ...options };

  // Pass 1: designer beats -> engine component types, in spine order. Intro beats
  // (no mapping), the advanced-lane beat (routed only on the braindump lane, added
  // in pass 2), and any type without an engine spec are skipped, so every entry
  // here has a spec.
  const mappedTypes: FlowComponentType[] = [];
  for (const beat of designerFlow) {
    const component = TYPE_TO_COMPONENT[beat.type];
    if (component == null) continue; // intro beat, not an engine node
    if (component === ADVANCED_LANE_COMPONENT) continue; // advanced lane, added in pass 2
    if (!ENGINE_BEAT_SPECS[component]) continue; // registry type with no onboarding spec
    mappedTypes.push(component);
  }

  // The designer beat for each mapped component (for opener + screenId overrides).
  // The advanced-lane beat is kept too, so pass 2 can read its designer opener.
  const designerByComponent = new Map<FlowComponentType, DesignerBeat>();
  for (const beat of designerFlow) {
    const component = TYPE_TO_COMPONENT[beat.type];
    if (component) designerByComponent.set(component, beat);
  }

  // The spine order of node ids, in the BEGINNER path, as authored.
  // auth -> mic -> profile -> path-fork -> category -> goals -> habit-select ->
  // habit-schedule -> [advanced-input lane node] -> plan-review ->
  // morning-checkin-setup -> reflection-setup -> into-app.
  const spineIds = mappedTypes.map((c) => specFor(c).nodeId);

  // The beginner-spine successor of each node id (for nextId/backId chaining). The
  // path beat's next is the fork resolution, handled when we build the BranchNode.
  const nodeById = new Map<string, FlowNode>();

  mappedTypes.forEach((component, i) => {
    const spec = specFor(component);
    const designerBeat = designerByComponent.get(component);
    const screenId = screenIdFromSheetStage(designerBeat?.sheetStage) ?? spec.screenId;
    const opener = resolveOpener(designerBeat, spec);
    const componentProps = { ...spec.componentProps };

    const nextId = i < spineIds.length - 1 ? spineIds[i + 1] : null;

    const baseVoice: VoiceConfig = { ...spec.voice, openerText: opener };
    const context = {
      screenId,
      screenName: spec.screenName,
      contextBlock: spec.contextBlock,
    };
    const beatNumber = spec.beatNumber;

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

    // nextId chains linearly down the spine. The last spine node (into-app, the
    // shared terminal) ends with null. backId is the engine spec's value (the
    // graph back target, which is not always the spine predecessor: category goes
    // back to the fork).
    const node: BeatNode = {
      id: spec.nodeId,
      type: 'beat',
      beatNumber,
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

  // Pass 2: the advanced-input lane beat. A real designer beat now (advance-capture),
  // pulled out of the linear beginner spine and inserted as the braindump lane node
  // that rejoins at plan-review. Its opener comes from the designer beat.
  const advSpec = specFor(ADVANCED_LANE_COMPONENT);
  const advDesigner = designerByComponent.get(ADVANCED_LANE_COMPONENT);
  const advScreenId = screenIdFromSheetStage(advDesigner?.sheetStage) ?? advSpec.screenId;
  const advNode: BeatNode = {
    id: advSpec.nodeId,
    type: 'beat',
    beatNumber: advSpec.beatNumber,
    name: 'Brain Dump (Advanced)',
    screenId: advScreenId,
    nextId: FORK_MERGE_NODE_ID,
    backId: advSpec.backId,
    context: {
      screenId: advScreenId,
      screenName: advSpec.screenName,
      contextBlock: advSpec.contextBlock,
    },
    componentType: ADVANCED_LANE_COMPONENT,
    componentProps: { ...advSpec.componentProps },
    voice: { ...advSpec.voice, openerText: resolveOpener(advDesigner, advSpec) },
    tool: advSpec.tool,
    persist: advSpec.persist,
  };

  // Pass 3: assemble nodes in the exact authored order. The advanced-input beat is
  // inserted just before plan-review, matching the hand-authored file's order.
  const nodes: FlowNode[] = [];
  for (const id of spineIds) {
    if (id === FORK_MERGE_NODE_ID) {
      nodes.push(advNode); // advanced lane node lands right before the merge node
    }
    const node = nodeById.get(id);
    if (node) nodes.push(node);
  }

  return {
    flowId: opts.flowId,
    name: opts.name,
    version: opts.version,
    publishedAt: opts.publishedAt,
    entryNodeId: spineIds[0] ?? 'auth',
    nodes,
  };
}
