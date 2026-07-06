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
  BeatRuntimeMeta,
  BranchNode,
  FlowComponentType,
  FlowDocument,
  FlowNode,
  PersistConfig,
  ToolConfig,
  VoiceConfig,
} from '../types';
import type { DesignerBeat } from './designerSource';

/**
 * designer `type` -> engine `componentType`. null = deliberately skipped.
 * A type ABSENT from this map makes the transform throw (no silent beat drops).
 */
const TYPE_TO_COMPONENT: Record<string, FlowComponentType | null> = {
  // QA launcher design beat; the engine ships QAControlScreen.tsx instead. Skipped (null).
  'qa-control': null,
  // Intro beats render via IntroGate, not as engine nodes. Skipped (null).
  splash: null,
  'get-started': null,
  'splash-intro': null,
  // Real onboarding beats.
  'auth-signup': 'auth',
  'mic-permission': 'mic-permission',
  'profile-beat': 'profile-input',
  // Post-lane setup block (B47 reorder 2026-07-06): state-check, morning,
  // reflection and weekly-day sit AFTER the fork lanes merge, matching the
  // canonical persist-step scale (1..5 positional window, then 6..9), so the
  // scale is monotonic in flow order again.
  'why-intro': 'why-intro',
  'state-check': 'state-check',
  'morning-checkin-setup': 'morning-checkin-setup',
  'reflection-card': 'reflection-card',
  'weekly-day-setup': 'weekly-day-picker',
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
  // STEP-0: create-your-own goal/habit name-it screens (props.kind: goal|habit).
  // In the forked onboarding flow these are DETOUR nodes (see the custom-entry
  // pass below); in linear flows they chain like any other beat.
  'custom-entry': 'custom-entry',
  // Check-in + tour components (linear flows; specs come from the authored
  // Export beat, never ENGINE_BEAT_SPECS — see designerToLinearFlowDocument).
  'coach-bubble': 'coach-bubble',
  'habit-review': 'habit-review',
  reflection: 'reflection',
  'home-tour': 'home-tour',
  // The Weekly (linear flow): the real week-grid beat.
  'weekly-habits-summary': 'weekly-habits-summary',
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
      // Fallback only (the designer props compose the real opener, see
      // resolveOpener). Newlines are turn breaks: one coach bubble per line, so
      // the age and gender prompts stay separate turns even on the fallback.
      openerText:
        'Good to meet you, {name}. Two quick things so I can tailor this to you.\nHow old are you?\nAnd your gender?',
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
  // B47 reorder: state-check is the MERGE node after the fork lanes, so back
  // from here would cross an ambiguous lane boundary. No back (into-app rule).
  'state-check': {
    nodeId: 'state-check',
    beatNumber: 2,
    backId: null,
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
    // B47 reorder: the fork directly follows profile (persist step 2 after 1).
    backId: 'profile',
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
      openerText:
        'Read me the habits you already track. Less is more to start, you can always build on it.',
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
  // Post-lane setup block: morning-checkin-setup and reflection-card follow
  // state-check after the fork lanes merge (B47 reorder).
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
  // V3 new: The Weekly day setup, right after reflection-setup (post-lane setup
  // block). Single-select day (0=Sunday preselected); submit_weekly_config saves
  // AND self-advances (GREATEST-bump to step 9), matching reflection/morning.
  'weekly-day-picker': {
    nodeId: 'weekly-day-setup',
    beatNumber: 3,
    backId: 'reflection-setup',
    screenId: 'ONBOARD-WEEKLY-SETUP',
    componentProps: {},
    voice: {
      openerText:
        "Once a week, we'll zoom out. We look at the whole week together and we plan the next one. And it gets sharper every week, because I'll know you better. Which day should that be?",
      expectsInput: true,
      directLlmAllowed: true,
    },
    tool: {
      toolName: 'submit_weekly_config',
      persistsFields: ['weeklyConfig'],
      advancesStep: true,
    },
    persist: { step: 9 },
    screenName: 'The Weekly Day',
    contextBlock:
      'Set the day for The Weekly, their weekly coaching session where you and the user look back over the week and plan the next one. Sunday is the suggested default.',
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
 * Both lanes merge at the first spine node after the beginner lane exit
 * (state-check since the B47 reorder), derived from the designer order below
 * so a future reorder moves the merge with it instead of silently forking the
 * graph from the authored order.
 *
 * Before the fork (shared spine): auth -> mic -> profile -> path-fork.
 * After the merge (shared spine): state-check -> morning-checkin-setup ->
 *   reflection-setup -> weekly-day-setup -> into-app -> weekly-projection x5.
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
// Fallback merge target only (a flow whose spine ends at the lane exit).
const FORK_MERGE_FALLBACK_NODE_ID = 'into-app';
const FORK_CONDITION_SOURCE = 'answers.path';
// Designer component types that back the advanced lane nodes. Both are pulled
// out of the linear spine and handled in a dedicated pass (pass 2).
const ADVANCED_LANE_COMPONENTS: FlowComponentType[] = ['advanced-capture', 'advanced-frequency'];

// Transition defaults mirrored from the runtime scatter. Do not consume these at
// runtime in this phase; they only stamp today's behavior into the generated flow.
const CHAT_VAPI_BEAT_SCREENS = new Set([
  'ONBOARD-FORK--FORM',
  'ONBOARD-BEGINNER-01',
  'ONBOARD-BEGINNER-02',
  'ONBOARD-BEGINNER-03',
  'ONBOARD-BEGINNER-04',
  'ONBOARD-ADVANCED',
  'ONBOARD-BEGINNER-06',
  'ONBOARD-MORNING-SETUP',
  'ONBOARD-BEGINNER-07',
  'ONBOARD-COMPLETE',
]);

const ONBOARDING_BEAT_MP3S: Record<string, string> = {
  'COACH-GREETING': '/voice/onboard_coach_greeting.mp3',
  'MIC-PERMISSION': '/voice/onboard_mic_permission.mp3',
  'ONBOARD-WHY-INTRO': '/voice/onboard_why_intro.mp3',
  'ONBOARD-STATE-CHECK': '/voice/onboard_state_check.mp3',
  'ONBOARD-MORNING-SETUP': '/voice/onboard_morning_time.mp3',
  'ONBOARD-BEGINNER-07': '/voice/onboard_evening_reflection.mp3',
  'ONBOARD-FORK--FORM': '/voice/onboard_path_fork.mp3',
  'ONBOARD-BEGINNER-01': '/voice/onboard_category.mp3',
  'ONBOARD-BEGINNER-02': '/voice/onboard_subcategory.mp3',
  'ONBOARD-BEGINNER-03': '/voice/onboard_habits.mp3',
  'ONBOARD-BEGINNER-04': '/voice/onboard_habit_schedule.mp3',
  'ONBOARD-ADVANCED': '/voice/onboard_advanced_capture.mp3',
  'ONBOARD-ADVANCED-FREQUENCY': '/voice/onboard_advanced_frequency.mp3',
  'ONBOARD-COMPLETE': '/voice/onboard_full_plan.mp3',
  'ONBOARD-WEEKLY-PROJECTION-BLANK': '/voice/onboard_weekly_blank.mp3',
  'ONBOARD-WEEKLY-PROJECTION-FULL': '/voice/onboard_weekly_full.mp3',
  'ONBOARD-WEEKLY-PROJECTION-P78': '/voice/onboard_weekly_p78.mp3',
  'ONBOARD-WEEKLY-PROJECTION-P36': '/voice/onboard_weekly_p36.mp3',
  'ONBOARD-WEEKLY-PROJECTION-GAPS': '/voice/onboard_weekly_gaps.mp3',
};

const HYBRID_OPENER_BEATS = new Set(['ONBOARD-BEGINNER-04', 'ONBOARD-ADVANCED']);

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

/**
 * Resolve a designer type to its engine component (null = deliberately skipped).
 * Throws on a type the map has never heard of; silence here used to drop beats.
 */
function componentFor(type: string): FlowComponentType | null {
  const mapped = TYPE_TO_COMPONENT[type];
  if (mapped === undefined) {
    throw new Error(
      `designerToFlow: unrecognized designer componentType "${type}". ` +
        'Add it to TYPE_TO_COMPONENT (map to null to skip it deliberately).',
    );
  }
  return mapped;
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
 * canonical opener verbatim. Otherwise the designer coachLine drives the opener,
 * falling back to the engine opener when the designer authored none.
 *
 * B48: this is only the flow DOCUMENT's opener. At runtime, a beat whose
 * screenId has a LOCKED line in onboardingOpeners.ts renders that line instead
 * (renderer/resolveBeatOpener.ts, name-variant aware); the composition and
 * fallbacks here can never win over a locked opener.
 *
 * Turn-break convention: a newline inside the opener is a TURN BREAK. The
 * renderer draws one coach bubble per line (BeatView splits via openerTurns).
 *
 * Profile is composed, not copied: the designer authors its prompts as separate
 * props (greeting, askAge, askGender), and the flow-annotated reference renders
 * them as three separate coach turns. Joining them with newlines keeps the age
 * and gender prompts as separate bubbles (B5) instead of one merged paragraph.
 */
function resolveOpener(beat: DesignerBeat | undefined, spec: EngineBeatSpec): string | null {
  if (spec.nodeId === 'profile') {
    const props = beat?.props ?? {};
    const lines = [props.greeting, props.askAge, props.askGender].filter(
      (line): line is string => typeof line === 'string' && line.trim().length > 0,
    );
    if (lines.length > 0) return lines.map((line) => line.trim()).join('\n');
  }
  if (spec.openerFromEngine) return spec.voice.openerText;
  return (
    stringProp(beat?.props, 'coachLine') ??
    stringProp(beat?.props, 'greeting') ??
    spec.voice.openerText
  );
}

function stringProp(props: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = props?.[key];
  return typeof value === 'string' ? value : undefined;
}

/**
 * STEP-0 presentation fields, carried verbatim from the designer beat onto the
 * engine node (narration script, orb suppression, component-owned audio, and the
 * render-time art variant). Spread-only-when-present keeps every flow authored
 * before STEP-0 byte-identical through flow:sync (backward compatibility gate).
 *
 * `variant` name collision, resolved here: the builder Export already uses
 * `variant` as a BUILDER VISIBILITY tag ('shared' | 'production' | 'qa', see
 * FlowBuilder's inVariant). Those are authoring-view concerns, never runtime
 * presentation, so they are filtered out; anything else (e.g. 'female', the
 * women's art switch, same screenId per Yair's 2026-07-06 ruling) flows through.
 */
const BUILDER_VISIBILITY_VARIANTS = new Set(['shared', 'production', 'qa']);

function presentationFields(
  beat: DesignerBeat | undefined,
): Pick<BeatNode, 'narration' | 'variant' | 'hideOrb' | 'componentOwned'> {
  if (!beat) return {};
  const variant =
    beat.variant != null && !BUILDER_VISIBILITY_VARIANTS.has(beat.variant)
      ? beat.variant
      : undefined;
  return {
    ...(beat.narration && beat.narration.length > 0 ? { narration: beat.narration } : {}),
    ...(variant ? { variant } : {}),
    ...(beat.hideOrb != null ? { hideOrb: beat.hideOrb } : {}),
    ...(beat.componentOwned != null ? { componentOwned: beat.componentOwned } : {}),
  };
}

const slug = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

function parseList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseNumber(raw: string | undefined): number | undefined {
  if (raw == null || raw.trim() === '') return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function mapVoiceOutEngine(
  raw: string | undefined,
): BeatRuntimeMeta['voiceOut']['engine'] | undefined {
  const normalized = raw?.trim().toLowerCase();
  if (
    normalized === 'mp3' ||
    normalized === 'cartesia' ||
    normalized === 'vapi' ||
    normalized === 'none'
  ) {
    return normalized;
  }
  return undefined;
}

function mapVoiceMode(raw: string | undefined): BeatRuntimeMeta['voiceOut']['mode'] | undefined {
  const normalized = raw?.trim().toLowerCase();
  if (normalized === 'verbatim' || normalized === 'generative') return normalized;
  return undefined;
}

function mapPath(raw: string | undefined): BeatRuntimeMeta['path'] | undefined {
  const normalized = raw?.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized.includes('path 1') || normalized.includes('vapi')) return 'path-1-vapi';
  if (normalized.includes('path 2') || normalized.includes('async')) return 'path-2-async';
  if (normalized.includes('path 3') || normalized.includes('direct')) return 'path-3-direct-llm';
  return undefined;
}

function mapStatus(
  raw: string | undefined,
): NonNullable<BeatRuntimeMeta['authoring']>['status'] | undefined {
  const normalized = raw?.trim().toLowerCase();
  if (normalized === 'draft' || normalized === 'ready' || normalized === 'locked')
    return normalized;
  return undefined;
}

function firstNumberProp(props: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = props[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

function resolveMeta(
  designerBeat: DesignerBeat | undefined,
  spec: EngineBeatSpec,
): BeatRuntimeMeta {
  const screenId = screenIdFromSheetStage(designerBeat?.sheetStage) ?? spec.screenId;
  const opener = resolveOpener(designerBeat, spec);
  const authored = designerBeat?.meta;
  const isVapiBeat = CHAT_VAPI_BEAT_SCREENS.has(screenId);
  const mp3File = ONBOARDING_BEAT_MP3S[screenId];
  const isHybridOpenerBeat = HYBRID_OPENER_BEATS.has(screenId);
  const defaultVoiceOutEngine: BeatRuntimeMeta['voiceOut']['engine'] = mp3File
    ? 'mp3'
    : isVapiBeat
      ? 'vapi'
      : opener
        ? 'cartesia'
        : 'none';
  const voiceOutEngine = mapVoiceOutEngine(authored?.voiceEngine) ?? defaultVoiceOutEngine;
  // fill.brain, authored-metadata-first. When the beat carries an authored
  // voiceEngine, derive the brain from the metadata (voiceEngine + allowedTools +
  // engine.voiceExpectsInput / voiceDirectLlmAllowed), NOT the legacy Vapi scatter.
  // Only a beat with NO authored voiceEngine falls back to CHAT_VAPI_BEAT_SCREENS.
  const authoredVoiceEngine = authored?.voiceEngine?.trim().toLowerCase();
  const authoredHasTools = parseList(authored?.allowedTools).length > 0;
  const authoredExpectsInput = authored?.engine?.voiceExpectsInput === true;
  const authoredDirectLlmAllowed = authored?.engine?.voiceDirectLlmAllowed === true;
  const fillBrain: BeatRuntimeMeta['fill']['brain'] = authoredVoiceEngine
    ? authoredVoiceEngine === 'vapi'
      ? 'vapi'
      : authoredVoiceEngine === 'none'
        ? // 'None' voice: taps only unless the beat explicitly allows direct-LLM voice.
          authoredDirectLlmAllowed
          ? 'direct-llm'
          : 'none'
        : // MP3 / Cartesia: the coach fills only when the beat takes input
          // (has tools or expects input). A say-only MP3 line stays 'none'.
          authoredHasTools || authoredExpectsInput
          ? 'direct-llm'
          : 'none'
    : // No authored voiceEngine: keep the legacy scatter as the fallback.
      isVapiBeat || voiceOutEngine === 'vapi'
      ? 'vapi'
      : 'direct-llm';
  const path =
    mapPath(authored?.path) ?? (fillBrain === 'vapi' ? 'path-1-vapi' : 'path-3-direct-llm');
  const allowedTools =
    parseList(authored?.allowedTools).length > 0
      ? parseList(authored?.allowedTools)
      : spec.tool
        ? [spec.tool.toolName]
        : [];
  const mp3Assets =
    authored?.mp3Assets ??
    (mp3File
      ? [
          {
            id: `${slug(screenId)}-opener`,
            label: `${spec.screenName} opener`,
            file: mp3File,
            transcript: opener ?? '',
            opener: opener ?? '',
            timing: 'opener' as const,
          },
        ]
      : undefined);
  const spokenContent = authored?.spokenContent ?? opener ?? undefined;
  const firstAssetRef = mp3Assets?.[0]?.id;
  const componentProps = spec.componentProps;
  const authoredPersistStep = parseNumber(authored?.engine?.persistStep);
  const defaultMaxSelections = firstNumberProp(componentProps, ['maxSelections', 'maxPerGoal']);
  const maxSelections = parseNumber(authored?.engine?.maxSelections) ?? defaultMaxSelections;
  const optionSource =
    authored?.engine?.optionSource ??
    (typeof componentProps.optionSource === 'string' ? componentProps.optionSource : undefined);
  const captureFields =
    parseList(authored?.engine?.captureFields).length > 0
      ? parseList(authored?.engine?.captureFields)
      : (spec.tool?.persistsFields ?? []);
  const toolPersistsFields =
    parseList(authored?.engine?.toolPersistsFields).length > 0
      ? parseList(authored?.engine?.toolPersistsFields)
      : (spec.tool?.persistsFields ?? []);

  return {
    voiceOut: {
      engine: voiceOutEngine,
      mode: mapVoiceMode(authored?.voiceMode) ?? 'verbatim',
      ...(authored?.voiceId ? { voiceId: authored.voiceId } : {}),
      ...(mp3Assets ? { mp3Assets } : {}),
      ...(spokenContent
        ? {
            lines: [
              {
                id: `${slug(screenId)}-line-1`,
                text: spokenContent,
                voiceOnly: false,
                onScreen: true,
                engine: voiceOutEngine,
                ...(firstAssetRef ? { assetRef: firstAssetRef } : {}),
              },
            ],
          }
        : {}),
    },
    voiceIn: {
      engine:
        isVapiBeat || fillBrain === 'vapi' ? 'vapi' : spec.voice.expectsInput ? 'soniox' : 'none',
      enabled: spec.voice.expectsInput || isVapiBeat,
      micRequired: spec.voice.expectsInput || isVapiBeat,
      armOnBeatLoad: spec.voice.expectsInput || isVapiBeat,
    },
    fill: {
      brain: fillBrain,
      llmActive:
        authored?.llmActive ?? (isVapiBeat || spec.voice.expectsInput || spec.tool != null),
      allowedTools,
    },
    path,
    orb: authored?.orb ?? {
      voiceOn: voiceOutEngine !== 'none',
      micOn: spec.voice.expectsInput || isVapiBeat,
      micAsking: screenId === 'MIC-PERMISSION',
      bloomed: voiceOutEngine !== 'none',
    },
    toggles: {
      expectsInput: authored?.engine?.voiceExpectsInput ?? spec.voice.expectsInput,
      directLlmAllowed: authored?.engine?.voiceDirectLlmAllowed ?? spec.voice.directLlmAllowed,
      instantOpenerEligible: isVapiBeat,
      suppressVapiDuringMp3: Boolean(mp3File && isHybridOpenerBeat),
      continueVapiAfterMp3: Boolean(mp3File && isHybridOpenerBeat),
      autoplayRequiresUnlock: Boolean(mp3File),
      qaForceEngineAllowed: true,
    },
    // Authoring echo only: the runtime node's backId/persist come from BEAT_SPECS
    // (the engine table owns structure and persistence); nothing at runtime reads
    // meta.engine.persistStep/backId, so an authored value here that disagrees
    // with the spec is a designer-source staleness signal, not engine behavior.
    engine: {
      nodeId: authored?.engine?.nodeId ?? spec.nodeId,
      backId: authored?.engine?.backId ?? spec.backId ?? undefined,
      persistStep: authoredPersistStep ?? spec.persist?.step ?? null,
      pathField: authored?.engine?.pathField ?? spec.persist?.pathField ?? false,
      captureFields,
      toolName: authored?.engine?.toolName ?? spec.tool?.toolName,
      toolAdvancesStep: authored?.engine?.toolAdvancesStep ?? spec.tool?.advancesStep,
      toolPersistsFields,
      ...(maxSelections != null ? { maxSelections } : {}),
      ...(optionSource ? { optionSource } : {}),
    },
    authoring: {
      ...(authored?.figmaNode ? { figmaNode: authored.figmaNode } : {}),
      ...(mapStatus(authored?.status) ? { status: mapStatus(authored?.status) } : {}),
      ...(authored?.voiceNotes ? { notes: authored.voiceNotes } : {}),
      ...(authored?.feedbackConfig ? { feedbackConfig: authored.feedbackConfig } : {}),
      ...(authored?.animation ? { animation: authored.animation } : {}),
    },
  };
}

/**
 * Linear (fork-less) flows: one node per designer beat, in authoring order.
 *
 * Unlike the onboarding path below, NOTHING here reads ENGINE_BEAT_SPECS: a
 * check-in state-check must not inherit onboarding's beatNumber/backId/persist.
 * The Export beat itself carries the engine facts: meta.engine.nodeId (falls
 * back to a slug of the name), a "SCREEN-ID: Name" sheetStage (required),
 * props.text/coachLine (the opener; both are stripped from componentProps),
 * meta.engine.toolName/toolPersistsFields/toolAdvancesStep, and
 * meta.engine.voiceExpectsInput/voiceDirectLlmAllowed. persist stays null:
 * linear flows never write the onboarding step counter (per-flow persistence
 * is the adapter layer's job).
 */
export function designerToLinearFlowDocument(
  designerFlow: DesignerBeat[],
  options: TransformOptions = {},
): FlowDocument {
  if (!options.flowId) {
    throw new Error('designerToFlow(linear): options.flowId is required (no onboarding default)');
  }
  const opts = { ...DEFAULTS, ...options };

  const beats = designerFlow.filter((beat) => componentFor(beat.type) != null);
  if (beats.length === 0) throw new Error('designerToFlow(linear): no engine-mapped beats');

  const nodeIds = beats.map((beat) => {
    const authored = beat.meta?.engine?.nodeId;
    if (authored) return authored;
    if (beat.name) return slug(beat.name);
    throw new Error(
      `designerToFlow(linear): beat "${beat.beat ?? '?'}" (${beat.type}) needs meta.engine.nodeId or a name`,
    );
  });
  const dupes = nodeIds.filter((id, i) => nodeIds.indexOf(id) !== i);
  if (dupes.length > 0) {
    throw new Error(
      `designerToFlow(linear): duplicate node id(s) ${[...new Set(dupes)].join(', ')}; ` +
        'author distinct meta.engine.nodeId values',
    );
  }

  const nodes: BeatNode[] = beats.map((beat, i) => {
    const component = componentFor(beat.type) as FlowComponentType;
    const screenId = screenIdFromSheetStage(beat.sheetStage);
    if (!screenId) {
      throw new Error(
        `designerToFlow(linear): beat "${beat.beat ?? '?'}" (${beat.type}) needs a "SCREEN-ID: Name" sheetStage`,
      );
    }
    const name = beat.name ?? screenId;
    const opener = stringProp(beat.props, 'text') ?? stringProp(beat.props, 'coachLine') ?? null;
    const componentProps: Record<string, unknown> = { ...(beat.props ?? {}) };
    delete componentProps.text;
    delete componentProps.coachLine;
    const engine = beat.meta?.engine;
    const tool: ToolConfig | null = engine?.toolName
      ? {
          toolName: engine.toolName,
          persistsFields: parseList(engine.toolPersistsFields),
          advancesStep: engine.toolAdvancesStep ?? false,
        }
      : null;
    const voice: VoiceConfig = {
      openerText: opener,
      expectsInput: engine?.voiceExpectsInput ?? false,
      directLlmAllowed: engine?.voiceDirectLlmAllowed ?? true,
    };
    const backId = engine?.backId ?? (i > 0 ? nodeIds[i - 1] : null);
    const spec: EngineBeatSpec = {
      nodeId: nodeIds[i],
      beatNumber: i,
      backId,
      screenId,
      componentProps,
      voice,
      tool,
      persist: null,
      screenName: name,
      contextBlock: beat.context ?? '',
    };
    return {
      id: nodeIds[i],
      type: 'beat',
      beatNumber: i,
      name,
      screenId,
      nextId: i < beats.length - 1 ? nodeIds[i + 1] : null,
      backId,
      context: { screenId, screenName: name, contextBlock: beat.context ?? '' },
      componentType: component,
      componentProps,
      voice,
      meta: resolveMeta(beat, spec),
      tool,
      persist: null,
      ...presentationFields(beat),
    };
  });

  return {
    flowId: opts.flowId,
    name: opts.name,
    version: opts.version,
    publishedAt: opts.publishedAt,
    entryNodeId: nodeIds[0],
    nodes,
  };
}

/**
 * Transform the designer flow into the engine FlowDocument.
 *
 * Fork-less designer flows route to designerToLinearFlowDocument: the fork
 * passes below (lanes, advanced synthesis, merge assembly) run ONLY when a
 * path-selection beat is present.
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
  // No fork beat = linear flow; the fork passes below must not run.
  if (!designerFlow.some((beat) => componentFor(beat.type) === 'path-selection')) {
    return designerToLinearFlowDocument(designerFlow, options);
  }
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

  // Pass 1: spine component types in order. Skip: null-mapped, advanced-lane,
  // weekly-projection, custom-entry (all handled in dedicated passes).
  const SKIP_IN_SPINE = new Set<FlowComponentType>([
    ...ADVANCED_LANE_COMPONENTS,
    'weekly-projection',
    'custom-entry',
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
    // A mapped type with no spec used to be dropped silently; specFor throws.
    specFor(component);
    spineComponents.push(component);
  }

  // Spine node IDs in order (for nextId chaining).
  const spineNodeIds = spineComponents.map((c) => specFor(c).nodeId);

  // The merge node both lanes rejoin at: the first spine node AFTER the
  // beginner lane's exit (the beginner lane rides inline in the spine order).
  // Derived from the designer order so the merge follows a reorder (B47).
  const beginnerExitIdx = spineNodeIds.indexOf(FORK_LANES[0].exitNodeId);
  const forkMergeNodeId =
    (beginnerExitIdx >= 0 ? spineNodeIds[beginnerExitIdx + 1] : undefined) ??
    FORK_MERGE_FALLBACK_NODE_ID;

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
    const meta = resolveMeta(designerBeat, spec);
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
        mergeNodeId: forkMergeNodeId,
        context,
        componentType: component,
        componentProps,
        voice: baseVoice,
        meta,
        tool: spec.tool,
        persist: spec.persist,
        ...presentationFields(designerBeat),
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
      meta,
      tool: spec.tool,
      persist: spec.persist,
      ...presentationFields(designerBeat),
    };
    nodeById.set(spec.nodeId, node);
  });

  // Pass 3: advanced lane nodes. Two nodes: advanced-input -> advanced-frequency.
  // advanced-input backId = path-fork (from spec).
  // advanced-frequency nextId = the derived merge node, backId = advanced-input.
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
    voice: {
      ...advCaptureSpec.voice,
      openerText: resolveOpener(advCaptureDesigner, advCaptureSpec),
    },
    meta: resolveMeta(advCaptureDesigner, advCaptureSpec),
    tool: advCaptureSpec.tool,
    persist: advCaptureSpec.persist,
    ...presentationFields(advCaptureDesigner),
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
    nextId: forkMergeNodeId,
    backId: 'advanced-input',
    context: {
      screenId: advFreqScreenId,
      screenName: advFreqSpec.screenName,
      contextBlock: advFreqSpec.contextBlock,
    },
    componentType: 'advanced-frequency',
    componentProps: { ...advFreqSpec.componentProps },
    voice: { ...advFreqSpec.voice, openerText: resolveOpener(advFreqDesigner, advFreqSpec) },
    meta: resolveMeta(advFreqDesigner, advFreqSpec),
    tool: advFreqSpec.tool,
    persist: advFreqSpec.persist,
    ...presentationFields(advFreqDesigner),
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
    const state = stringProp(beat.props, 'state') ?? 'blank';
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
      meta: resolveMeta(beat, spec),
      tool: spec.tool,
      persist: spec.persist,
      ...presentationFields(beat),
    };
  });

  // Pass 4b (STEP-0): custom-entry DETOUR nodes, one per designer beat. These are
  // the create-your-own goal/habit name-it screens: not part of any nextId chain,
  // reached by runtime navigation from the beat they serve (goals-list "Create
  // your own goal" / habit-picker "Create your own habit") and returning to it.
  // nextId stays null (the detour never advances the spine); backId, when
  // authored (meta.engine.backId), names the serving beat. The navigation
  // mechanics land with the custom-entry component work (Lane A A3); the schema
  // carries the nodes so Lane B can author them now.
  const customEntryDesignerBeats = designerFlow.filter(
    (beat) => componentFor(beat.type) === 'custom-entry',
  );
  const customEntryNodes: BeatNode[] = customEntryDesignerBeats.map((beat, idx) => {
    const screenId = screenIdFromSheetStage(beat.sheetStage);
    if (!screenId) {
      throw new Error(
        `designerToFlow: custom-entry beat "${beat.beat ?? '?'}" needs a "SCREEN-ID: Name" sheetStage`,
      );
    }
    const kind = stringProp(beat.props, 'kind') ?? (idx === 0 ? 'goal' : 'habit');
    const nodeId = beat.meta?.engine?.nodeId ?? `custom-entry-${kind}`;
    const name = beat.name ?? `Create your own ${kind}`;
    const opener = stringProp(beat.props, 'coachLine') ?? stringProp(beat.props, 'text') ?? null;
    const componentProps: Record<string, unknown> = { ...(beat.props ?? {}), kind };
    delete componentProps.text;
    delete componentProps.coachLine;
    const voice: VoiceConfig = {
      openerText: opener,
      expectsInput: beat.meta?.engine?.voiceExpectsInput ?? true,
      directLlmAllowed: beat.meta?.engine?.voiceDirectLlmAllowed ?? true,
    };
    const spec: EngineBeatSpec = {
      nodeId,
      beatNumber: 0,
      backId: beat.meta?.engine?.backId ?? null,
      screenId,
      componentProps,
      voice,
      tool: null,
      persist: null,
      screenName: name,
      contextBlock: beat.context ?? '',
    };
    return {
      id: nodeId,
      type: 'beat',
      beatNumber: 0,
      name,
      screenId,
      nextId: null,
      backId: spec.backId,
      context: { screenId, screenName: name, contextBlock: beat.context ?? '' },
      componentType: 'custom-entry',
      componentProps,
      voice,
      meta: resolveMeta(beat, spec),
      tool: null,
      persist: null,
      ...presentationFields(beat),
    };
  });
  const customEntryIds = customEntryNodes.map((n) => n.id);
  const customEntryDupes = customEntryIds.filter((id, i) => customEntryIds.indexOf(id) !== i);
  if (customEntryDupes.length > 0) {
    throw new Error(
      `designerToFlow: duplicate custom-entry node id(s) ${[...new Set(customEntryDupes)].join(', ')}; ` +
        'author distinct meta.engine.nodeId or kind values',
    );
  }

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
  const beginnerComponents: FlowComponentType[] = [
    'category-grid',
    'goals-list',
    'habit-picker',
    'habit-schedule',
  ];
  for (const c of beginnerComponents) {
    const n = nodeById.get(specFor(c).nodeId);
    if (n) nodes.push(n);
  }

  // Advanced lane nodes.
  nodes.push(advCaptureNode);
  nodes.push(advFreqNode);

  // Post-fork merge node and any post-merge spine nodes (into-app etc.).
  const mergeIdx = spineNodeIds.indexOf(forkMergeNodeId);
  for (let i = mergeIdx; i < spineNodeIds.length; i++) {
    const n = nodeById.get(spineNodeIds[i]);
    if (n) nodes.push(n);
  }

  // Weekly projection nodes.
  for (const pn of projectionNodes) nodes.push(pn);

  // Custom-entry detour nodes (STEP-0), after the chains they never sit inside.
  for (const cn of customEntryNodes) nodes.push(cn);

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
