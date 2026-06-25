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
  'reflection-card': 'reflection-card',
  'plan-cards': 'plan-cards',
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
  'reflection-card': {
    nodeId: 'reflection-setup',
    beatNumber: 7,
    backId: 'habit-select',
    screenId: 'ONBOARD-BEGINNER-07',
    componentProps: { showDayPicker: true, showReminderToggle: true },
    voice: {
      openerText: "Let's set a daily moment to reflect. When works for you?",
      expectsInput: true,
      directLlmAllowed: true,
    },
    tool: {
      toolName: 'submit_reflection_config',
      persistsFields: ['reflectionConfig'],
      advancesStep: true,
    },
    persist: { step: 6 },
    screenName: 'Reflection Setup',
    contextBlock:
      'Set up a short daily reflection: when, which days, and whether they want a reminder. Frame it as a moment for their mind, not a chore.',
  },
  'plan-cards': {
    nodeId: 'plan-review',
    beatNumber: 8,
    backId: 'reflection-setup',
    screenId: 'ONBOARD-BEGINNER-06',
    componentProps: { showJournalCard: true },
    voice: {
      openerText: "Here's your starting plan. We'll adjust as we go.",
      expectsInput: true,
      directLlmAllowed: true,
    },
    tool: { toolName: 'confirm_plan', persistsFields: [], advancesStep: true },
    persist: null,
    screenName: 'Plan Review',
    contextBlock:
      'Show them the plan you built together and ask if they want to change anything before starting. If they are happy, take them in.',
  },
  // coach-bubble has no designer DEFAULT_FLOW counterpart in the beginner path;
  // it backs the synthesized advanced-input lane beat (built in SYNTHESIZED_NODES).
  'coach-bubble': {
    nodeId: 'advanced-input',
    beatNumber: 4,
    backId: 'path-fork',
    screenId: 'ONBOARD-ADVANCED',
    componentProps: {
      brainDump: true,
      placeholder: 'Tell me everything on your mind, what you want to build, drop, or change.',
    },
    voice: {
      openerText: 'Go ahead, tell me everything on your mind. I will organize it.',
      expectsInput: true,
      directLlmAllowed: true,
    },
    tool: { toolName: 'submit_brain_dump', persistsFields: ['brainDumpText'], advancesStep: true },
    persist: { step: 3 },
    screenName: 'Brain Dump',
    contextBlock:
      'The user wants to tell you everything on their mind at once. Let them. Listen for the habits and goals inside it; do not interrupt with structure yet.',
  },
};

/**
 * The fork's lanes and the merge target. The flat designer array has no fork; the
 * engine forks at the path-selection beat into a beginner lane (category onward)
 * and a synthesized advanced lane (brain-dump), both rejoining at plan-review.
 */
const FORK_LANES = [
  { value: 'simple', label: 'Beginner', entryNodeId: 'category', exitNodeId: 'reflection-setup' },
  {
    value: 'braindump',
    label: 'Advanced',
    entryNodeId: 'advanced-input',
    exitNodeId: 'advanced-input',
  },
] as const;
const FORK_MERGE_NODE_ID = 'plan-review';
const FORK_CONDITION_SOURCE = 'answers.path';

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
  // (no mapping), coach-bubble (synthesized, not in DEFAULT_FLOW), and any type
  // without an engine spec are skipped, so every entry here has a spec.
  const mappedTypes: FlowComponentType[] = [];
  for (const beat of designerFlow) {
    const component = TYPE_TO_COMPONENT[beat.type];
    if (component == null) continue; // intro beat, not an engine node
    if (component === 'coach-bubble') continue; // synthesized advanced lane, added in pass 2
    if (!ENGINE_BEAT_SPECS[component]) continue; // registry type with no onboarding spec
    mappedTypes.push(component);
  }

  // The designer beat for each mapped component (for opener + screenId overrides).
  const designerByComponent = new Map<FlowComponentType, DesignerBeat>();
  for (const beat of designerFlow) {
    const component = TYPE_TO_COMPONENT[beat.type];
    if (component && component !== 'coach-bubble') designerByComponent.set(component, beat);
  }

  // The spine order of node ids, in the BEGINNER path, as authored.
  // auth -> mic -> profile -> path-fork -> category -> goals -> habit-select ->
  // reflection-setup -> [advanced-input synthesized] -> plan-review.
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

    // nextId chains linearly down the spine; plan-review (the merge) terminates
    // with null. backId is the engine spec's value (the graph back target, which
    // is not always the spine predecessor: category goes back to the fork).
    const node: BeatNode = {
      id: spec.nodeId,
      type: 'beat',
      beatNumber,
      name: spec.screenName,
      screenId,
      nextId: spec.nodeId === FORK_MERGE_NODE_ID ? null : nextId,
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

  // Pass 2: the synthesized advanced-input lane beat (no designer counterpart).
  const advSpec = specFor('coach-bubble');
  const advNode: BeatNode = {
    id: advSpec.nodeId,
    type: 'beat',
    beatNumber: advSpec.beatNumber,
    name: 'Brain Dump (Advanced)',
    screenId: advSpec.screenId,
    nextId: FORK_MERGE_NODE_ID,
    backId: advSpec.backId,
    context: {
      screenId: advSpec.screenId,
      screenName: advSpec.screenName,
      contextBlock: advSpec.contextBlock,
    },
    componentType: 'coach-bubble',
    componentProps: { ...advSpec.componentProps },
    voice: { ...advSpec.voice },
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
