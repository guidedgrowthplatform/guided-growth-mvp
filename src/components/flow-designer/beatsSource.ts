// THE ONE SOURCE for the onboarding render. Each beat lives in ONE entry here:
// the left fields (id, name, order, path, type, context, allowedTools,
// expectedResponse, voiceEngine, voiceMode) plus the right field, script[] (the
// ordered lines the engine plays and runs: seq, words, bindsTo, voice, clip).
// Consolidated once from onboardingMetadata.json + screen_contexts.json (context)
// + beatNarration/voiceClips/clipCaptions (script), which are now retired or thin
// re-exports of this file. The annotated render, the center phone, and #play all
// read this single store. Do NOT re-add a second hand-authored metadata store;
// edit this file. (Pass 2 applies the screenId -> beatId rename.)

import { goalsByCategory } from '@gg/shared/data/onboardingGoals';
import type { BeatConversation, SourceStatus } from './flowBible';

export type BeatPath = 'beginner' | 'advanced' | 'both';
export type VoiceEngine = 'MP3' | 'Cartesia' | 'Vapi' | 'Silent';
export type VoiceMode = 'Verbatim' | 'Generative' | null;
export type ScriptVoice = 'verbatim' | 'mp3' | 'cartesia' | null;
export type BindKind = 'bubble' | 'component';

export interface ScriptLine {
  readonly seq: number;
  readonly words: string;
  readonly bindsTo: { readonly kind: BindKind; readonly element: string; readonly screen: string };
  readonly voice: ScriptVoice;
  readonly clip: string | null;
  readonly clipPath: string | null;
  readonly expectedUser?: string;
}

// Per-beat data passing contract (flowBible DATA_PASSING): dataIn is what this
// beat reads from flow state, dataOut is what it writes forward.
export interface BeatDatum {
  readonly key: string;
  readonly from: 'flow-state' | 'query-param' | 'server-hydration' | 'user';
  readonly writtenBy?: string;
  readonly persistsTo?: string;
  readonly note?: string;
}
export interface BeatIO {
  readonly dataIn: readonly BeatDatum[];
  readonly dataOut: readonly BeatDatum[];
}

// --- Bible sections (the 12-section per-beat contract) ---
// The full-fill schema the annotated render displays as accordion panels. This
// is the reusable foundation for the annotation-scale fill: 6 of these sections
// (rules, persistence, flow, edges, acceptance, applicable-decisions) were ABSENT
// from the beat shape before; the rest (identity aliases, per-line reveal/timing,
// component detail, per-line voice, coach prose, tool arg schemas) formalize what
// was previously only prose. `bible` is optional; only fully-filled beats carry
// it. Enforcer strings are real static-check / eval ids so `check:rules` can
// resolve them. `pending` marks a value that is COPY-PENDING (Yair's final copy).
// Count note: 14 top-level keys = 13 numbered sections (rules split 5/6, conversation = 13) + applicable-decisions.
export interface BibleKV {
  readonly label: string;
  readonly value: string;
  readonly pending?: boolean;
}
export interface BibleAlias {
  readonly surface: string;
  readonly value: string;
}
export interface BibleScriptMeta {
  // Overlays onto the matching script[] line by seq: the two per-line fields the
  // Bible requires that ScriptLine does not carry (reveal gating + timing).
  readonly seq: number;
  readonly reveal: string;
  readonly timing: string;
}
export interface BibleVoiceLine {
  readonly seq: number;
  readonly resolvesTo: string;
  readonly liveAllowed: string;
}
export interface BibleRule {
  readonly id: string;
  readonly rule: string;
  readonly severity: 'must' | 'should';
  readonly enforcedBy: readonly string[];
}
export interface BibleToolSpec {
  readonly tool: string;
  readonly args: string;
  readonly when: string;
  readonly pending?: boolean;
}
export interface BibleEdge {
  readonly edge: string;
  readonly behavior: string;
  // spoken edge behavior must be owned; four VOICE_OWNERSHIP shapes (flowBible.ts)
  readonly voice?: string;
}
export interface BibleAcceptance {
  readonly criterion: string;
  readonly check: string;
}
export interface BibleDecision {
  readonly decision: string;
  readonly binds: boolean;
  readonly how: string;
}

// The 14-key uniform section shape (Yair/conductor 2026-07-09, LOCKED): every
// beat with a bible declares ALL of these, no optional-by-omission sections.
export type BibleSectionKey =
  | 'identity'
  | 'scriptMeta'
  | 'components'
  | 'voice'
  | 'rulesContext'
  | 'rulesCode'
  | 'conversation'
  | 'contextProse'
  | 'allowedTools'
  | 'persistence'
  | 'flow'
  | 'edges'
  | 'acceptance'
  | 'applicableDecisions';
// na = short reason a section does not apply to this beat's type.
// - filled: this beat OWNS the section (authored here, non-empty).
// - derived: the resolver produces this section per-variant from the beat's own
//   props/script + a head Bible (variants only; never a claim of authorship).
// - pending-app-reconcile: legitimately not yet contracted; may be absent.
// - { na }: does not apply to this beat's type; reason required.
export type SectionFillStatus =
  | 'filled'
  | 'derived'
  | 'pending-app-reconcile'
  | { readonly na: string };

export interface BibleSections {
  readonly identity?: {
    readonly rows: readonly BibleKV[];
    readonly aliases: readonly BibleAlias[];
    readonly watchOut?: string;
    readonly enforcedBy: readonly string[];
    readonly status?: SourceStatus;
  };
  readonly scriptMeta?: {
    readonly rows: readonly BibleScriptMeta[];
    readonly enforcedBy: readonly string[];
    readonly status?: SourceStatus;
  };
  readonly components?: {
    readonly rows: readonly BibleKV[];
    readonly watchOut?: string;
    readonly enforcedBy: readonly string[];
    readonly status?: SourceStatus;
  };
  readonly voice?: {
    readonly rows: readonly BibleKV[];
    readonly perLine: readonly BibleVoiceLine[];
    readonly assertion?: string;
    readonly enforcedBy: readonly string[];
    readonly status?: SourceStatus;
  };
  readonly rulesContext?: readonly BibleRule[];
  readonly rulesCode?: readonly BibleRule[];
  // section 13 - multi-turn conversation model (Yair 2026-07-09: own section, not a section-5 sub-block)
  readonly conversation?: BeatConversation;
  readonly contextProse?: {
    readonly prose: string;
    readonly pending?: boolean;
    readonly enforcedBy: readonly string[];
    readonly status?: SourceStatus;
  };
  readonly allowedTools?: {
    readonly tools: readonly string[];
    readonly callRules: string;
    readonly specs: readonly BibleToolSpec[];
    readonly note?: string;
    readonly enforcedBy: readonly string[];
    readonly status?: SourceStatus;
  };
  readonly persistence?: {
    readonly rows: readonly BibleKV[];
    readonly watchOut?: string;
    readonly enforcedBy: readonly string[];
    readonly status?: SourceStatus;
  };
  readonly flow?: {
    readonly rows: readonly BibleKV[];
    readonly enforcedBy: readonly string[];
    readonly status?: SourceStatus;
  };
  readonly edges?: {
    readonly rows: readonly BibleEdge[];
    readonly enforcedBy: readonly string[];
    readonly status?: SourceStatus;
  };
  readonly acceptance?: {
    readonly rows: readonly BibleAcceptance[];
    readonly enforcedBy: readonly string[];
    readonly status?: SourceStatus;
  };
  readonly applicableDecisions?: {
    readonly rows: readonly BibleDecision[];
    readonly enforcedBy: readonly string[];
    readonly status?: SourceStatus;
  };
  // uniform shape (Yair/conductor 2026-07-09): every beat declares ALL sections; non-applicable = explicit na + reason, never silently absent
  readonly sectionManifest: Readonly<Record<BibleSectionKey, SectionFillStatus>>;
}

export interface BeatEntry {
  readonly id: string;
  readonly name: string;
  readonly order: number;
  readonly path: BeatPath;
  readonly type: string;
  readonly variantOf?: string; // sub-beat: inherits bible/io/structure from the named head beat, overrides only what differs (Yair 2026-07-09)
  readonly screenId: string | null;
  readonly context?: string | null;
  readonly allowedTools: string | null;
  readonly expectedResponse: string | null;
  readonly voiceEngine: VoiceEngine;
  readonly voiceMode: VoiceMode;
  readonly hideOrb: boolean;
  readonly props: Record<string, string> | null;
  readonly elements?: readonly string[];
  readonly script: readonly ScriptLine[];
  // beat-to-beat data passing contract (flowBible DATA_PASSING); dataIn from flow state, never DB re-fetch
  readonly io?: BeatIO;
  // The full 12-section fill for this beat, shown as accordion panels in the
  // annotated render. Optional: present only on fully-filled beats.
  readonly bible?: BibleSections;
}

// The coach persona sent every turn, shared by every flow. Sourced from the
// Master Sheet "Beats Context" GLOBAL row (sync-beat-contexts.mjs). One home so
// no flow re-authors the persona.
export const GLOBAL_CONTEXT = `You are the user's coach inside Guided Growth, running the onboarding conversation. It is one continuous chat: you speak, and interactive cards appear as you go. Your job is to get the user set up while making them feel met, not processed.

## The conversation
- It moves in beats. Each beat hands you one thing to collect and how to behave for that moment. Do that one thing. Never do a later beat's work, never skip ahead.
- The moment the current beat's data is captured, move on. Don't ask "ready?" or "shall we continue?" first.
- Carry everything forward. Never re-ask something the user already gave. If they change an earlier answer, accept the correction and keep going.
- If the user answers more than this beat asked ("I'm 34 and I want to sleep better"), take what belongs to this beat now and hold the rest for the beat it belongs to. Don't act on it early.
- Never say the words beat, step, screen, page, card, tool, or system out loud. The user never hears the machinery.

## Paths (you are told which is active, match it)
- Path 1, full voice: the user talks, you talk back. Short lines, natural for speech.
- Path 2, half voice: you speak, the user types or taps. Speak your line, read their answer.
- Path 3, text only: no voice. Short chat lines, the user types or taps.

## How you talk
- Short lines, like a person. One line per beat unless you genuinely need to clarify.
- React to the exact thing they said. No speeches, no lists, no generic praise like "great choice" or "amazing."
- Never tell the user to tap, click, scroll, swipe, or press. If a card is there, they can see it. You keep it moving by talking.
- The opener you are given is a fixed line, and it may be pre-recorded, so it won't contain the user's name. Use their name in your own lines, never assume it's in the opener.
- Warm, direct, a little excited for them. Never make a new user feel behind, never make an experienced one feel tested.
- Match the user's language. If they speak Hebrew or Spanish, continue in it, and switch whenever they do.

## Reading answers
- Each beat gives you the answers it expects and the words people use for them. Map what you hear to one of those, even when it is slang or sloppy. Never invent a value the beat did not list.
- If an answer is unclear or missing, ask one short question to pin it down, then move on. Don't stall, and don't loop the same question more than twice.

## Speak mode
Each beat may carry a SPEAK MODE line. It tells you how much is scripted.
- VERBATIM_OPENER: the opener is your one scripted line. Say it as written, then stop and wait. Don't add to it.
- SILENT_OPTIONS: the beat shows a list of choices on the screen. That list is reference for you to match what the user says to the exact label. It is never something you read out loud.
- GENERATIVE: no script. Phrase it yourself, within the beat's rules.
A beat can combine them (VERBATIM_OPENER + SILENT_OPTIONS). If a beat has no speak mode line, it's generative.

## Component sync
When a beat puts choices on the screen (categories, the things inside a category, habits, reflection styles), the screen shows them. You're not a second screen.
- Don't read the list out loud, not in full, not a few of them, not even one as an example. Your opener already asks the question.
- Ask one short question that points at the choice ("What pulls you?", "Which one fits?"), then stop and wait.
- The option lists in your context are there only so you can match what the user says to the exact label. They're reference, not a script.
- If nothing has appeared for the user yet, don't fill the silence by naming the options. Ask one neutral question like "Is anything coming up for you to pick from?" If they say no, that's a display problem, not a cue to recite the list.

## Tools (how you save)
- Each beat tells you which tool to call and when. Call it only once that beat's data is actually captured, then move on.
- Only call a tool the current beat allows. If you are reaching for any other tool, you are getting ahead. Stop and stay on this beat.
- Pass the canonical values the beat defines, not the user's raw words.
- Never tell the user you are saving, loading, or calling anything. It just happens.

## If something heavy comes up
- The user may share something hard. If they do, drop the setup. Be human first, name it plainly, and don't rush them back. Return to setup only when it feels right.

## Privacy
- The user is about to share real, sometimes vulnerable things. Protect that. Don't read their email or account details back to them. Don't narrate what the system is doing.`;

// --- Goals variant category data (B1: typed per-category source, NOT free-text substitution) ---
//
// The category-sensitive facts of a goals-* beat (its rules wording, its section-13
// conversation branches, its edge examples, its downstream routing example, and its
// dynamic clip families) are NOT derivable by string-substituting the head's prose:
// free-text substitution missed the lowercased category noun, the clip-family roots,
// and the category example labels, leaking the head category ("sleep") onto every
// variant (whole-system QA B1-R, 2026-07-10). Those facts now live here as TYPED
// per-category data, and every category-sensitive section is BUILT from it
// (buildGoals* below), so a variant only ever carries its OWN category tokens.
//
// slug matches the beat-id suffix (goals-<slug>) and the clip-family root
// (onboard_goals_<slug>); prefix is the rule-id prefix (g<slug>, mirrors rulePrefix).
export interface GoalsCategoryData {
  readonly category: string; // canonical label, e.g. 'Move more' (also props.category)
  readonly slug: string; // 'move' — beat-id suffix + clip-root + rule prefix stem
  readonly noun: string; // lowercase category noun used in coach-rule prose
  readonly vagueExample: string; // the "just <x> in general" vague-input example
  readonly downstreamExample: string; // "<a goal> -> habits-<route>" routing example
}

// Authored per head-category. noun/vagueExample/downstreamExample are the ONLY
// genuinely per-category prose facts; everything else (beatId, rule prefix, clip
// root, tile set) derives from slug + goalsByCategory. downstreamExample uses the
// category's first goal and its real habits-* opener beat id.
export const goalsCategoryData: Record<string, GoalsCategoryData> = {
  'Sleep better': {
    category: 'Sleep better',
    slug: 'sleep',
    noun: 'sleep',
    vagueExample: 'just sleep in general',
    downstreamExample: 'Fall asleep earlier -> habits-fall-asleep-earlier',
  },
  'Move more': {
    category: 'Move more',
    slug: 'move',
    noun: 'movement',
    vagueExample: 'just moving more in general',
    downstreamExample: 'Walk more -> habits-walk-more',
  },
  'Eat better': {
    category: 'Eat better',
    slug: 'eat',
    noun: 'eating',
    vagueExample: 'just eating better in general',
    downstreamExample: 'Eat more intentionally -> habits-eat-intentionally',
  },
  'Feel more energized': {
    category: 'Feel more energized',
    slug: 'energy',
    noun: 'energy',
    vagueExample: 'just more energy in general',
    downstreamExample: 'Have more morning energy -> habits-morning-energy',
  },
  'Reduce stress': {
    category: 'Reduce stress',
    slug: 'stress',
    noun: 'stress',
    vagueExample: 'just less stress in general',
    downstreamExample: 'Feel calmer during the day -> habits-calmer-day',
  },
  'Improve focus': {
    category: 'Improve focus',
    slug: 'focus',
    noun: 'focus',
    vagueExample: 'just better focus in general',
    downstreamExample: 'Start work with less friction -> habits-start-work',
  },
  'Break bad habits': {
    category: 'Break bad habits',
    slug: 'break',
    noun: 'habit change',
    vagueExample: 'just breaking habits in general',
    downstreamExample: 'Smoking -> habits-smoking',
  },
  'Get more organized': {
    category: 'Get more organized',
    slug: 'organize',
    noun: 'organization',
    vagueExample: 'just being more organized in general',
    downstreamExample: 'Stay on top of tasks -> habits-stay-on-tasks',
  },
};

function goalsBeatId(data: GoalsCategoryData): string {
  return `goals-${data.slug}`;
}
function goalsRulePrefix(data: GoalsCategoryData): string {
  return `g${data.slug}`;
}
function goalsClipRoot(data: GoalsCategoryData): string {
  return `onboard_goals_${data.slug}`;
}

// Head-category SEMANTIC leak tokens: the case-normalized tokens that must NOT
// survive onto a NON-head variant's resolved sections. Used by the resolver-level
// semantic guard (bible-registry-check + variant-semantic-leak test). These are
// exactly the tokens free-text substitution missed.
export function goalsSemanticTokens(category: string): readonly string[] {
  const data = goalsCategoryData[category];
  if (!data) return [];
  const goalExample = data.downstreamExample.split('->')[0]?.trim() ?? '';
  return [
    data.noun, // "sleep"
    goalsClipRoot(data), // "onboard_goals_sleep"
    goalsBeatId(data), // "goals-sleep"
    goalExample, // "Fall asleep earlier"
  ].filter((t) => t.length > 0);
}

// --- Category-sensitive section builders (single template, per-category data) ---
// Each returns the section BUILT from goalsCategoryData, so the head (goals-sleep)
// and every variant produce identical structure with their OWN category tokens.
// buildGoals*(goalsCategoryData['Sleep better']) reproduces the head's authored
// section byte-for-byte (locked by the goals-variant-parity test).
export function buildGoalsRulesContext(data: GoalsCategoryData): readonly BibleRule[] {
  const p = goalsRulePrefix(data);
  const n = data.noun;
  return [
    {
      id: `${p}-verbatim-opener`,
      rule: `Speaks the recorded ${n} opener verbatim, no improvised lead-in or addition`,
      severity: 'must',
      enforcedBy: ['eval:verbatim-opener'],
    },
    {
      id: `${p}-no-read-options`,
      rule: 'Never reads the goal tiles aloud, not in full, not one as an example',
      severity: 'must',
      enforcedBy: ['eval:no-read-options'],
    },
    {
      id: `${p}-react-and-ask`,
      rule: `React warmly and ask for goals in one merged moment, naming the category (${n}) once`,
      severity: 'must',
      enforcedBy: ['eval:warm-opener'],
    },
    {
      id: `${p}-no-contrarian`,
      rule: `No reframe that undercuts the pick ("${n} isn't really the issue")`,
      severity: 'must',
      enforcedBy: ['eval:no-contrarian'],
    },
    {
      id: `${p}-no-platitudes`,
      rule: `No per-goal commentary or filler ("${n} is the foundation", "genuinely")`,
      severity: 'must',
      enforcedBy: ['eval:no-platitudes'],
    },
    {
      id: `${p}-silent-after-pick`,
      rule: 'Silent after each pick: no praise, no commentary, nothing except submit_goals and advance_step',
      severity: 'must',
      enforcedBy: ['eval:silent-after-pick'],
    },
    {
      id: `${p}-one-line-wait`,
      rule: 'After the opener, asks one short pointer question then waits',
      severity: 'must',
      enforcedBy: ['eval:one-line-then-wait'],
    },
    {
      id: `${p}-one-or-two`,
      rule: 'Allows one or two goals only; on three, asks which two matter most',
      severity: 'must',
      enforcedBy: ['eval:selection-cap'],
    },
  ];
}

export function buildGoalsConversation(data: GoalsCategoryData): BeatConversation {
  const root = goalsClipRoot(data);
  return {
    opens:
      'after the opener question ("Which of these would you like to start with? Pick one or two.")',
    branches: [
      {
        on: 'names or taps one or two valid goals',
        reply: 'none (silent after pick); map to the exact labels',
        then: 'tool:submit_goals',
      },
      {
        on: 'names three or more',
        reply: 'scripted: "Which two matter most right now?"',
        then: 'wait',
        voice: `clip-family:${root}_2 (pending recording)`,
      },
      {
        on: `vague or general ("${data.vagueExample}")`,
        reply: 'scripted: "If you had to pick one, what bothers you most?"',
        then: 'wait',
        voice: `clip-family:${root}_3 (pending recording)`,
      },
      {
        on: 'off-topic or world question',
        reply:
          'global rule glob-out-of-scope: one brief acknowledgement, steer back with the goal question',
        then: 'wait',
        voice: 'clip-family:onboard_offtopic (pending recording)',
      },
    ],
    maxTurns: 4,
    onMaxTurns: 'plain one-line re-ask of the goal question and point to the tap path',
  };
}

export function buildGoalsFlow(data: GoalsCategoryData): NonNullable<BibleSections['flow']> {
  return {
    rows: [
      {
        label: 'advance condition',
        value: 'submit_goals fired with 1 to 2 valid goals, then advance_step',
      },
      {
        label: 'upstream branch (into this beat)',
        value: `the category picked upstream (${data.category}) routes to this ${goalsBeatId(
          data,
        )} variant; the other 7 categories route to their matching goals-* beat`,
      },
      {
        label: 'downstream branch (out of this beat)',
        value: `the goal count sets up the habit distribution: two goals -> the next beat gives one habit per goal; one goal -> the next beat allows one or two habits. Each picked goal routes to its matching habits-* opener (e.g. ${data.downstreamExample})`,
      },
      {
        label: 'gate',
        value: `one or two goals; if the user names three, the coach resolves to two before the tool fires (${goalsRulePrefix(
          data,
        )}-one-or-two)`,
      },
    ],
    enforcedBy: ['advance-gate-check'],
  };
}

export function buildGoalsEdges(data: GoalsCategoryData): NonNullable<BibleSections['edges']> {
  const root = goalsClipRoot(data);
  return {
    rows: [
      {
        edge: 'tool failure',
        behavior:
          'submit_goals errors: retry once quietly. If it still fails, SURFACE it, never fail silently, and do not advance. Tap/text path: a toast "Couldn\'t save that, tap to retry" and the picked tiles stay selected for the retry. Voice path: one short coach line "That didn\'t go through, let me try again." (Yair-approved tool-failure contract, 2026-07-09.)',
        voice: `clip-family:${root}_edge_1 (pending recording)`,
      },
      {
        edge: 'off-topic input',
        behavior:
          'one short acknowledgement, at most one sentence, no new topic and no advice, then re-ask the goal question ("Which of these feels right to start with?"). Do not follow the tangent, do not add commentary, do not advance.',
        voice: `clip-family:${root}_edge_2 (pending recording)`,
      },
      {
        edge: 'skip / decline',
        behavior:
          'user will not choose: falls to the plain one-line re-ask and the tap path (max-turns behavior, no brainstorm; copy-decisions 2026-07-10), never force a pick',
      },
      {
        edge: 'empty state',
        behavior:
          'no tiles appeared for the user: ask one neutral question ("Is anything coming up for you to pick from?"), do NOT recite the goal list to fill the silence',
        voice: `clip-family:${root}_edge_4 (pending recording)`,
      },
      {
        edge: 'names three',
        behavior: 'ask which two matter most, then take those two',
      },
      {
        edge: `vague / general ("${data.vagueExample}")`,
        behavior:
          'map to the closest label or ask one short question to pin it ("If you had to pick one, what bothers you most?"); never invent a label',
        voice: `clip-family:${root}_edge_6 (pending recording)`,
      },
    ],
    enforcedBy: ['eval:edge-walk'],
  };
}

// --- Habits variant goal data (typed per-goal source, NOT free-text substitution) ---
//
// The habits family differs structurally from goals: the HEAD (`habits`) is the
// GENERIC multi-goal habit picker (props.goal is absent, opener "Pick one or two
// habits that feel doable..."), and its ~29 children are per-GOAL openers
// (variantOf: 'habits'). So the category-sensitive dimension here is the GOAL, not
// a category. As with goals (B1-R), the category-sensitive facts of a per-goal
// habits-* beat — its rules wording (which names the goal), its section-13
// conversation branches, its edge examples, its flow routing, and its dynamic clip
// families — are BUILT from this typed per-goal data (buildHabits* below), never
// string-substituted from the head, so a variant only ever carries its OWN goal
// tokens and never the head's generic clip / id / screenId.
//
// idSlug is the beat-id suffix (habits-<idSlug>); the clip-family root is
// onboard_beginner_03_goal_<idSlug with '-' -> '_'>, and the rule-id prefix is
// rulePrefix(habits-<idSlug>) = 'h<idSlug without hyphens>'. goal is props.goal.
export interface HabitsGoalData {
  readonly goal: string; // canonical label, e.g. 'Fall asleep earlier' (also props.goal)
  readonly idSlug: string; // beat-id + clip-root + rule-prefix stem, e.g. 'fall-asleep-earlier'
}

// One entry per per-goal habits-* variant (order 23..51). Authored to match the
// existing source beat ids / clip ids exactly (idSlug -> habits-<idSlug> and
// onboard_beginner_03_goal_<idSlug _-underscored>).
export const habitsGoalData: Record<string, HabitsGoalData> = {
  'Fall asleep earlier': { goal: 'Fall asleep earlier', idSlug: 'fall-asleep-earlier' },
  'Wake up earlier': { goal: 'Wake up earlier', idSlug: 'wake-earlier' },
  'Sleep more consistently': { goal: 'Sleep more consistently', idSlug: 'sleep-consistently' },
  'Sleep more deeply': { goal: 'Sleep more deeply', idSlug: 'sleep-deeply' },
  'Walk more': { goal: 'Walk more', idSlug: 'walk-more' },
  'Exercise consistently': { goal: 'Exercise consistently', idSlug: 'exercise-consistently' },
  'Improve mobility': { goal: 'Improve mobility', idSlug: 'mobility' },
  'Eat more intentionally': { goal: 'Eat more intentionally', idSlug: 'eat-intentionally' },
  'Reduce overeating': { goal: 'Reduce overeating', idSlug: 'reduce-overeating' },
  'Plan food better': { goal: 'Plan food better', idSlug: 'plan-food' },
  'Have more morning energy': { goal: 'Have more morning energy', idSlug: 'morning-energy' },
  'Avoid afternoon crashes': { goal: 'Avoid afternoon crashes', idSlug: 'avoid-crashes' },
  'Keep energy more stable': { goal: 'Keep energy more stable', idSlug: 'stable-energy' },
  'Feel calmer during the day': { goal: 'Feel calmer during the day', idSlug: 'calmer-day' },
  'Reduce evening stress': { goal: 'Reduce evening stress', idSlug: 'evening-stress' },
  'Feel less overwhelmed': { goal: 'Feel less overwhelmed', idSlug: 'less-overwhelmed' },
  'Start work with less friction': {
    goal: 'Start work with less friction',
    idSlug: 'start-work',
  },
  'Do deeper work': { goal: 'Do deeper work', idSlug: 'deeper-work' },
  'Procrastinate less': { goal: 'Procrastinate less', idSlug: 'procrastinate-less' },
  Smoking: { goal: 'Smoking', idSlug: 'smoking' },
  Weed: { goal: 'Weed', idSlug: 'weed' },
  Alcohol: { goal: 'Alcohol', idSlug: 'alcohol' },
  Porn: { goal: 'Porn', idSlug: 'porn' },
  'Phone use': { goal: 'Phone use', idSlug: 'phone-use' },
  'Late-night snacking': { goal: 'Late-night snacking', idSlug: 'late-snacking' },
  Caffeine: { goal: 'Caffeine', idSlug: 'caffeine' },
  'Stay on top of tasks': { goal: 'Stay on top of tasks', idSlug: 'stay-on-tasks' },
  'Keep spaces tidy': { goal: 'Keep spaces tidy', idSlug: 'tidy-spaces' },
  'Handle life admin better': { goal: 'Handle life admin better', idSlug: 'life-admin' },
};

function habitsBeatId(data: HabitsGoalData): string {
  return `habits-${data.idSlug}`;
}
function habitsClipRoot(data: HabitsGoalData): string {
  return `onboard_beginner_03_goal_${data.idSlug.replace(/-/g, '_')}`;
}
function habitsRulePrefix(data: HabitsGoalData): string {
  return rulePrefix(habitsBeatId(data)); // 'h' + idSlug without hyphens
}
// Lowercase goal reference used in per-goal coach-rule prose.
function habitsGoalRef(data: HabitsGoalData): string {
  return data.goal.toLowerCase();
}

// The habits HEAD is the GENERIC picker (no goal), so unlike goals it exposes no
// per-goal noun/example to leak. Its one head-specific SEMANTIC token is its
// generic opener clip, which no per-goal variant ever carries (variant openers
// resolve to onboard_beginner_03_goal_<slug>). This non-empty, variant-absent
// token satisfies the family-guard non-trivial-contract requirement without false
// leaks; the REAL per-goal leak protection for this family is the typed-path
// rebuild of the 4 category-sensitive sections (buildHabits*), enforced by the
// substitution-path guard. Keep this in sync with the canonical generator in
// dump-resolved-beats.mts.
export const HABITS_HEAD_CLIP = 'onboard_beginner_03_1';
export function habitsSemanticTokens(): readonly string[] {
  return [HABITS_HEAD_CLIP];
}

// --- Category-sensitive section builders for the habits family (single template,
// per-goal data) --- Each returns the section BUILT from HabitsGoalData, so every
// per-goal variant produces identical structure with its OWN goal tokens (goal
// reference, clip family, beatId, rule prefix). The head authors GENERIC versions
// inline (it names no goal), so these builders serve the variants only.
export function buildHabitsRulesContext(data: HabitsGoalData): readonly BibleRule[] {
  const p = habitsRulePrefix(data);
  const ref = habitsGoalRef(data);
  return [
    {
      id: `${p}-verbatim-opener`,
      rule: `Speaks the recorded ${ref} opener verbatim, naming the goal, no improvised lead-in or addition`,
      severity: 'must',
      enforcedBy: ['eval:verbatim-opener', 'eval:name-the-goal'],
    },
    {
      id: `${p}-count-agnostic`,
      rule: 'Opener wording works whether one or two goals were picked upstream',
      severity: 'must',
      enforcedBy: ['eval:count-agnostic'],
    },
    {
      id: `${p}-no-read-list`,
      rule: 'Never reads the habit list aloud, in full or in part, not even one as an example',
      severity: 'must',
      enforcedBy: ['eval:no-read-options'],
    },
    {
      id: `${p}-no-sublists`,
      rule: 'Never reads sub-lists or anything the screen is not currently showing',
      severity: 'must',
      enforcedBy: ['eval:no-read-options'],
    },
    {
      id: `${p}-match-canonical`,
      rule: "Matches the user's words to the closest canonical habit name; never invents a habit not on the list",
      severity: 'must',
      enforcedBy: ['eval:invalid-value-redirect'],
    },
    {
      id: `${p}-keep-the-gem`,
      rule: 'Keeps the less-is-more point: one kept habit beats five, small on purpose',
      severity: 'must',
      enforcedBy: ['eval:keep-the-gem'],
    },
    {
      id: `${p}-one-per-goal`,
      rule: 'With two goals, takes exactly one habit per goal; never two for a single goal',
      severity: 'must',
      enforcedBy: ['eval:single-select'],
    },
    {
      id: `${p}-silent-after-pick`,
      rule: 'Silent after each pick: no praise or commentary, nothing except add_habit, remove_habit and advance_step',
      severity: 'must',
      enforcedBy: ['eval:silent-after-pick'],
    },
    {
      id: `${p}-no-motivation`,
      rule: 'No commentary or motivation after each pick',
      severity: 'must',
      enforcedBy: ['eval:no-platitudes'],
    },
  ];
}

export function buildHabitsConversation(data: HabitsGoalData): BeatConversation {
  const root = habitsClipRoot(data);
  return {
    opens: 'after the per-goal opener names the goal and asks for a habit or two',
    branches: [
      {
        on: 'names or taps a valid habit (one per goal, or one to two for a single goal)',
        reply: 'none (silent after pick); map to the exact canonical habit name',
        then: 'tool:add_habit',
      },
      {
        on: 'names more habits than the cap allows',
        reply: 'scripted: "Let\'s keep it to one or two for now. Which matters most?"',
        then: 'wait',
        voice: `clip-family:${root}_2 (pending recording)`,
      },
      {
        on: 'offers a habit not on the list',
        reply:
          'accept it as a custom habit ("Create your own"); do not force it onto a canonical name',
        then: 'tool:add_habit',
        voice: `clip-family:${root}_3 (pending recording)`,
      },
      {
        on: 'off-topic or world question',
        reply:
          'global rule glob-out-of-scope: one brief acknowledgement, steer back with the habit question',
        then: 'wait',
        voice: 'clip-family:onboard_offtopic (pending recording)',
      },
    ],
    maxTurns: 4,
    onMaxTurns: 'plain one-line re-ask of the habit question and point to the tap path',
  };
}

export function buildHabitsFlow(data: HabitsGoalData): NonNullable<BibleSections['flow']> {
  return {
    rows: [
      {
        label: 'advance condition',
        value: 'add_habit fired with at least one habit within the cap, then advance_step',
      },
      {
        label: 'upstream branch (into this beat)',
        value: `the goal picked upstream (${data.goal}) routes to this ${habitsBeatId(
          data,
        )} variant; each other picked goal routes to its matching habits-* beat`,
      },
      {
        label: 'downstream branch (out of this beat)',
        value:
          'once the habit(s) are captured within the cap, onboarding continues to the next step (schedule / day-picker), then the reflection beats',
      },
      {
        label: 'gate',
        value: `at least one habit to advance; at most two habits total; with two goals, exactly one habit per goal (${habitsRulePrefix(
          data,
        )}-habit-cap)`,
      },
    ],
    enforcedBy: ['advance-gate-check'],
  };
}

export function buildHabitsEdges(data: HabitsGoalData): NonNullable<BibleSections['edges']> {
  const root = habitsClipRoot(data);
  return {
    rows: [
      {
        edge: 'tool failure',
        behavior:
          'add_habit errors: retry once quietly. If it still fails, SURFACE it, never fail silently, and do not advance. Tap/text path: a toast "Couldn\'t save that, tap to retry" and the picked habit stays selected for the retry. Voice path: one short coach line "That didn\'t go through, let me try again." (Yair-approved tool-failure contract, 2026-07-09.)',
        voice: `clip-family:${root}_edge_1 (pending recording)`,
      },
      {
        edge: 'off-topic input',
        behavior:
          'one short acknowledgement, at most one sentence, no new topic and no advice, then re-ask the habit question ("Which of these feels doable to start with?"). Do not follow the tangent, do not add commentary, do not advance.',
        voice: `clip-family:${root}_edge_2 (pending recording)`,
      },
      {
        edge: 'skip / decline',
        behavior: `user will not pick: at least one habit is needed to continue; help them find one small doable habit (${habitsRulePrefix(
          data,
        )}-keep-the-gem), never force a heroic one`,
      },
      {
        edge: 'empty state',
        behavior:
          'no habit options appeared for the user: ask one neutral question ("Is there one small thing you could keep?"), do NOT recite the habit list to fill the silence',
        voice: `clip-family:${root}_edge_4 (pending recording)`,
      },
      {
        edge: 'over the cap',
        behavior:
          'user wants three or more habits: keep it to one or two, ask which matter most, then take those',
      },
      {
        edge: 'not on the list / custom',
        behavior:
          'user offers something not on the list: accept it as a custom habit ("Create your own"); never force it onto a canonical name and never invent one',
        voice: `clip-family:${root}_edge_6 (pending recording)`,
      },
    ],
    enforcedBy: ['eval:edge-walk'],
  };
}

export function buildHabitsRulesCode(data: HabitsGoalData): readonly BibleRule[] {
  const p = habitsRulePrefix(data);
  const clipRoot = habitsClipRoot(data);
  return [
    {
      id: `${p}-tools-only`,
      rule: 'Only add_habit, remove_habit and advance_step are callable on this beat',
      severity: 'must',
      enforcedBy: ['tool-contract-check'],
    },
    {
      id: `${p}-canonical-values`,
      rule: 'add_habit passes the exact canonical habit name (never the raw words), or a custom name only when the user offers one not on the list',
      severity: 'must',
      enforcedBy: ['tool-contract-check'],
    },
    {
      id: `${p}-advance-on-tool`,
      rule: 'advance_step fires only after at least one habit is captured within the cap',
      severity: 'must',
      enforcedBy: ['advance-gate-check'],
    },
    {
      id: `${p}-habit-cap`,
      rule: 'At most two habits total; with two goals, one habit per goal; floor of one habit to advance',
      severity: 'must',
      enforcedBy: ['advance-gate-check'],
    },
    {
      id: `${p}-reveal-gates`,
      rule: 'The habit options reveal gates on the opener clip end, never a fixed timer',
      severity: 'must',
      enforcedBy: ['reveal-timing-check'],
    },
    {
      id: `${p}-audio-ownership`,
      rule: 'The opener resolves to a recorded clip; no live Cartesia (no {name} slot)',
      severity: 'must',
      enforcedBy: ['audio-ownership-check'],
    },
    {
      id: `${p}-clip-resolves`,
      rule: `${clipRoot} resolves to a real asset`,
      severity: 'must',
      enforcedBy: ['render-link-integrity-check'],
    },
    {
      id: `${p}-id-alias`,
      rule: 'beatId maps to the screenId / route / step / session_log / data-beat-id in identity',
      severity: 'must',
      enforcedBy: ['id-alias-check'],
    },
  ];
}

// --- Category-grid family data (typed head-family source) ---
//
// The category-grid family has a GENERIC head (`category`, props: null — the
// category PICKER that shows every recommended category) and a single variant
// (`category-women`, the women's-art render, selected by gender === 'Female').
// Unlike goals-list / habit-picker, that sole variant AUTHORS its own full
// 14-section bible, so it DERIVES nothing: no category-sensitive section is ever
// rebuilt from typed data or free-text-substituted for it, and the resolver-level
// leak scan (which runs only over derivedSections) never touches it. This typed
// data therefore exists to satisfy the FAMILY-CONTRACT guard (bible-registry-check
// step 3c): a bible-bearing head with variant children MUST expose a per-family
// semantic-token set that MATCHES a canonical set regenerated from this typed data.
// The family token is the head's generic opener clip (mirror of the habits
// head-clip contract, HABITS_HEAD_CLIP). It is NOT justified by variant-absence
// (category-women shares this opener clip) but by derives-nothing: the sole variant
// authors every section, so the token is never leak-scanned against it. Keep it in
// sync with the canonical generator in dump-resolved-beats.mts.
//
// If a FUTURE category-grid variant ever DERIVES a category-sensitive section
// (rulesContext / conversation / flow / edges) instead of authoring it, add
// buildCategory* builders here and a resolveBeatStructure step-3b branch gated on
// type === 'category-grid', exactly as goals-list / habit-picker do, so the derived
// section is built from this typed data and its tokens stay per-variant.
export interface CategoryGridData {
  readonly headClip: string; // the picker head's generic opener clip family
}
export const categoryData: CategoryGridData = {
  headClip: 'onboard_beginner_01_1',
};
export function categorySemanticTokens(): readonly string[] {
  return [categoryData.headClip];
}

export const BEATS_SOURCE: readonly BeatEntry[] = [
  {
    id: 'splash',
    name: 'Splash',
    order: 0,
    path: 'both',
    type: 'splash',
    screenId: null,
    context: null,
    allowedTools: null,
    expectedResponse: null,
    voiceEngine: 'Silent',
    voiceMode: null,
    hideOrb: false,
    props: null,
    // EXEMPLAR (pre-fill, archetype = SILENT structural beat): the pre-auth brand
    // splash. It shows a component but has no coach audio, no coach turn, no tool,
    // and saves nothing. identity / components / flow / acceptance are owner-filled;
    // the other ten sections are legitimately { na }.
    bible: {
      sectionManifest: {
        identity: 'filled',
        scriptMeta: { na: 'no script lines — the splash plays no coach audio' },
        components: 'filled',
        voice: { na: 'silent structural beat — the coach does not speak on the splash' },
        rulesContext: { na: 'no coach turn — the splash shows branding and moves on' },
        rulesCode: { na: 'structural splash; no beat-specific code gate to bind' },
        conversation: { na: 'no user turn — the splash proceeds on its own' },
        contextProse: { na: 'no coach/LLM context — nothing is read on the splash' },
        allowedTools: { na: 'no tools — the splash captures and saves nothing' },
        persistence: { na: 'writes nothing — the splash captures no user data' },
        flow: 'filled',
        edges: { na: 'no input and no tool — the splash has no edge branches' },
        acceptance: 'filled',
        applicableDecisions: {
          na: 'no product decision (1-7) binds on the pre-auth branding splash',
        },
      },
      identity: {
        rows: [
          { label: 'beatId (canonical)', value: 'splash' },
          { label: 'name', value: 'Splash' },
          { label: 'order', value: '0' },
          { label: 'path', value: 'both' },
          { label: 'type', value: 'splash' },
        ],
        aliases: [
          { surface: 'screenId', value: 'none (pre-screen splash; screenId is null in source)' },
          { surface: 'route', value: '/onboarding/splash (app launch)' },
          { surface: 'persisted current_step', value: 'splash' },
          { surface: 'session_log value', value: 'splash' },
          { surface: 'data-beat-id', value: 'splash' },
        ],
        watchOut:
          'screenId is null in source (the splash is pre-screen); the beatId is the only unique key. id-alias-check exempts screenId from cross-beat uniqueness.',
        enforcedBy: ['id-alias-check'],
      },
      components: {
        rows: [
          { label: 'component (registry key)', value: 'splash' },
          {
            label: 'on-screen',
            value: 'the brand splash (logo / wordmark); no interactive controls',
          },
          { label: 'selection mode', value: 'none — nothing to select on the splash' },
          { label: 'exact state', value: 'static branding on cold start; no inputs appear' },
        ],
        enforcedBy: ['component-registry-check'],
      },
      flow: {
        rows: [
          {
            label: 'advance condition',
            value: 'the splash displays on cold start, then the flow proceeds to get-started',
          },
          { label: 'upstream branch (into this beat)', value: 'app launch / cold-start entry' },
          {
            label: 'downstream branch (out of this beat)',
            value: 'proceeds to get-started (order 1)',
          },
          { label: 'gate', value: 'none — structural splash, no user gate' },
        ],
        enforcedBy: ['advance-gate-check'],
      },
      acceptance: {
        rows: [
          {
            criterion: 'shows the right thing',
            check: 'the brand splash renders on cold start; no interactive tiles or inputs appear',
          },
          {
            criterion: 'stays silent',
            check: 'no coach audio or bubble plays (silent structural beat)',
          },
          {
            criterion: 'advances correctly',
            check: 'the flow proceeds to get-started with no user action required',
          },
        ],
        enforcedBy: ['component-registry-check', 'eval:parity-walk'],
      },
    },
    script: [],
    io: {
      dataIn: [],
      dataOut: [],
    },
  },
  {
    id: 'get-started',
    name: 'Get started',
    order: 1,
    path: 'both',
    type: 'get-started',
    screenId: null,
    context: null,
    allowedTools: null,
    expectedResponse: null,
    voiceEngine: 'Silent',
    voiceMode: null,
    hideOrb: false,
    props: null,
    // Archetype = SILENT structural beat (mirrors splash): a single "Get started"
    // affordance that advances the flow on tap. No coach audio, no coach turn, no
    // tool, saves nothing. identity / components / flow / acceptance owner-filled;
    // the other ten sections are legitimately { na }.
    bible: {
      sectionManifest: {
        identity: 'filled',
        scriptMeta: { na: 'no script lines — the get-started beat plays no coach audio' },
        components: 'filled',
        voice: { na: 'silent structural beat — the coach does not speak here' },
        rulesContext: { na: 'no coach turn — the beat shows one affordance and moves on' },
        rulesCode: { na: 'structural beat; no beat-specific code gate to bind' },
        conversation: { na: 'no user dialogue — a single tap proceeds' },
        contextProse: { na: 'no coach/LLM context — nothing is read on this beat' },
        allowedTools: { na: 'no tools — the get-started tap captures and saves nothing' },
        persistence: { na: 'writes nothing — the get-started tap captures no user data' },
        flow: 'filled',
        edges: { na: 'single tap to proceed — no branch or failure path' },
        acceptance: 'filled',
        applicableDecisions: {
          na: 'no product decision (1-7) binds on the pre-auth get-started affordance',
        },
      },
      identity: {
        rows: [
          { label: 'beatId (canonical)', value: 'get-started' },
          { label: 'name', value: 'Get started' },
          { label: 'order', value: '1' },
          { label: 'path', value: 'both' },
          { label: 'type', value: 'get-started' },
        ],
        aliases: [
          { surface: 'screenId', value: 'none (pre-screen; screenId is null in source)' },
          { surface: 'route', value: '/onboarding/get-started (app launch continuation)' },
          { surface: 'persisted current_step', value: 'get-started' },
          { surface: 'session_log value', value: 'get-started' },
          { surface: 'data-beat-id', value: 'get-started' },
        ],
        watchOut:
          'screenId is null in source (pre-screen affordance); the beatId is the only unique key. id-alias-check exempts screenId from cross-beat uniqueness.',
        enforcedBy: ['id-alias-check'],
      },
      components: {
        rows: [
          { label: 'component (registry key)', value: 'get-started' },
          {
            label: 'on-screen',
            value: 'a single "Get started" affordance over the brand frame; no other controls',
          },
          { label: 'selection mode', value: 'single action (Get started), no preselection' },
          { label: 'exact state', value: 'static frame on entry; nothing is selected' },
        ],
        enforcedBy: ['component-registry-check'],
      },
      flow: {
        rows: [
          { label: 'advance condition', value: 'the user taps Get started' },
          { label: 'upstream branch (into this beat)', value: 'the splash proceeds here' },
          {
            label: 'downstream branch (out of this beat)',
            value: 'proceeds to coach-greeting (order 2)',
          },
          { label: 'gate', value: 'none beyond the tap; there is nothing to validate' },
        ],
        enforcedBy: ['advance-gate-check'],
      },
      acceptance: {
        rows: [
          {
            criterion: 'shows the right thing',
            check: 'the get-started frame renders with the single Get started affordance',
          },
          {
            criterion: 'stays silent',
            check: 'no coach audio or bubble plays (silent structural beat)',
          },
          {
            criterion: 'advances correctly',
            check: 'the tap proceeds to coach-greeting; no data is captured',
          },
        ],
        enforcedBy: ['component-registry-check', 'eval:parity-walk'],
      },
    },
    script: [],
    io: {
      dataIn: [],
      dataOut: [],
    },
  },
  {
    id: 'coach-greeting',
    name: 'Coach greeting',
    order: 2,
    path: 'both',
    type: 'splash-intro',
    screenId: 'COACH-GREETING',
    allowedTools: null,
    expectedResponse: 'Auto-advances',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: true,
    props: null,
    // EXEMPLAR (pre-fill, archetype = non-conversational MP3 beat): proves the
    // uniform manifest for a beat that speaks one recorded line then auto-advances,
    // with no interactive component, no user turn, and no data write. components /
    // conversation / allowedTools / persistence are legitimately { na }.
    bible: {
      sectionManifest: {
        identity: 'filled',
        scriptMeta: 'filled',
        components: { na: 'no interactive component — a single coach bubble that auto-advances' },
        voice: 'filled',
        rulesContext: 'filled',
        rulesCode: 'filled',
        conversation: { na: 'single-turn — the beat auto-advances; the user has no turn here' },
        contextProse: 'filled',
        allowedTools: { na: 'no tools — nothing is captured or saved on this beat' },
        persistence: { na: 'writes nothing — this beat captures no user data' },
        flow: 'filled',
        edges: 'filled',
        acceptance: 'filled',
        applicableDecisions: 'filled',
      },
      identity: {
        rows: [
          { label: 'beatId (canonical)', value: 'coach-greeting' },
          { label: 'name', value: 'Coach greeting' },
          { label: 'order', value: '2' },
          { label: 'path', value: 'both' },
          { label: 'type', value: 'splash-intro' },
        ],
        aliases: [
          { surface: 'screenId', value: 'COACH-GREETING' },
          { surface: 'route', value: '/onboarding/coach-greeting' },
          { surface: 'persisted current_step', value: 'coach-greeting' },
          { surface: 'session_log value', value: 'coach-greeting' },
          { surface: 'data-beat-id', value: 'coach-greeting' },
        ],
        enforcedBy: ['id-alias-check'],
      },
      scriptMeta: {
        rows: [
          {
            seq: 1,
            reveal: 'opener bubble on entry; no gate (this is the first spoken line)',
            timing: 'karaoke per-word on the bubble; the flow auto-advances on clip end',
          },
        ],
        enforcedBy: ['render-link-integrity-check', 'reveal-timing-check'],
      },
      voice: {
        rows: [
          { label: 'engine', value: 'MP3' },
          { label: 'mode', value: 'Verbatim (enum is Verbatim / Generative)' },
        ],
        perLine: [{ seq: 1, resolvesTo: 'recorded clip coach_greeting', liveAllowed: 'NO' }],
        assertion:
          'The greeting carries no live slot like {name}, so the one spoken line MUST resolve to the recorded clip coach_greeting. No live Cartesia on this beat.',
        enforcedBy: ['audio-ownership-check'],
      },
      rulesContext: [
        {
          id: 'greet-verbatim-opener',
          rule: 'Speaks the recorded greeting verbatim, no improvised lead-in or addition',
          severity: 'must',
          enforcedBy: ['eval:verbatim-opener'],
        },
        {
          id: 'greet-no-machinery',
          rule: 'Never names the machinery (beat / step / screen / tool) in the greeting',
          severity: 'must',
          enforcedBy: ['eval:no-machinery-words'],
        },
      ],
      rulesCode: [
        {
          id: 'greet-audio-ownership',
          rule: 'The greeting resolves to a recorded clip; no live Cartesia (no {name} slot)',
          severity: 'must',
          enforcedBy: ['audio-ownership-check'],
        },
        {
          id: 'greet-clip-resolves',
          rule: 'coach_greeting resolves to a real asset',
          severity: 'must',
          enforcedBy: ['render-link-integrity-check'],
        },
        {
          id: 'greet-id-alias',
          rule: 'beatId maps to the screenId / route / step / session_log / data-beat-id in identity',
          severity: 'must',
          enforcedBy: ['id-alias-check'],
        },
      ],
      contextProse: {
        prose:
          'First hello. The orb blooms and the coach speaks for the first time: one warm recorded line that lands the surprise of a real voice and invites the user in. Then the flow auto-advances. No component, no user turn, nothing saved.',
        enforcedBy: ['eval:parity-walk'],
      },
      flow: {
        rows: [
          { label: 'advance condition', value: 'auto-advances when the greeting clip ends' },
          { label: 'upstream branch (into this beat)', value: 'get-started leads here' },
          { label: 'downstream branch (out of this beat)', value: 'proceeds to sign-up' },
          { label: 'gate', value: 'none — this beat always auto-advances' },
        ],
        enforcedBy: ['advance-gate-check'],
      },
      edges: {
        rows: [
          {
            edge: 'audio fails to play',
            behavior:
              'show the greeting as text and still auto-advance; never strand the user on a silent screen',
          },
          {
            edge: 'user speaks over the greeting',
            behavior:
              'there is no capture here; ignore input and let the greeting finish, then advance',
          },
        ],
        enforcedBy: ['eval:edge-walk'],
      },
      acceptance: {
        rows: [
          {
            criterion: 'says the right thing',
            check: 'the recorded greeting plays verbatim from coach_greeting',
          },
          {
            criterion: 'shows the right thing',
            check: 'a single coach bubble renders; no interactive tiles or inputs appear',
          },
          {
            criterion: 'advances correctly',
            check: 'the flow auto-advances to sign-up when the clip ends, with no user action',
          },
        ],
        enforcedBy: [
          'render-link-integrity-check',
          'audio-ownership-check',
          'advance-gate-check',
          'eval:edge-walk',
        ],
      },
      applicableDecisions: {
        rows: [
          {
            decision: '1-7 (profile gates, women-art, habit caps, reflection)',
            binds: false,
            how: 'this beat captures nothing and gates nothing; no decision binds here',
          },
        ],
        enforcedBy: ['decisions-coverage-check'],
      },
    },
    script: [
      {
        seq: 1,
        words:
          "Hey, I might have startled you. You're probably not used to an app just talking to you. I'm your AI coach here at your service at Guided Growth, and I'm excited to help you improve things in your life that are important to you. So let's get you in, and we'll get started.",
        bindsTo: {
          kind: 'bubble',
          element: 'bubble-1',
          screen: 'COACH-GREETING',
        },
        voice: 'mp3',
        clip: 'coach_greeting',
        clipPath: '/voice/coach_greeting.mp3',
      },
    ],
    io: {
      dataIn: [],
      dataOut: [],
    },
  },
  {
    id: 'sign-up',
    name: 'Sign up',
    order: 3,
    path: 'both',
    type: 'auth-signup',
    screenId: 'ONBOARD-AUTH--FORM',
    allowedTools: null,
    expectedResponse: 'Taps Apple, Google, or email sign-in',
    voiceEngine: 'Silent',
    voiceMode: null,
    hideOrb: true,
    props: null,
    // EXEMPLAR (pre-fill, archetype = SILENT structural beat): proves the uniform
    // manifest for a beat that shows a component and captures data but has no coach
    // audio and no coach turn. scriptMeta / voice / conversation / allowedTools are
    // legitimately { na }, the rest are owner-filled.
    bible: {
      sectionManifest: {
        identity: 'filled',
        scriptMeta: { na: 'silent beat — no spoken script lines to gate or time' },
        components: 'filled',
        voice: { na: 'silent beat — the coach does not speak here' },
        rulesContext: 'filled',
        rulesCode: 'filled',
        conversation: { na: 'no multi-turn — taps only, the coach takes no turn' },
        contextProse: 'filled',
        allowedTools: {
          na: 'no coach tools — auth is handled by the provider SDK, not a tool call',
        },
        persistence: 'filled',
        flow: 'filled',
        edges: 'filled',
        acceptance: 'filled',
        applicableDecisions: 'filled',
      },
      identity: {
        rows: [
          { label: 'beatId (canonical)', value: 'sign-up' },
          { label: 'name', value: 'Sign up' },
          { label: 'order', value: '3' },
          { label: 'path', value: 'both' },
          { label: 'type', value: 'auth-signup' },
        ],
        aliases: [
          { surface: 'screenId', value: 'ONBOARD-AUTH--FORM' },
          { surface: 'route', value: '/onboarding/auth' },
          { surface: 'persisted current_step', value: 'sign-up' },
          { surface: 'session_log value', value: 'sign-up' },
          { surface: 'data-beat-id', value: 'sign-up' },
        ],
        enforcedBy: ['id-alias-check'],
      },
      components: {
        rows: [
          { label: 'component (registry key)', value: 'auth-signup' },
          {
            label: 'on-screen controls',
            value:
              'three sign-in affordances: Continue with Apple, Continue with Google, email sign-in',
          },
          { label: 'selection mode', value: 'single action (one provider), no preselection' },
          {
            label: 'exact state',
            value: 'nothing selected on entry; the name is captured by the chosen provider',
          },
        ],
        watchOut:
          'The auth UI is provider-driven; the exact provider button set may be reconciled with the native auth screen.',
        enforcedBy: ['component-registry-check'],
        status: 'app-reconcile-pending',
      },
      rulesContext: [
        {
          id: 'signup-stay-silent',
          rule: 'Stay silent through auth: do not greet, narrate, or comment while the user signs in',
          severity: 'must',
          enforcedBy: ['eval:no-machinery-words'],
        },
        {
          id: 'signup-no-read-account',
          rule: 'Never read the email or account details back to the user',
          severity: 'must',
          enforcedBy: ['eval:no-machinery-words'],
        },
      ],
      rulesCode: [
        {
          id: 'signup-no-tools',
          rule: 'No coach tool is callable on this beat; the flow advances on an authenticated session',
          severity: 'must',
          enforcedBy: ['tool-contract-check'],
        },
        {
          id: 'signup-advance-on-auth',
          rule: 'advance fires only once auth returns a valid session with the captured name',
          severity: 'must',
          enforcedBy: ['advance-gate-check'],
        },
        {
          id: 'signup-id-alias',
          rule: 'beatId maps to the screenId / route / step / session_log / data-beat-id in identity',
          severity: 'must',
          enforcedBy: ['id-alias-check'],
        },
      ],
      contextProse: {
        prose:
          'Auth. The user signs up or logs in by tapping Apple, Google, or email; this is also where their name is captured. The coach stays silent: no greeting, no narration, no tool call. The flow advances on its own once the user is authenticated.',
        enforcedBy: ['eval:parity-walk'],
      },
      persistence: {
        rows: [
          { label: 'writes', value: 'the user name and the authenticated session' },
          {
            label: 'never re-ask',
            value:
              'the name, once captured at sign-up, is carried forward; later beats greet by it, never re-ask',
          },
          {
            label: 'resume key',
            value: 'an authenticated session past sign-up proves this beat is done on refresh',
          },
        ],
        watchOut: 'Name and session live in the auth account (provider), not an onboarding table.',
        enforcedBy: ['persistence-contract-check'],
      },
      flow: {
        rows: [
          { label: 'advance condition', value: 'a valid authenticated session is established' },
          { label: 'upstream branch (into this beat)', value: 'coach-greeting auto-advances here' },
          { label: 'downstream branch (out of this beat)', value: 'proceeds to mic-permission' },
          { label: 'gate', value: 'authentication must succeed before advancing' },
        ],
        enforcedBy: ['advance-gate-check'],
      },
      edges: {
        rows: [
          {
            edge: 'auth cancelled',
            behavior:
              'user backs out of the provider sheet: stay on the beat, do not advance, no coach line',
          },
          {
            edge: 'auth error',
            behavior:
              'provider returns an error: keep the sign-in options visible for a retry; never advance on failure',
          },
        ],
        enforcedBy: ['eval:edge-walk'],
      },
      acceptance: {
        rows: [
          {
            criterion: 'shows the right thing',
            check:
              'phone renders the auth-signup screen with Apple / Google / email options, nothing preselected',
          },
          {
            criterion: 'stays silent',
            check: 'no coach audio or bubble plays during auth (silent-beat check)',
          },
          {
            criterion: 'advances correctly',
            check:
              'advance fires only after a valid session is established and the name is captured',
          },
          {
            criterion: 'survives a refresh',
            check: 'an authenticated session resumes past sign-up; the beat is not re-shown',
          },
        ],
        enforcedBy: [
          'component-registry-check',
          'advance-gate-check',
          'persistence-contract-check',
          'eval:edge-walk',
        ],
      },
      applicableDecisions: {
        rows: [
          {
            decision: '1, 2 (profile gates: name is captured here, age/gender later)',
            binds: false,
            how: 'name capture happens on this beat; the profile gates are enforced on the profile beats, not here',
          },
          {
            decision: '3 (women-art), 4/5 (habit caps), 6, 7 (reflection)',
            binds: false,
            how: 'not this beat',
          },
        ],
        enforcedBy: ['decisions-coverage-check'],
      },
    },
    script: [],
    io: {
      dataIn: [],
      dataOut: [
        {
          key: 'profile.name',
          from: 'user',
          writtenBy: 'auth sign-up',
          persistsTo: 'auth account',
        },
        { key: 'session', from: 'server-hydration', note: 'auth session established here' },
      ],
    },
  },
  {
    id: 'mic-permission',
    name: 'Mic permission',
    order: 4,
    path: 'both',
    type: 'mic-permission',
    screenId: 'MIC-PERMISSION',
    allowedTools: null,
    expectedResponse: 'Taps Allow or Not now',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: true,
    props: {
      heading: 'Allow your microphone',
      sub: 'So you can talk with your coach out loud.',
    },
    // EXEMPLAR (pre-fill, archetype = non-conversational MP3 beat): one recorded
    // opener then a permission tap. voice is owner-filled (perLine covers the one
    // spoken seq, so lane a passes); conversation / allowedTools / persistence are
    // legitimately { na } (single-turn, no coach tool, OS-level grant not persisted).
    bible: {
      sectionManifest: {
        identity: 'filled',
        scriptMeta: 'filled',
        components: 'filled',
        voice: 'filled',
        rulesContext: 'filled',
        rulesCode: 'filled',
        conversation: { na: 'single-turn, no branches' },
        contextProse: 'filled',
        allowedTools: { na: 'no tools — the mic grant is an OS permission, not a coach tool' },
        persistence: {
          na: 'nothing persisted — the mic grant is an OS permission, not an app write',
        },
        flow: 'filled',
        edges: 'filled',
        acceptance: 'filled',
        applicableDecisions: 'filled',
      },
      identity: {
        rows: [
          { label: 'beatId (canonical)', value: 'mic-permission' },
          { label: 'name', value: 'Mic permission' },
          { label: 'order', value: '4' },
          { label: 'path', value: 'both' },
          { label: 'type', value: 'mic-permission' },
        ],
        aliases: [
          { surface: 'screenId', value: 'MIC-PERMISSION' },
          { surface: 'route', value: '/onboarding/mic-permission' },
          { surface: 'persisted current_step', value: 'mic-permission' },
          { surface: 'session_log value', value: 'mic-permission' },
          { surface: 'data-beat-id', value: 'mic-permission' },
        ],
        enforcedBy: ['id-alias-check'],
      },
      scriptMeta: {
        rows: [
          {
            seq: 1,
            reveal: 'opener line on entry; no gate (this is the only spoken line)',
            timing: 'karaoke per-word on the opener line',
          },
        ],
        enforcedBy: ['render-link-integrity-check', 'reveal-timing-check'],
      },
      components: {
        rows: [
          { label: 'component (registry key)', value: 'mic-permission' },
          { label: 'heading', value: 'Allow your microphone' },
          { label: 'sub', value: 'So you can talk with your coach out loud.' },
          {
            label: 'on-screen controls',
            value: 'two affordances: Allow and Not now',
          },
          {
            label: 'selection mode',
            value: 'single action (Allow or Not now), nothing preselected',
          },
        ],
        enforcedBy: ['component-registry-check'],
      },
      voice: {
        rows: [
          { label: 'engine', value: 'MP3' },
          { label: 'mode', value: 'Verbatim (enum is Verbatim / Generative)' },
        ],
        perLine: [{ seq: 1, resolvesTo: 'recorded clip mic_permission_1', liveAllowed: 'NO' }],
        assertion:
          'The opener carries no live slot like {name}, so the one spoken line MUST resolve to the recorded clip mic_permission_1. No live Cartesia on this beat.',
        enforcedBy: ['audio-ownership-check'],
      },
      rulesContext: [
        {
          id: 'micperm-verbatim-opener',
          rule: 'Speaks the recorded opener verbatim, no improvised lead-in or addition',
          severity: 'must',
          enforcedBy: ['eval:verbatim-opener'],
        },
        {
          id: 'micperm-light-optional',
          rule: 'Keeps the ask light and optional; never pressures the user to grant the mic',
          severity: 'must',
          enforcedBy: ['eval:one-line-then-wait'],
        },
        {
          id: 'micperm-skip-is-fine',
          rule: 'If the user skips, reassures that typing is fine and moves on, never re-asks',
          severity: 'must',
          enforcedBy: ['eval:one-line-then-wait'],
        },
      ],
      rulesCode: [
        {
          id: 'micperm-audio-ownership',
          rule: 'The opener resolves to a recorded clip; no live Cartesia (no {name} slot)',
          severity: 'must',
          enforcedBy: ['audio-ownership-check'],
        },
        {
          id: 'micperm-clip-resolves',
          rule: 'mic_permission_1 resolves to a real asset',
          severity: 'must',
          enforcedBy: ['render-link-integrity-check'],
        },
        {
          id: 'micperm-id-alias',
          rule: 'beatId maps to the screenId / route / step / session_log / data-beat-id in identity',
          severity: 'must',
          enforcedBy: ['id-alias-check'],
        },
      ],
      contextProse: {
        prose:
          'Mic permission. Ask for the mic so the user can talk to the coach. Keep it light, optional, no pressure. If the user skips it, they can still type, and that is completely fine.',
        enforcedBy: ['eval:parity-walk'],
      },
      flow: {
        rows: [
          {
            label: 'advance condition',
            value: 'the user taps Allow or Not now; either choice advances the flow',
          },
          { label: 'upstream branch (into this beat)', value: 'sign-up advances here' },
          { label: 'downstream branch (out of this beat)', value: 'proceeds to profile-greeting' },
          { label: 'gate', value: 'none — skipping the mic is allowed and never penalized' },
        ],
        enforcedBy: ['advance-gate-check'],
      },
      edges: {
        rows: [
          {
            edge: 'permission granted',
            behavior:
              'user taps Allow: the mic is enabled and the flow advances; no coach line needed',
          },
          {
            edge: 'permission denied / skip',
            behavior:
              'user taps Not now: reassure that typing is fine, then advance — "That\'s completely fine, you can just type." Never pressure or re-ask.',
            voice: 'clip-family:onboard_mic_permission_edge_2 (pending recording)',
          },
          {
            edge: 'permission blocked at OS level',
            behavior:
              'the OS has permanently denied the mic: do not loop the prompt; fall back to typing and advance',
          },
        ],
        enforcedBy: ['eval:edge-walk'],
      },
      acceptance: {
        rows: [
          {
            criterion: 'shows the right thing',
            check: 'phone renders the mic-permission screen with the Allow / Not now controls',
          },
          {
            criterion: 'says the right thing',
            check: 'the opener plays verbatim from mic_permission_1',
          },
          {
            criterion: 'advances correctly',
            check: 'either Allow or Not now advances the flow; skipping is never penalized',
          },
        ],
        enforcedBy: ['component-registry-check', 'render-link-integrity-check', 'eval:edge-walk'],
      },
      applicableDecisions: {
        rows: [
          {
            decision: '1-7 (profile gates, women-art, habit caps, reflection)',
            binds: false,
            how: 'the mic-permission ask captures no profile data and gates nothing; no decision binds here',
          },
        ],
        enforcedBy: ['decisions-coverage-check'],
      },
    },
    script: [
      {
        seq: 1,
        words:
          "I'd love to actually talk with you. If you let me use your mic, you can just speak.",
        bindsTo: {
          kind: 'component',
          element: 'opener-line',
          screen: 'MIC-PERMISSION',
        },
        voice: 'mp3',
        clip: 'mic_permission_1',
        clipPath: '/voice/ob/mic_permission_1.wav',
      },
    ],
    io: {
      dataIn: [],
      dataOut: [{ key: 'device.micGranted', from: 'user', persistsTo: 'none (OS permission)' }],
    },
  },
  {
    // L2: Profile split into two single-engine beats. This greeting beat is
    // Cartesia (live, has {name}); the asks beat that follows is MP3.
    id: 'profile-greeting',
    name: 'Profile greeting',
    order: 5,
    path: 'both',
    type: 'profile-beat',
    screenId: 'ONBOARD-01--FORM',
    allowedTools: null,
    expectedResponse: 'Auto-advances',
    voiceEngine: 'Cartesia',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: null,
    // Archetype = single-turn spoken beat, but LIVE Cartesia (the one line carries
    // the {name} slot, so it cannot be a fixed clip). voice is owner-filled with the
    // one live-slot line (liveAllowed YES); components / conversation / allowedTools /
    // persistence are legitimately { na } (a single bubble, no interactive control,
    // no tool, and the name is read forward, not written here).
    bible: {
      sectionManifest: {
        identity: 'filled',
        scriptMeta: 'filled',
        components: { na: 'no interactive component — a single coach bubble that auto-advances' },
        voice: 'filled',
        rulesContext: 'filled',
        rulesCode: 'filled',
        conversation: { na: 'single-turn — the beat auto-advances; the user has no turn here' },
        contextProse: 'filled',
        allowedTools: { na: 'no tools — nothing is captured or saved on the greeting' },
        persistence: {
          na: 'writes nothing — the name is read forward from sign-up, not written here',
        },
        flow: 'filled',
        edges: 'filled',
        acceptance: 'filled',
        applicableDecisions: 'filled',
      },
      identity: {
        rows: [
          { label: 'beatId (canonical)', value: 'profile-greeting' },
          { label: 'name', value: 'Profile greeting' },
          { label: 'order', value: '5' },
          { label: 'path', value: 'both' },
          { label: 'type', value: 'profile-beat' },
        ],
        aliases: [
          { surface: 'screenId', value: 'ONBOARD-01--FORM' },
          { surface: 'route', value: '/onboarding/profile-greeting' },
          { surface: 'persisted current_step', value: 'profile-greeting' },
          { surface: 'session_log value', value: 'profile-greeting' },
          { surface: 'data-beat-id', value: 'profile-greeting' },
        ],
        watchOut:
          'profile-greeting (this beat, Cartesia live) and profile-asks (MP3) are the two single-engine halves of the old profile beat; they carry distinct beatIds and screenIds.',
        enforcedBy: ['id-alias-check'],
      },
      scriptMeta: {
        rows: [
          {
            seq: 1,
            reveal: 'greeting bubble on entry; no gate (this is the one spoken line)',
            timing: 'karaoke per-word on the bubble; the flow auto-advances on clip end',
          },
        ],
        enforcedBy: ['render-link-integrity-check', 'reveal-timing-check'],
      },
      voice: {
        rows: [
          { label: 'engine', value: 'Cartesia (live; the one line carries the {name} slot)' },
          { label: 'mode', value: 'Verbatim (enum is Verbatim / Generative)' },
        ],
        perLine: [{ seq: 1, resolvesTo: 'live Cartesia with the {name} slot', liveAllowed: 'YES' }],
        assertion:
          'The greeting carries the live {name} slot, so it is the one onboarding line that MUST resolve to live Cartesia (not a recorded clip). This is the sanctioned name-greeting live exception.',
        enforcedBy: ['audio-ownership-check'],
      },
      rulesContext: [
        {
          id: 'profgreet-verbatim-opener',
          rule: 'Speaks the greeting verbatim (with the user name filled), no improvised lead-in or addition',
          severity: 'must',
          enforcedBy: ['eval:verbatim-opener'],
        },
        {
          id: 'profgreet-warm-by-name',
          rule: 'Greets the user warmly by the name captured at sign-up; never re-asks the name',
          severity: 'must',
          enforcedBy: ['eval:warm-opener'],
        },
        {
          id: 'profgreet-no-machinery',
          rule: 'Never names the machinery (beat / step / screen / tool) in the greeting',
          severity: 'must',
          enforcedBy: ['eval:no-machinery-words'],
        },
      ],
      rulesCode: [
        {
          id: 'profgreet-live-name',
          rule: 'The greeting resolves to live Cartesia BECAUSE it carries the {name} slot (the one sanctioned live line)',
          severity: 'must',
          enforcedBy: ['audio-ownership-check'],
        },
        {
          id: 'profgreet-name-from-state',
          rule: 'The {name} slot is filled from flow-state (auth sign-up), never re-fetched from the database',
          severity: 'must',
          enforcedBy: ['persistence-contract-check'],
        },
        {
          id: 'profgreet-id-alias',
          rule: 'beatId maps to the screenId / route / step / session_log / data-beat-id in identity',
          severity: 'must',
          enforcedBy: ['id-alias-check'],
        },
      ],
      contextProse: {
        prose:
          'Profile greeting. The coach already knows the user name from sign-in. Greet them by name, warmly, and set up the two quick things about to be collected (age and gender). This beat is only the greeting, spoken live in their name. The asks come next.',
        enforcedBy: ['eval:parity-walk'],
      },
      flow: {
        rows: [
          { label: 'advance condition', value: 'auto-advances when the greeting clip ends' },
          { label: 'upstream branch (into this beat)', value: 'mic-permission advances here' },
          {
            label: 'downstream branch (out of this beat)',
            value: 'proceeds to profile-asks (order 6)',
          },
          { label: 'gate', value: 'none — this beat always auto-advances' },
        ],
        enforcedBy: ['advance-gate-check'],
      },
      edges: {
        rows: [
          {
            edge: 'name missing from state',
            behavior:
              'if the {name} slot is empty (unexpected), fall back to a name-free warm greeting rather than speaking an empty slot; still auto-advance',
          },
          {
            edge: 'audio fails to play',
            behavior:
              'show the greeting as text and still auto-advance; never strand the user on a silent screen',
          },
        ],
        enforcedBy: ['eval:edge-walk'],
      },
      acceptance: {
        rows: [
          {
            criterion: 'says the right thing',
            check: 'the greeting plays verbatim with the captured name filled into the {name} slot',
          },
          {
            criterion: 'shows the right thing',
            check: 'a single coach bubble renders; no interactive tiles or inputs appear',
          },
          {
            criterion: 'advances correctly',
            check: 'the flow auto-advances to profile-asks when the clip ends, with no user action',
          },
        ],
        enforcedBy: ['render-link-integrity-check', 'audio-ownership-check', 'advance-gate-check'],
      },
      applicableDecisions: {
        rows: [
          {
            decision: '1, 2 (profile gates)',
            binds: false,
            how: 'this is the greeting before the asks; the age/gender gates bind on profile-asks, not here',
          },
          {
            decision: '3 (women-art), 4/5 (habit caps), 6, 7 (reflection)',
            binds: false,
            how: 'not this beat',
          },
        ],
        enforcedBy: ['decisions-coverage-check'],
      },
    },
    script: [
      {
        seq: 1,
        words: 'Good to meet you, {name}. Two quick things so I can tailor this to you.',
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-01--FORM',
        },
        voice: 'cartesia',
        clip: null,
        clipPath: null,
      },
    ],
    io: {
      dataIn: [
        {
          key: 'profile.name',
          from: 'flow-state',
          writtenBy: 'auth sign-up',
          note: 'the one live {name} slot',
        },
      ],
      dataOut: [],
    },
  },
  {
    // L2: the asks beat. MP3, single-engine. Collects age and gender.
    id: 'profile-asks',
    name: 'Profile asks (age + gender)',
    order: 6,
    path: 'both',
    type: 'profile-beat',
    screenId: 'ONBOARD-01--FORM--ASKS',
    allowedTools: 'submit_profile, advance_step',
    expectedResponse: 'Says or taps age and gender',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: null,
    elements: ['age', 'gender'],
    // EXEMPLAR (pre-fill, archetype = pending-app-reconcile data beat): a multi-turn
    // beat that captures data and calls a tool, but whose persistence write target
    // is not yet confirmed against the handler. It proves the manifest-level
    // 'pending-app-reconcile' status: persistence is declared pending and its
    // section is legitimately absent until app-reconcile.
    bible: {
      sectionManifest: {
        identity: 'filled',
        scriptMeta: 'filled',
        components: 'filled',
        voice: 'filled',
        rulesContext: 'filled',
        rulesCode: 'filled',
        conversation: 'filled',
        contextProse: 'filled',
        allowedTools: 'filled',
        persistence: 'filled',
        flow: 'filled',
        edges: 'filled',
        acceptance: 'filled',
        applicableDecisions: 'filled',
      },
      identity: {
        rows: [
          { label: 'beatId (canonical)', value: 'profile-asks' },
          { label: 'name', value: 'Profile asks (age + gender)' },
          { label: 'order', value: '6' },
          { label: 'path', value: 'both' },
          { label: 'type', value: 'profile-beat' },
        ],
        aliases: [
          { surface: 'screenId', value: 'ONBOARD-01--FORM--ASKS' },
          { surface: 'route', value: '/onboarding/profile-asks' },
          { surface: 'persisted current_step', value: 'profile-asks' },
          { surface: 'session_log value', value: 'profile-asks' },
          { surface: 'data-beat-id', value: 'profile-asks' },
        ],
        enforcedBy: ['id-alias-check'],
      },
      scriptMeta: {
        rows: [
          {
            seq: 1,
            reveal: 'no gate: age input revealed on entry alongside the age prompt (opener line)',
            timing: 'karaoke per-word on the age prompt',
          },
          {
            seq: 2,
            reveal:
              'gated on seq 1 clip end: gender selector revealed after the age prompt finishes',
            timing: 'karaoke per-word on the gender prompt',
          },
        ],
        enforcedBy: ['render-link-integrity-check', 'reveal-timing-check'],
      },
      components: {
        rows: [
          { label: 'component (registry key)', value: 'profile-beat' },
          {
            label: 'on-screen controls',
            value: 'an age input and a gender selector (Male / Female / Other)',
          },
          {
            label: 'selection mode',
            value: 'age free entry; gender single-select, nothing preselected',
          },
          { label: 'exact state', value: 'both required before advancing; neither is preselected' },
        ],
        watchOut:
          'The gender enum is the canonical Male / Female / Other (CANONICAL_ENUMS.gender); Other never propagates past capture.',
        enforcedBy: ['component-registry-check'],
        status: 'app-reconcile-pending',
      },
      voice: {
        rows: [
          { label: 'engine', value: 'MP3' },
          { label: 'mode', value: 'Verbatim (enum is Verbatim / Generative)' },
        ],
        perLine: [
          { seq: 1, resolvesTo: 'recorded clip onboard_01_form_1', liveAllowed: 'NO' },
          { seq: 2, resolvesTo: 'recorded clip onboard_01_form_2', liveAllowed: 'NO' },
        ],
        assertion:
          'Neither prompt carries a live slot like {name}, so both spoken lines MUST resolve to recorded clips. No live Cartesia on this beat.',
        enforcedBy: ['audio-ownership-check'],
      },
      rulesContext: [
        {
          id: 'profile-ask-both',
          rule: 'Collect both age and gender; if the user gives one, ask for the other',
          severity: 'must',
          enforcedBy: ['eval:one-line-then-wait'],
        },
        {
          id: 'profile-no-skip-gender',
          rule: 'Never let the user skip or decline gender; both are required before moving on',
          severity: 'must',
          enforcedBy: ['eval:invalid-value-redirect'],
        },
        {
          id: 'profile-nothing-else',
          rule: 'Ask for nothing beyond age and gender on this beat',
          severity: 'must',
          enforcedBy: ['eval:no-machinery-words'],
        },
      ],
      rulesCode: [
        {
          id: 'profile-tools-only',
          rule: 'Only submit_profile and advance_step are callable on this beat',
          severity: 'must',
          enforcedBy: ['tool-contract-check'],
        },
        {
          id: 'profile-canonical-gender',
          rule: 'submit_profile passes the canonical gender enum (Male / Female / Other), not the raw words',
          severity: 'must',
          enforcedBy: ['tool-contract-check'],
        },
        {
          id: 'profile-advance-on-tool',
          rule: 'advance_step fires only after submit_profile captured both age and gender',
          severity: 'must',
          enforcedBy: ['advance-gate-check'],
        },
        {
          id: 'profile-id-alias',
          rule: 'beatId maps to the screenId / route / step / session_log / data-beat-id in identity',
          severity: 'must',
          enforcedBy: ['id-alias-check'],
        },
      ],
      conversation: {
        opens: 'after the age prompt ("How old are you?")',
        branches: [
          {
            on: 'gives age only',
            reply: 'scripted: "And your gender?" (the second required ask)',
            then: 'wait',
            voice: 'clip-family:onboard_profile_asks_1 (pending recording)',
          },
          {
            on: 'gives both age and gender',
            reply: 'none (silent after capture); map gender to the canonical enum',
            then: 'tool:submit_profile',
          },
          {
            on: 'tries to skip or decline gender',
            reply: 'scripted: plainly re-ask gender; never store a skip, never advance',
            then: 'wait',
            voice: 'clip-family:onboard_profile_asks_3 (pending recording)',
          },
          {
            on: 'off-topic or world question',
            reply:
              'global rule glob-out-of-scope: one brief acknowledgement, steer back to the age/gender asks',
            then: 'wait',
            voice: 'clip-family:onboard_offtopic (pending recording)',
          },
        ],
        maxTurns: 4,
        onMaxTurns: 'plain one-line re-ask of the missing field and point to the tap path',
      },
      contextProse: {
        prose:
          'Profile. Collect two things: age and gender. Ask gender plainly and never let the user skip or decline it. Accept voice or taps. If they give one, ask for the other. Both are required before moving on, gender included. Ask for nothing else.',
        enforcedBy: ['eval:parity-walk'],
      },
      allowedTools: {
        tools: ['submit_profile', 'advance_step'],
        callRules:
          'Inherited from GLOBAL_CONTEXT, bound here: call once both age and gender are captured; only this beat tools; pass the canonical gender enum, not the user raw words.',
        specs: [
          {
            tool: 'submit_profile',
            args: '{ age: number, gender: "Male" | "Female" | "Other" }',
            when: 'once both age and gender are captured',
          },
          { tool: 'advance_step', args: '{}', when: 'immediately after submit_profile returns' },
        ],
        note: 'No category, goal, or habit tools on this beat; profile capture uses submit_profile only.',
        enforcedBy: ['tool-contract-check'],
      },
      persistence: {
        rows: [
          {
            label: 'writes',
            value:
              'onboarding_states.data JSONB merge: age: number and gender: "Male" | "Female" | "Other"',
          },
          {
            label: 'never re-ask',
            value:
              'age and gender rehydrate from onboarding_states.data on resume; the beat is skipped once both keys exist',
          },
          {
            label: 'resume key',
            value:
              'onboarding_states.data.age + onboarding_states.data.gender, plus current_step past profile-asks',
          },
        ],
        watchOut:
          'AUTHORITATIVE RENDER CONTRACT. TODO app migration: submit_profile must accept age as a number, require age and gender, and not require or write nickname on this beat. Source: api/_lib/llm/onboarding/handlers/submitProfile.ts.',
        enforcedBy: ['persistence-contract-check'],
      },
      flow: {
        rows: [
          {
            label: 'advance condition',
            value: 'submit_profile fired with both age and gender, then advance_step',
          },
          {
            label: 'upstream branch (into this beat)',
            value: 'profile-greeting auto-advances here',
          },
          {
            label: 'downstream branch (out of this beat)',
            value:
              'gender selects the category art variant downstream (Female -> women-art category)',
          },
          { label: 'gate', value: 'both age and gender required; gender cannot be skipped' },
        ],
        enforcedBy: ['advance-gate-check'],
      },
      edges: {
        rows: [
          {
            edge: 'tool failure',
            behavior:
              'submit_profile errors: retry once quietly. If it still fails, SURFACE it, never fail silently, and do not advance. Tap/text path: a toast "Couldn\'t save that, tap to retry" with entries retained. Voice path: one short coach line "That didn\'t go through, let me try again."',
            voice: 'clip-family:onboard_profile_asks_edge_1 (pending recording)',
          },
          {
            edge: 'invalid age',
            behavior: 'nonsense age: one light redirect, do not store, re-ask plainly once',
          },
          {
            edge: 'declines gender',
            behavior: 'do not accept a skip; re-ask gender plainly; never advance without it',
          },
        ],
        enforcedBy: ['eval:edge-walk', 'eval:invalid-value-redirect'],
      },
      acceptance: {
        rows: [
          {
            criterion: 'shows the right thing',
            check:
              'phone renders the age input and the Male / Female / Other gender selector, nothing preselected',
          },
          {
            criterion: 'says the right thing',
            check: 'both prompts spoken verbatim; gender is never skippable (rules.context evals)',
          },
          {
            criterion: 'advances correctly',
            check:
              'both fields captured via submit_profile with a canonical gender, then advance_step',
          },
          {
            criterion: 'survives a refresh',
            check:
              'age + gender persist, the beat is not re-asked, current_step resumes past profile-asks',
          },
        ],
        enforcedBy: [
          'component-registry-check',
          'advance-gate-check',
          'persistence-contract-check',
          'eval:edge-walk',
        ],
      },
      applicableDecisions: {
        rows: [
          {
            decision: '1, 2 (profile gates: age + gender required, gender not skippable)',
            binds: true,
            how: 'this beat IS the render side of the profile gates; encoded as rules.context profile-no-skip-gender + the flow gate',
          },
          {
            decision: '3 (women-art)',
            binds: false,
            how: 'this beat captures the gender that decision 3 reads downstream; it is the input, not the women-art gate',
          },
          { decision: '4/5 (habit caps), 6, 7 (reflection)', binds: false, how: 'not this beat' },
        ],
        enforcedBy: ['decisions-coverage-check'],
      },
    },
    script: [
      {
        seq: 1,
        words: 'How old are you?',
        bindsTo: {
          kind: 'component',
          element: 'age',
          screen: 'ONBOARD-01--FORM--ASKS',
        },
        voice: 'mp3',
        clip: 'onboard_01_form_1',
        clipPath: '/voice/ob/onboard_01_form_1.wav',
      },
      {
        seq: 2,
        words: "What's your gender?",
        bindsTo: {
          kind: 'component',
          element: 'gender',
          screen: 'ONBOARD-01--FORM--ASKS',
        },
        voice: 'mp3',
        clip: 'onboard_01_form_2',
        clipPath: '/voice/ob/onboard_01_form_2.wav',
      },
    ],
    io: {
      dataIn: [],
      dataOut: [
        {
          key: 'profile.age',
          from: 'flow-state',
          writtenBy: 'submit_profile',
          persistsTo: 'onboarding_states.data.age',
        },
        {
          key: 'profile.gender',
          from: 'flow-state',
          writtenBy: 'submit_profile',
          persistsTo: 'onboarding_states.data.gender',
        },
      ],
    },
  },
  {
    id: 'state-check',
    name: 'State check-in',
    order: 7,
    path: 'both',
    type: 'state-check',
    screenId: 'ONBOARD-STATE-CHECK',
    allowedTools: 'record_checkin, advance_step',
    expectedResponse: 'Fills sleep, mood, energy, stress on the same cards',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: null,
    // EXEMPLAR (pre-fill, archetype = pending-app-reconcile data beat): the state
    // check-in whose record_checkin tool binding is a known fork (no beat_contexts
    // entry; deep-QA B6). allowedTools + persistence are legitimately
    // 'pending-app-reconcile' (facts live app-side, section absent until reconcile);
    // the render-side sections are owner-filled.
    bible: {
      sectionManifest: {
        identity: 'filled',
        scriptMeta: 'filled',
        components: 'filled',
        voice: 'filled',
        rulesContext: 'filled',
        rulesCode: 'filled',
        conversation: {
          na: 'card-fill check-in — the four cards ARE the check-in; the coach asks once and takes no branching turn',
        },
        contextProse: 'filled',
        allowedTools: 'filled',
        persistence: 'filled',
        flow: 'filled',
        edges: 'filled',
        acceptance: 'filled',
        applicableDecisions: 'filled',
      },
      identity: {
        rows: [
          { label: 'beatId (canonical)', value: 'state-check' },
          { label: 'name', value: 'State check-in' },
          { label: 'order', value: '7' },
          { label: 'path', value: 'both' },
          { label: 'type', value: 'state-check' },
        ],
        aliases: [
          { surface: 'screenId', value: 'ONBOARD-STATE-CHECK' },
          { surface: 'route', value: '/onboarding/state-check' },
          { surface: 'persisted current_step', value: 'state-check' },
          { surface: 'session_log value', value: 'state-check' },
          { surface: 'data-beat-id', value: 'state-check' },
        ],
        enforcedBy: ['id-alias-check'],
      },
      scriptMeta: {
        rows: [
          {
            seq: 1,
            reveal: 'opener bubble on entry; no gate (first spoken line)',
            timing: 'karaoke per-word on the bubble',
          },
          {
            seq: 2,
            reveal: 'the sleep card blooms, GATED on seq 1 clip end',
            timing: 'karaoke per-word on the sleep question',
          },
          {
            seq: 3,
            reveal: 'the mood card blooms, GATED on seq 2 clip end',
            timing: 'karaoke per-word on the mood question',
          },
          {
            seq: 4,
            reveal: 'the energy card blooms, GATED on seq 3 clip end',
            timing: 'karaoke per-word on the energy question',
          },
          {
            seq: 5,
            reveal: 'the stress card blooms, GATED on seq 4 clip end',
            timing: 'karaoke per-word on the stress question',
          },
        ],
        enforcedBy: ['render-link-integrity-check', 'reveal-timing-check'],
      },
      components: {
        rows: [
          { label: 'component (registry key)', value: 'state-check' },
          {
            label: 'on-screen cards',
            value: 'four check-in cards: sleep, mood, energy, stress',
          },
          {
            label: 'selection mode',
            value: 'each card rated once; the four cards ARE the check-in (no second card set)',
          },
          {
            label: 'exact state',
            value:
              'each card blooms as its question is asked; the same cards are then filled by the user',
          },
        ],
        watchOut:
          'These four cards are the check-in itself — never render a second set of cards after asking the questions.',
        enforcedBy: ['component-registry-check'],
      },
      voice: {
        rows: [
          { label: 'engine', value: 'MP3' },
          { label: 'mode', value: 'Verbatim (enum is Verbatim / Generative)' },
        ],
        perLine: [
          { seq: 1, resolvesTo: 'recorded clip onboard_state_check_1', liveAllowed: 'NO' },
          { seq: 2, resolvesTo: 'recorded clip state_sleep', liveAllowed: 'NO' },
          { seq: 3, resolvesTo: 'recorded clip state_mood', liveAllowed: 'NO' },
          { seq: 4, resolvesTo: 'recorded clip state_energy', liveAllowed: 'NO' },
          { seq: 5, resolvesTo: 'recorded clip state_stress', liveAllowed: 'NO' },
        ],
        assertion:
          'No line here carries a live slot like {name}, so all five spoken lines MUST resolve to recorded clips. No live Cartesia on this beat.',
        enforcedBy: ['audio-ownership-check'],
      },
      rulesContext: [
        {
          id: 'statecheck-verbatim-opener',
          rule: 'Speaks the framing opener and the four questions verbatim, no improvised lead-in',
          severity: 'must',
          enforcedBy: ['eval:verbatim-opener'],
        },
        {
          id: 'statecheck-ask-once',
          rule: 'Asks the four questions once, as the four sync points; never repeats them',
          severity: 'must',
          enforcedBy: ['eval:one-line-then-wait'],
        },
        {
          id: 'statecheck-no-advice',
          rule: 'Gives no advice on what the user reports; one warm line, then moves on',
          severity: 'must',
          enforcedBy: ['eval:no-platitudes'],
        },
      ],
      rulesCode: [
        {
          id: 'statecheck-audio-ownership',
          rule: 'Every spoken line resolves to a recorded clip; no live Cartesia (no {name} slot)',
          severity: 'must',
          enforcedBy: ['audio-ownership-check'],
        },
        {
          id: 'statecheck-clips-resolve',
          rule: 'the six check-in clips resolve to real assets',
          severity: 'must',
          enforcedBy: ['render-link-integrity-check'],
        },
        {
          id: 'statecheck-reveal-gates',
          rule: 'each card reveal gates on the prior line clip end, never a fixed timer',
          severity: 'must',
          enforcedBy: ['reveal-timing-check'],
        },
        {
          id: 'statecheck-id-alias',
          rule: 'beatId maps to the screenId / route / step / session_log / data-beat-id in identity',
          severity: 'must',
          enforcedBy: ['id-alias-check'],
        },
      ],
      contextProse: {
        prose:
          'Check-in (opener for the whole process, plus the first state check). The opener frames the coaching process as a few small pieces done together, built light for everyone, each part explained as it is reached. Then the first piece: a quick state check-in done now. The four questions (sleep, mood, energy, stress) are asked once, each blooming its card; the same cards are the check-in the user fills. Give no advice on what they report; one warm line, then move on.',
        enforcedBy: ['eval:parity-walk'],
      },
      allowedTools: {
        tools: ['record_checkin', 'advance_step'],
        callRules:
          'Call record_checkin exactly once after all four cards hold an integer score. Do not advance when any dimension is absent.',
        specs: [
          {
            tool: 'record_checkin',
            args: '{ sleep: 1 | 2 | 3 | 4 | 5, mood: 1 | 2 | 3 | 4 | 5, energy: 1 | 2 | 3 | 4 | 5, stress: 1 | 2 | 3 | 4 | 5, source: "onboarding" }',
            when: 'once all four state cards are rated',
          },
          { tool: 'advance_step', args: '{}', when: 'immediately after record_checkin succeeds' },
        ],
        note: 'AUTHORITATIVE RENDER CONTRACT. TODO app migration: register this onboarding-scoped record_checkin schema and handler rather than reusing the partial check-in namespace schema.',
        enforcedBy: ['tool-contract-check'],
      },
      persistence: {
        rows: [
          {
            label: 'writes',
            value:
              'atomically write onboarding_states.data.stateCheck = { sleep, mood, energy, stress, source: "onboarding" } and insert the first daily_checkins row with the same four scores and source = onboarding',
          },
          {
            label: 'never re-ask',
            value:
              'on resume, onboarding_states.data.stateCheck is the onboarding resume record; daily_checkins is the historical check-in record',
          },
          {
            label: 'resume key',
            value: 'onboarding_states.data.stateCheck, plus current_step past state-check',
          },
        ],
        watchOut:
          'AUTHORITATIVE RENDER CONTRACT. TODO app migration: make record_checkin perform the atomic onboarding_states + daily_checkins write. Current handler only writes stateCheck and has a completion-copy TODO. Source: flowBible.ts Table 3.',
        enforcedBy: ['persistence-contract-check'],
      },
      flow: {
        rows: [
          {
            label: 'advance condition',
            value: 'the four state cards are filled, then record_checkin and advance_step',
          },
          { label: 'upstream branch (into this beat)', value: 'profile-asks advances here' },
          {
            label: 'downstream branch (out of this beat)',
            value: 'proceeds to the morning check-in setup (order 8)',
          },
          { label: 'gate', value: 'all four cards must be filled before advancing' },
        ],
        enforcedBy: ['advance-gate-check'],
      },
      edges: {
        rows: [
          {
            edge: 'tool failure',
            behavior:
              'record_checkin errors: retry once quietly. If it still fails, SURFACE it, never fail silently, and do not advance. Tap/text path: a toast "Couldn\'t save that, tap to retry" with the ratings retained. Voice path: one short coach line "That didn\'t go through, let me try again." (Yair-approved tool-failure contract, 2026-07-09.)',
            voice: 'clip-family:onboard_state_check_edge_1 (pending recording)',
          },
          {
            edge: 'user reports something heavy',
            behavior:
              'if the user shares something hard, drop the check-in, be human first, name it plainly, and do not rush them back (global glob-crisis)',
          },
          {
            edge: 'skips a card',
            behavior:
              'a card left unrated: prompt once for the missing one; do not advance until all four are filled',
          },
        ],
        enforcedBy: ['eval:edge-walk'],
      },
      acceptance: {
        rows: [
          {
            criterion: 'shows the right thing',
            check:
              'phone renders the four state cards (sleep, mood, energy, stress); no second card set appears',
          },
          {
            criterion: 'says the right thing',
            check: 'the framing opener and the four questions play verbatim, each asked once',
          },
          {
            criterion: 'advances correctly',
            check: 'all four cards filled, then record_checkin and advance_step',
          },
        ],
        enforcedBy: ['component-registry-check', 'render-link-integrity-check', 'eval:edge-walk'],
      },
      applicableDecisions: {
        rows: [
          {
            decision: '1-7 (profile gates, women-art, habit caps, reflection)',
            binds: false,
            how: 'the state check-in captures momentary state, not a profile gate or reflection config; no decision binds here',
          },
        ],
        enforcedBy: ['decisions-coverage-check'],
      },
    },
    script: [
      {
        seq: 1,
        words:
          "I'd like to invite you into a coaching process. It's built on a few small pieces we'll go through together. Here's the first, a quick state check-in, and I'd like you to do it right now.",
        bindsTo: {
          kind: 'bubble',
          element: 'bubble-1',
          screen: 'ONBOARD-STATE-CHECK',
        },
        voice: 'mp3',
        clip: 'onboard_state_check_1',
        clipPath: '/voice/ob/onboard_state_check_1.wav',
      },
      {
        seq: 2,
        words: "How's your sleep?",
        bindsTo: {
          kind: 'component',
          element: 'reveal-1',
          screen: 'ONBOARD-STATE-CHECK',
        },
        voice: 'mp3',
        clip: 'state_sleep',
        clipPath: '/voice/ob/state_sleep.wav',
      },
      {
        seq: 3,
        words: "How's your mood?",
        bindsTo: {
          kind: 'component',
          element: 'reveal-2',
          screen: 'ONBOARD-STATE-CHECK',
        },
        voice: 'mp3',
        clip: 'state_mood',
        clipPath: '/voice/ob/state_mood.wav',
      },
      {
        seq: 4,
        words: "How's your energy?",
        bindsTo: {
          kind: 'component',
          element: 'reveal-3',
          screen: 'ONBOARD-STATE-CHECK',
        },
        voice: 'mp3',
        clip: 'state_energy',
        clipPath: '/voice/ob/state_energy.wav',
      },
      {
        seq: 5,
        words: "How's your stress?",
        bindsTo: {
          kind: 'component',
          element: 'reveal-4',
          screen: 'ONBOARD-STATE-CHECK',
        },
        voice: 'mp3',
        clip: 'state_stress',
        clipPath: '/voice/ob/state_stress.wav',
      },
    ],
    io: {
      dataIn: [],
      dataOut: [
        {
          key: 'checkin.state',
          from: 'flow-state',
          writtenBy: 'record_checkin',
          persistsTo: 'onboarding_states.data.stateCheck + daily_checkins (atomic)',
          note: 'canonical onboarding baseline state-check record',
        },
      ],
    },
  },
  {
    id: 'checkin',
    name: 'Morning check-in setup',
    order: 8,
    path: 'both',
    type: 'morning-checkin-setup',
    screenId: 'ONBOARD-MORNING-SETUP',
    allowedTools: 'submit_morning_checkin, advance_step',
    expectedResponse: 'Sets a time and days',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: null,
    // Archetype = interactive data-gate + tool (card-fill setup). The coach frames the
    // daily check-in, the time/day/reminder picker reveals, then a short consistency
    // nudge. conversation is { na } (card-fill, no branching turn); allowedTools is
    // owner-filled (the two tools are known); persistence is pending-app-reconcile
    // (the submit_morning_checkin write target is per-handler, not yet confirmed).
    bible: {
      sectionManifest: {
        identity: 'filled',
        scriptMeta: 'filled',
        components: 'filled',
        voice: 'filled',
        rulesContext: 'filled',
        rulesCode: 'filled',
        conversation: {
          na: 'card-fill setup — the coach frames it once; the time/day/reminder picker is filled directly, no branching turn',
        },
        contextProse: 'filled',
        allowedTools: 'filled',
        persistence: 'filled',
        flow: 'filled',
        edges: 'filled',
        acceptance: 'filled',
        applicableDecisions: 'filled',
      },
      identity: {
        rows: [
          { label: 'beatId (canonical)', value: 'checkin' },
          { label: 'name', value: 'Morning check-in setup' },
          { label: 'order', value: '8' },
          { label: 'path', value: 'both' },
          { label: 'type', value: 'morning-checkin-setup' },
        ],
        aliases: [
          { surface: 'screenId', value: 'ONBOARD-MORNING-SETUP' },
          { surface: 'route', value: '/onboarding/morning-setup' },
          { surface: 'persisted current_step', value: 'checkin' },
          { surface: 'session_log value', value: 'checkin' },
          { surface: 'data-beat-id', value: 'checkin' },
        ],
        enforcedBy: ['id-alias-check'],
      },
      scriptMeta: {
        rows: [
          {
            seq: 1,
            reveal: 'setup bubble on entry; no gate (first spoken line)',
            timing: 'karaoke per-word on the bubble',
          },
          {
            seq: 2,
            reveal: 'the time picker blooms, GATED on seq 1 clip end',
            timing: 'n/a (silent reveal)',
          },
          {
            seq: 3,
            reveal: 'the day picker blooms, GATED on seq 2 reveal',
            timing: 'n/a (silent reveal)',
          },
          {
            seq: 4,
            reveal: 'the reminder toggle blooms, GATED on seq 3 reveal',
            timing: 'n/a (silent reveal)',
          },
          {
            seq: 5,
            reveal: 'the consistency-nudge bubble, GATED on seq 4 reveal',
            timing: 'karaoke per-word on the bubble',
          },
        ],
        enforcedBy: ['render-link-integrity-check', 'reveal-timing-check'],
      },
      components: {
        rows: [
          { label: 'component (registry key)', value: 'morning-checkin-setup' },
          {
            label: 'on-screen controls',
            value: 'a daily time picker, a day picker, and a reminder toggle (ON by default)',
          },
          {
            label: 'selection mode',
            value: 'time + days set directly; reminder defaults ON; nothing else preselected',
          },
          {
            label: 'exact state',
            value:
              'the coach recommends a time shortly after wake; the weekday preset is offered but not forced',
          },
        ],
        watchOut:
          'The reminder toggle defaults ON (a documented default for this ritual, not a tap-to-choose grid; this beat is not a grid/list selection type).',
        enforcedBy: ['component-registry-check'],
      },
      voice: {
        rows: [
          { label: 'engine', value: 'MP3' },
          { label: 'mode', value: 'Verbatim (enum is Verbatim / Generative)' },
        ],
        perLine: [
          { seq: 1, resolvesTo: 'recorded clip onboard_morning_setup_1', liveAllowed: 'NO' },
          { seq: 2, resolvesTo: 'silent reveal (no audio)', liveAllowed: 'n/a' },
          { seq: 3, resolvesTo: 'silent reveal (no audio)', liveAllowed: 'n/a' },
          { seq: 4, resolvesTo: 'silent reveal (no audio)', liveAllowed: 'n/a' },
          { seq: 5, resolvesTo: 'recorded clip onboard_morning_setup_2', liveAllowed: 'NO' },
        ],
        assertion:
          'No line here carries a live slot like {name}, so both spoken lines MUST resolve to recorded clips; the reveals are silent. No live Cartesia on this beat.',
        enforcedBy: ['audio-ownership-check'],
      },
      rulesContext: [
        {
          id: 'checkin-verbatim-opener',
          rule: 'Speaks the setup framing and the consistency nudge verbatim, no improvised lead-in',
          severity: 'must',
          enforcedBy: ['eval:verbatim-opener'],
        },
        {
          id: 'checkin-keep-it-quick',
          rule: 'Keeps it quick; the point is that this is a simple first habit, not that it is morning',
          severity: 'must',
          enforcedBy: ['eval:one-line-then-wait'],
        },
        {
          id: 'checkin-no-platitudes',
          rule: 'No filler or praise; recommend a time, let them set it, move on',
          severity: 'must',
          enforcedBy: ['eval:no-platitudes'],
        },
      ],
      rulesCode: [
        {
          id: 'checkin-tools-only',
          rule: 'Only submit_morning_checkin and advance_step are callable on this beat',
          severity: 'must',
          enforcedBy: ['tool-contract-check'],
        },
        {
          id: 'checkin-advance-on-tool',
          rule: 'advance_step fires only after submit_morning_checkin captured the time and days',
          severity: 'must',
          enforcedBy: ['advance-gate-check'],
        },
        {
          id: 'checkin-reveal-gates',
          rule: 'each picker reveal gates on the prior line clip end, never a fixed timer',
          severity: 'must',
          enforcedBy: ['reveal-timing-check'],
        },
        {
          id: 'checkin-audio-ownership',
          rule: 'Every spoken line resolves to a recorded clip; no live Cartesia (no {name} slot)',
          severity: 'must',
          enforcedBy: ['audio-ownership-check'],
        },
        {
          id: 'checkin-id-alias',
          rule: 'beatId maps to the screenId / route / step / session_log / data-beat-id in identity',
          severity: 'must',
          enforcedBy: ['id-alias-check'],
        },
      ],
      contextProse: {
        prose:
          'Check-in time. The user just did their first check-in. Now set the daily time for it, reminder ON by default. Quick. The point is not that it is morning, it is that this is their first habit and it is simple. Recommend a time shortly after wake, offer the weekday preset, and let them set it.',
        enforcedBy: ['eval:parity-walk'],
      },
      allowedTools: {
        tools: ['submit_morning_checkin', 'advance_step'],
        callRules:
          'Inherited from GLOBAL_CONTEXT, bound here: call once the time and days are set; only this beat tools.',
        specs: [
          {
            tool: 'submit_morning_checkin',
            args: '{ time: "HH:MM", days: (0 | 1 | 2 | 3 | 4 | 5 | 6)[], reminder: boolean, schedule: "Weekday" | "Weekend" | "Every day" | "Custom" }',
            when: 'once the daily time and days are set',
          },
          {
            tool: 'advance_step',
            args: '{}',
            when: 'immediately after submit_morning_checkin returns',
          },
        ],
        note: 'The daily check-in and the evening reflection are rituals, set here; no habit tools on this beat.',
        enforcedBy: ['tool-contract-check'],
      },
      persistence: {
        rows: [
          {
            label: 'writes',
            value:
              'onboarding_states.data.morningCheckin = { time, days, reminder, schedule }; days are 0-6 integers and schedule is the derived or Custom label',
          },
          {
            label: 'never re-ask',
            value:
              'daily flow and resume read onboarding_states.data.morningCheckin until onboarding completion copies it into the daily ritual configuration',
          },
          {
            label: 'resume key',
            value: 'onboarding_states.data.morningCheckin, plus current_step past checkin',
          },
        ],
        watchOut:
          'AUTHORITATIVE RENDER CONTRACT. TODO app migration: register submit_morning_checkin in both lanes with this numeric-days shape and persist the exact morningCheckin object. Source: flowBible.ts Table 3.',
        enforcedBy: ['persistence-contract-check'],
      },
      flow: {
        rows: [
          {
            label: 'advance condition',
            value: 'submit_morning_checkin fired with a time and days, then advance_step',
          },
          { label: 'upstream branch (into this beat)', value: 'state-check advances here' },
          {
            label: 'downstream branch (out of this beat)',
            value: 'proceeds to the evening reflection setup (order 9)',
          },
          { label: 'gate', value: 'a daily time (and days) must be set before advancing' },
        ],
        enforcedBy: ['advance-gate-check'],
      },
      edges: {
        rows: [
          {
            edge: 'tool failure',
            behavior:
              'submit_morning_checkin errors: retry once quietly. If it still fails, SURFACE it, never fail silently, and do not advance. Tap/text path: a toast "Couldn\'t save that, tap to retry" with the time retained. Voice path: one short coach line "That didn\'t go through, let me try again."',
            voice: 'clip-family:onboard_morning_setup_edge_1 (pending recording)',
          },
          {
            edge: 'no time set',
            behavior: 'prompt once for the time; do not advance until a daily time is set',
          },
          {
            edge: 'wants reminder off',
            behavior:
              'honor it: turn the reminder off if the user asks; default stays ON otherwise',
          },
        ],
        enforcedBy: ['eval:edge-walk'],
      },
      acceptance: {
        rows: [
          {
            criterion: 'shows the right thing',
            check:
              'phone renders the time picker, day picker, and reminder toggle (reminder ON by default)',
          },
          {
            criterion: 'says the right thing',
            check: 'the setup framing and consistency nudge play verbatim',
          },
          {
            criterion: 'advances correctly',
            check: 'a time and days set via submit_morning_checkin, then advance_step',
          },
        ],
        enforcedBy: ['component-registry-check', 'render-link-integrity-check', 'eval:edge-walk'],
      },
      applicableDecisions: {
        rows: [
          {
            decision: '1-7 (profile gates, women-art, habit caps, reflection)',
            binds: false,
            how: 'the morning check-in setup configures the daily ritual time; it is not a profile gate, habit cap, or reflection-template decision, so none binds here',
          },
        ],
        enforcedBy: ['decisions-coverage-check'],
      },
    },
    // L5: morning reorder. Bubble 1 sets up the pick, then the picker reveals,
    // then bubble 2 (the shorter consistency nudge, R4) lands after the picker.
    script: [
      {
        seq: 1,
        words:
          "Part of the coaching process is doing this each day. It gives us two things. First, it's a real quick check-in on how your state is, which is valuable, and people don't usually do it enough. And second, over time it lets us see the connection between your behavior and your state. So when would you like to do this each morning? I recommend 15 minutes after you wake up.",
        bindsTo: {
          kind: 'bubble',
          element: 'bubble-1',
          screen: 'ONBOARD-MORNING-SETUP',
        },
        voice: 'mp3',
        clip: 'onboard_morning_setup_1',
        clipPath: '/voice/ob/onboard_morning_setup_1.wav',
      },
      {
        seq: 2,
        words: '',
        bindsTo: {
          kind: 'component',
          element: 'reveal-1',
          screen: 'ONBOARD-MORNING-SETUP',
        },
        voice: 'mp3',
        clip: null,
        clipPath: null,
      },
      {
        seq: 3,
        words: '',
        bindsTo: {
          kind: 'component',
          element: 'reveal-2',
          screen: 'ONBOARD-MORNING-SETUP',
        },
        voice: 'mp3',
        clip: null,
        clipPath: null,
      },
      {
        seq: 4,
        words: '',
        bindsTo: {
          kind: 'component',
          element: 'reveal-3',
          screen: 'ONBOARD-MORNING-SETUP',
        },
        voice: 'mp3',
        clip: null,
        clipPath: null,
      },
      {
        seq: 5,
        words:
          "Every day is great, but doing it on weekdays consistently beats doing it every day only occasionally. That's what I recommend to start.",
        bindsTo: {
          // Absolute step position, not bubble ordinal: this is the 2nd coach
          // bubble but the 3rd BeatPlayer step (ask, card, THEN this), because the
          // check-in card sits between the two bubbles. Naming it bubble-2 made the
          // driver call setStepReveal(2), which reveals only [ask, card] and hides
          // this bubble at index 2 exactly while it speaks. bubble-3 reveals it and
          // lets it karaoke. (advanced-frequency's trailing bubble uses the same
          // absolute-step convention: bubble-4 for its 4th step.)
          kind: 'bubble',
          element: 'bubble-3',
          screen: 'ONBOARD-MORNING-SETUP',
        },
        voice: 'mp3',
        clip: 'onboard_morning_setup_2',
        clipPath: '/voice/ob/onboard_morning_setup_2.wav',
      },
    ],
    io: {
      dataIn: [],
      dataOut: [
        {
          key: 'checkin.config',
          from: 'flow-state',
          writtenBy: 'submit_morning_checkin',
          persistsTo: 'onboarding_states.data.morningCheckin',
        },
      ],
    },
  },
  {
    id: 'reflection',
    name: 'Evening reflection setup',
    order: 9,
    path: 'both',
    type: 'reflection-card',
    screenId: 'ONBOARD-BEGINNER-07',
    allowedTools: 'submit_reflection_config, submit_custom_prompts, advance_step',
    expectedResponse: 'Picks a style and time',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: null,
    // Archetype = interactive data-gate + branching conversation (style pick + time,
    // SILENT_OPTIONS). The coach frames the reflection, reads the three sample
    // questions, then the styles + time picker fill. All 14 sections owner-filled
    // (persistence is concrete: reflection_settings).
    bible: {
      sectionManifest: {
        identity: 'filled',
        scriptMeta: 'filled',
        components: 'filled',
        voice: 'filled',
        rulesContext: 'filled',
        rulesCode: 'filled',
        conversation: 'filled',
        contextProse: 'filled',
        allowedTools: 'filled',
        persistence: 'filled',
        flow: 'filled',
        edges: 'filled',
        acceptance: 'filled',
        applicableDecisions: 'filled',
      },
      identity: {
        rows: [
          { label: 'beatId (canonical)', value: 'reflection' },
          { label: 'name', value: 'Evening reflection setup' },
          { label: 'order', value: '9' },
          { label: 'path', value: 'both' },
          { label: 'type', value: 'reflection-card' },
        ],
        aliases: [
          { surface: 'screenId', value: 'ONBOARD-BEGINNER-07' },
          { surface: 'route', value: '/onboarding/beginner-07' },
          { surface: 'persisted current_step', value: 'reflection' },
          { surface: 'session_log value', value: 'reflection' },
          { surface: 'data-beat-id', value: 'reflection' },
        ],
        enforcedBy: ['id-alias-check'],
      },
      scriptMeta: {
        rows: [
          {
            seq: 1,
            reveal: 'framing bubble on entry; no gate (first spoken line)',
            timing: 'karaoke per-word on the bubble',
          },
          {
            seq: 2,
            reveal: 'the first sample question reveals, GATED on seq 1 clip end',
            timing: 'karaoke per-word on the question',
          },
          {
            seq: 3,
            reveal: 'the second sample question reveals, GATED on seq 2 clip end',
            timing: 'karaoke per-word on the question',
          },
          {
            seq: 4,
            reveal: 'the third sample question reveals, GATED on seq 3 clip end',
            timing: 'karaoke per-word on the question',
          },
          {
            seq: 5,
            reveal: 'the make-your-own / freeform option reveals, GATED on seq 4 clip end',
            timing: 'karaoke per-word on the line',
          },
          {
            seq: 6,
            reveal: 'the style selector blooms, GATED on seq 5 clip end',
            timing: 'n/a (silent reveal)',
          },
          {
            seq: 7,
            reveal: 'the time recommendation line, GATED on seq 6 reveal',
            timing: 'karaoke per-word on the line',
          },
          {
            seq: 8,
            reveal: 'the time picker blooms, GATED on seq 7 clip end',
            timing: 'n/a (silent reveal)',
          },
        ],
        enforcedBy: ['render-link-integrity-check', 'reveal-timing-check'],
      },
      components: {
        rows: [
          { label: 'component (registry key)', value: 'reflection-card' },
          {
            label: 'on-screen controls',
            value:
              'a style selector (suggested template / your template / freeform), a time picker, and a reminder toggle (ON by default)',
          },
          {
            label: 'selection mode',
            value: 'single style select, nothing selected on entry; time set directly',
          },
          {
            label: 'exact state',
            value:
              'the three styles show on the screen; the coach does not read them out; time recommended before wind-down',
          },
        ],
        watchOut:
          'The three styles are on the screen and must not be read aloud (SILENT_OPTIONS). "Your template" captures the user prompts verbatim so the daily reflection can ask them back.',
        enforcedBy: ['component-registry-check'],
      },
      voice: {
        rows: [
          { label: 'engine', value: 'MP3' },
          { label: 'mode', value: 'Verbatim (enum is Verbatim / Generative)' },
        ],
        perLine: [
          { seq: 1, resolvesTo: 'recorded clip onboard_beginner_07_1', liveAllowed: 'NO' },
          { seq: 2, resolvesTo: 'recorded clip reflect_proud', liveAllowed: 'NO' },
          { seq: 3, resolvesTo: 'recorded clip reflect_forgive', liveAllowed: 'NO' },
          { seq: 4, resolvesTo: 'recorded clip reflect_grateful', liveAllowed: 'NO' },
          { seq: 5, resolvesTo: 'recorded clip reflect_alt', liveAllowed: 'NO' },
          { seq: 6, resolvesTo: 'silent reveal (no audio)', liveAllowed: 'n/a' },
          { seq: 7, resolvesTo: 'recorded clip reflect_time', liveAllowed: 'NO' },
          { seq: 8, resolvesTo: 'silent reveal (no audio)', liveAllowed: 'n/a' },
        ],
        assertion:
          'No line here carries a live slot like {name}, so every spoken line MUST resolve to a recorded clip; the style and time selectors are silent reveals. No live Cartesia on this beat.',
        enforcedBy: ['audio-ownership-check'],
      },
      rulesContext: [
        {
          id: 'reflect-verbatim-opener',
          rule: 'Speaks the framing, the three sample questions, and the time line verbatim, no improvised lead-in',
          severity: 'must',
          enforcedBy: ['eval:verbatim-opener'],
        },
        {
          id: 'reflect-no-read-styles',
          rule: 'Never reads the three styles out loud; they are on the screen. Ask which feels right and let them pick',
          severity: 'must',
          enforcedBy: ['eval:no-read-options'],
        },
        {
          id: 'reflect-no-per-style-coaching',
          rule: 'Adds no coaching per style and never makes it feel like homework',
          severity: 'must',
          enforcedBy: ['eval:no-platitudes'],
        },
        {
          id: 'reflect-keep-light',
          rule: 'If the user resists, keeps it light: it is two minutes a day. Sets it up, does not perform it now',
          severity: 'must',
          enforcedBy: ['eval:one-line-then-wait'],
        },
      ],
      rulesCode: [
        {
          id: 'reflect-tools-only',
          rule: 'Only submit_reflection_config, submit_custom_prompts, and advance_step are callable on this beat',
          severity: 'must',
          enforcedBy: ['tool-contract-check'],
        },
        {
          id: 'reflect-advance-on-tool',
          rule: 'advance_step fires only after submit_reflection_config captured a style and time',
          severity: 'must',
          enforcedBy: ['advance-gate-check'],
        },
        {
          id: 'reflect-reveal-gates',
          rule: 'each question and selector reveal gates on the prior line clip end, never a fixed timer',
          severity: 'must',
          enforcedBy: ['reveal-timing-check'],
        },
        {
          id: 'reflect-audio-ownership',
          rule: 'Every spoken line resolves to a recorded clip; no live Cartesia (no {name} slot)',
          severity: 'must',
          enforcedBy: ['audio-ownership-check'],
        },
        {
          id: 'reflect-id-alias',
          rule: 'beatId maps to the screenId / route / step / session_log / data-beat-id in identity',
          severity: 'must',
          enforcedBy: ['id-alias-check'],
        },
      ],
      conversation: {
        opens: 'after the framing and the three sample questions (ask which style feels right)',
        branches: [
          {
            on: 'picks the suggested template',
            reply: 'none (silent after the pick); config = suggested template',
            then: 'tool:submit_reflection_config',
          },
          {
            on: 'picks freeform',
            reply: 'none (silent after the pick); config = freeform',
            then: 'tool:submit_reflection_config',
          },
          {
            on: 'picks their own template',
            reply:
              'scripted: ask for their prompts and capture them verbatim (so the daily reflection can ask them back)',
            then: 'tool:submit_custom_prompts',
            voice: 'clip-family:onboard_beginner_07_your_template (pending recording)',
          },
          {
            on: 'resists / hesitant',
            reply: 'scripted: keep it light, it is a couple of minutes a day, then let them pick',
            then: 'wait',
            voice: 'clip-family:onboard_beginner_07_reassure (pending recording)',
          },
          {
            on: 'off-topic or world question',
            reply:
              'global rule glob-out-of-scope: one brief acknowledgement, steer back to the reflection setup',
            then: 'wait',
            voice: 'clip-family:onboard_offtopic (pending recording)',
          },
        ],
        maxTurns: 4,
        onMaxTurns: 'plain one-line re-ask of which style feels right and point to the tap path',
      },
      contextProse: {
        prose:
          'Evening reflection setup. Set it up, do not perform it now. The user picks one style and a time, reminder on by default. The three styles are on the screen (suggested template, your template, freeform); do not read them out. Ask which feels right and let them pick. If they choose your template, capture their prompts verbatim so the daily reflection can ask them back. Add no coaching per style and do not make it feel like homework.',
        enforcedBy: ['eval:parity-walk'],
      },
      allowedTools: {
        tools: ['submit_reflection_config', 'submit_custom_prompts', 'advance_step'],
        callRules:
          'Inherited from GLOBAL_CONTEXT, bound here: submit_reflection_config once the style and time are set; submit_custom_prompts only for the your-template style, verbatim; only this beat tools.',
        specs: [
          {
            tool: 'submit_reflection_config',
            args: '{ style: "suggested" | "custom" | "freeform", time: "HH:MM", days: (0 | 1 | 2 | 3 | 4 | 5 | 6)[], schedule: "Weekday" | "Weekend" | "Every day" | "Custom", reminder: boolean }',
            when: 'once the user picks a style and sets a time',
          },
          {
            tool: 'submit_custom_prompts',
            args: '{ prompts: string[] } (1-10 prompts, verbatim, each 1-280 characters)',
            when: 'only when the user picks the your-template style, to capture their prompts',
          },
          {
            tool: 'advance_step',
            args: '{}',
            when: 'immediately after submit_reflection_config returns',
          },
        ],
        note: 'No habit tools on this beat; the reflection is a ritual set here.',
        enforcedBy: ['tool-contract-check'],
      },
      persistence: {
        rows: [
          {
            label: 'writes',
            value:
              'reflection_settings.config = { style, time, days, schedule, reminder, customPrompts }; customPrompts is [] unless style = custom, then holds 1-10 verbatim prompts of 1-280 characters each',
          },
          {
            label: 'never re-ask',
            value:
              'the daily evening reflection reads reflection_settings.config and never re-asks the style; custom prompts replay word for word with no regeneration',
          },
          {
            label: 'resume key',
            value:
              'reflection_settings.config holds the complete object; current_step advanced past reflection proves this beat is done on refresh',
          },
        ],
        watchOut:
          'AUTHORITATIVE RENDER CONTRACT. Transaction order: validate style/time/days/schedule/reminder, validate custom prompts when style = custom, then atomically upsert this one config object before advance_step. TODO app migration: merge reflectionConfig and customPrompts into reflection_settings.config in both lanes, including completion copy. Current handlers split them across onboarding_states.data. Source: api/_lib/llm/onboarding/handlers/submitReflectionConfig.ts and submitCustomPrompts.ts.',
        enforcedBy: ['persistence-contract-check'],
      },
      flow: {
        rows: [
          {
            label: 'advance condition',
            value: 'submit_reflection_config fired with a style and time, then advance_step',
          },
          {
            label: 'upstream branch (into this beat)',
            value: 'the morning check-in setup advances here',
          },
          {
            label: 'downstream branch (out of this beat)',
            value: 'proceeds to the path fork (order 10)',
          },
          { label: 'gate', value: 'a style and time must be set before advancing' },
        ],
        enforcedBy: ['advance-gate-check'],
      },
      edges: {
        rows: [
          {
            edge: 'tool failure',
            behavior:
              'submit_reflection_config errors: retry once quietly. If it still fails, SURFACE it, never fail silently, and do not advance. Tap/text path: a toast "Couldn\'t save that, tap to retry" with the style retained. Voice path: one short coach line "That didn\'t go through, let me try again."',
            voice: 'clip-family:onboard_beginner_07_edge_1 (pending recording)',
          },
          {
            edge: 'no style picked',
            behavior:
              'prompt once for which style feels right; do not advance until a style is set',
          },
          {
            edge: 'your-template chosen but no prompts given',
            behavior:
              'ask once for at least one prompt; capture verbatim; do not invent prompts for them',
          },
        ],
        enforcedBy: ['eval:edge-walk'],
      },
      acceptance: {
        rows: [
          {
            criterion: 'shows the right thing',
            check:
              'phone renders the style selector (suggested / your template / freeform), a time picker, and a reminder toggle',
          },
          {
            criterion: 'says the right thing',
            check:
              'the framing, three questions, and time line play verbatim; the styles are not read aloud',
          },
          {
            criterion: 'advances correctly',
            check: 'a style and time captured via submit_reflection_config, then advance_step',
          },
          {
            criterion: 'survives a refresh',
            check: 'the config persists in reflection_settings, the beat is not re-asked',
          },
        ],
        enforcedBy: [
          'component-registry-check',
          'advance-gate-check',
          'persistence-contract-check',
          'render-link-integrity-check',
          'eval:edge-walk',
        ],
      },
      applicableDecisions: {
        rows: [
          {
            decision: '6, 7 (reflection: template styles + custom-prompt capture)',
            binds: true,
            how: 'this beat IS the render side of the reflection decisions; encoded as rules.context reflect-no-read-styles (the three styles on screen) and rules.code reflect-tools-only (submit_custom_prompts captures the your-template prompts verbatim)',
          },
          {
            decision: '1, 2 (profile gates), 3 (women-art), 4/5 (habit caps)',
            binds: false,
            how: 'not this beat',
          },
        ],
        enforcedBy: ['decisions-coverage-check'],
      },
    },
    script: [
      {
        seq: 1,
        words:
          'One more. An evening reflection, a minute and a half to close out your day. Use these three questions.',
        bindsTo: {
          kind: 'bubble',
          element: 'bubble-1',
          screen: 'ONBOARD-BEGINNER-07',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_07_1',
        clipPath: '/voice/ob/onboard_beginner_07_1.wav',
      },
      {
        seq: 2,
        words: 'What am I proud of?',
        bindsTo: {
          kind: 'component',
          element: 'reveal-1',
          screen: 'ONBOARD-BEGINNER-07',
        },
        voice: 'mp3',
        clip: 'reflect_proud',
        clipPath: '/voice/ob/reflect_proud.wav',
      },
      {
        seq: 3,
        words: 'What do I forgive myself for?',
        bindsTo: {
          kind: 'component',
          element: 'reveal-2',
          screen: 'ONBOARD-BEGINNER-07',
        },
        voice: 'mp3',
        clip: 'reflect_forgive',
        clipPath: '/voice/ob/reflect_forgive.wav',
      },
      {
        seq: 4,
        words: 'What am I grateful for?',
        bindsTo: {
          kind: 'component',
          element: 'reveal-3',
          screen: 'ONBOARD-BEGINNER-07',
        },
        voice: 'mp3',
        clip: 'reflect_grateful',
        clipPath: '/voice/ob/reflect_grateful.wav',
      },
      {
        seq: 5,
        words: 'Or make your own, or just talk freely.',
        bindsTo: {
          kind: 'component',
          element: 'reveal-4',
          screen: 'ONBOARD-BEGINNER-07',
        },
        voice: 'mp3',
        clip: 'reflect_alt',
        clipPath: '/voice/ob/reflect_alt.wav',
      },
      {
        seq: 6,
        words: '',
        bindsTo: {
          kind: 'component',
          element: 'reveal-5',
          screen: 'ONBOARD-BEGINNER-07',
        },
        voice: 'mp3',
        clip: null,
        clipPath: null,
      },
      {
        seq: 7,
        words: "I'd recommend doing this before bed, maybe 15 minutes before you wind down.",
        bindsTo: {
          kind: 'component',
          element: 'reveal-6',
          screen: 'ONBOARD-BEGINNER-07',
        },
        voice: 'mp3',
        clip: 'reflect_time',
        clipPath: '/voice/ob/reflect_time.wav',
      },
      {
        seq: 8,
        words: '',
        bindsTo: {
          kind: 'component',
          element: 'reveal-7',
          screen: 'ONBOARD-BEGINNER-07',
        },
        voice: 'mp3',
        clip: null,
        clipPath: null,
      },
    ],
    io: {
      dataIn: [],
      dataOut: [
        {
          key: 'reflection.config',
          from: 'flow-state',
          writtenBy: 'submit_reflection_config',
          persistsTo: 'reflection_settings.config',
        },
        {
          key: 'reflection.customPrompts',
          from: 'flow-state',
          writtenBy: 'submit_custom_prompts',
          persistsTo:
            'reflection_settings.config.customPrompts (verbatim, 1-10 prompts, each 1-280 characters)',
        },
      ],
    },
  },
  {
    id: 'fork',
    name: 'Path fork',
    order: 10,
    path: 'both',
    type: 'path-selection',
    screenId: 'ONBOARD-FORK--FORM',
    allowedTools: 'submit_path_choice, ask_clarification, advance_step',
    expectedResponse: 'New, or I already track habits',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: null,
    // Archetype = interactive data-gate + branching conversation. One framing bubble,
    // then the two path cards appear as the fork question is spoken verbal-only; the
    // answer routes beginner vs advanced. All 14 sections owner-filled (persistence is
    // concrete: flow.path -> onboarding_states.data).
    bible: {
      sectionManifest: {
        identity: 'filled',
        scriptMeta: 'filled',
        components: 'filled',
        voice: 'filled',
        rulesContext: 'filled',
        rulesCode: 'filled',
        conversation: 'filled',
        contextProse: 'filled',
        allowedTools: 'filled',
        persistence: 'filled',
        flow: 'filled',
        edges: 'filled',
        acceptance: 'filled',
        applicableDecisions: 'filled',
      },
      identity: {
        rows: [
          { label: 'beatId (canonical)', value: 'fork' },
          { label: 'name', value: 'Path fork' },
          { label: 'order', value: '10' },
          { label: 'path', value: 'both' },
          { label: 'type', value: 'path-selection' },
        ],
        aliases: [
          { surface: 'screenId', value: 'ONBOARD-FORK--FORM' },
          { surface: 'route', value: '/onboarding/fork' },
          { surface: 'persisted current_step', value: 'fork' },
          { surface: 'session_log value', value: 'fork' },
          { surface: 'data-beat-id', value: 'fork' },
        ],
        enforcedBy: ['id-alias-check'],
      },
      scriptMeta: {
        rows: [
          {
            seq: 1,
            reveal: 'framing bubble on entry; no gate (first spoken line)',
            timing: 'karaoke per-word on the bubble',
          },
          {
            seq: 2,
            reveal:
              'the two path cards bloom and the fork question is spoken, GATED on seq 1 clip end; the question is VERBAL ONLY (not a bubble)',
            timing: 'karaoke per-word, no bubble',
          },
          {
            seq: 3,
            reveal: 'the second path card blooms, GATED on seq 2 reveal',
            timing: 'n/a (silent reveal)',
          },
        ],
        enforcedBy: ['render-link-integrity-check', 'reveal-timing-check'],
      },
      components: {
        rows: [
          { label: 'component (registry key)', value: 'path-selection' },
          {
            label: 'on-screen cards',
            value: 'two path cards: new to tracking (beginner) and already track habits (advanced)',
          },
          { label: 'selection mode', value: 'single-select, nothing selected on entry' },
          {
            label: 'exact state',
            value: 'nothing selected on entry; both cards appear as the fork question is spoken',
          },
        ],
        enforcedBy: ['component-registry-check'],
      },
      voice: {
        rows: [
          { label: 'engine', value: 'MP3' },
          { label: 'mode', value: 'Verbatim (enum is Verbatim / Generative)' },
        ],
        perLine: [
          { seq: 1, resolvesTo: 'recorded clip onboard_fork_form_1', liveAllowed: 'NO' },
          { seq: 2, resolvesTo: 'recorded clip fork_question', liveAllowed: 'NO' },
          { seq: 3, resolvesTo: 'silent reveal (no audio)', liveAllowed: 'n/a' },
        ],
        assertion:
          'No line here carries a live slot like {name}, so both spoken lines MUST resolve to recorded clips; the second card reveal is silent. No live Cartesia on this beat.',
        enforcedBy: ['audio-ownership-check'],
      },
      rulesContext: [
        {
          id: 'fork-verbatim-opener',
          rule: 'Speaks the framing and the fork question verbatim, no improvised lead-in or filler tail',
          severity: 'must',
          enforcedBy: ['eval:verbatim-opener'],
        },
        {
          id: 'fork-no-read-options',
          rule: 'Never reads the two choices aloud as a list; the cards show them, ask the question then wait',
          severity: 'must',
          enforcedBy: ['eval:no-read-options'],
        },
        {
          id: 'fork-no-filler-tail',
          rule: 'No "both are totally fine" or any reassurance tail after the question',
          severity: 'must',
          enforcedBy: ['eval:no-platitudes'],
        },
        {
          id: 'fork-one-line-wait',
          rule: 'Asks the one fork question then waits; on unclear input, one short clarifying question',
          severity: 'must',
          enforcedBy: ['eval:one-line-then-wait'],
        },
      ],
      rulesCode: [
        {
          id: 'fork-tools-only',
          rule: 'Only submit_path_choice, ask_clarification, and advance_step are callable on this beat',
          severity: 'must',
          enforcedBy: ['tool-contract-check'],
        },
        {
          id: 'fork-advance-on-tool',
          rule: 'advance_step fires only after submit_path_choice captured beginner or advanced',
          severity: 'must',
          enforcedBy: ['advance-gate-check'],
        },
        {
          id: 'fork-reveal-gates',
          rule: 'the path cards and the second card reveal gate on the prior line clip end, never a fixed timer',
          severity: 'must',
          enforcedBy: ['reveal-timing-check'],
        },
        {
          id: 'fork-audio-ownership',
          rule: 'Every spoken line resolves to a recorded clip; no live Cartesia (no {name} slot)',
          severity: 'must',
          enforcedBy: ['audio-ownership-check'],
        },
        {
          id: 'fork-id-alias',
          rule: 'beatId maps to the screenId / route / step / session_log / data-beat-id in identity',
          severity: 'must',
          enforcedBy: ['id-alias-check'],
        },
      ],
      conversation: {
        opens:
          'after the framing bubble and the fork question (do you already track habits or is this new)',
        branches: [
          {
            on: 'new / tried and dropped off / wants guidance',
            reply: 'none (silent after the choice); map to path = beginner',
            then: 'tool:submit_path_choice',
          },
          {
            on: 'has a list or a system already',
            reply: 'none (silent after the choice); map to path = advanced',
            then: 'tool:submit_path_choice',
          },
          {
            on: 'unclear which path',
            reply:
              'scripted: one short clarifying question ("Do you have a list going now, or starting fresh?"), then take the answer',
            then: 'wait',
            voice: 'clip-family:onboard_fork_form_clarify (pending recording)',
          },
          {
            on: 'off-topic or world question',
            reply:
              'global rule glob-out-of-scope: one brief acknowledgement, steer back with the fork question',
            then: 'wait',
            voice: 'clip-family:onboard_offtopic (pending recording)',
          },
        ],
        maxTurns: 3,
        onMaxTurns: 'plain one-line re-ask of the fork question and point to the tap path',
      },
      contextProse: {
        prose:
          'Experience fork. The framing shows as one coach bubble. Then, as the two path cards appear, the fork question is spoken verbal only. New, tried and dropped off, or wants guidance routes to beginner. Has a list or a system already routes to advanced. If unclear, ask one short question. Do not read the two choices out loud, and add no reassurance tail.',
        enforcedBy: ['eval:parity-walk'],
      },
      allowedTools: {
        tools: ['submit_path_choice', 'ask_clarification', 'advance_step'],
        callRules:
          'Inherited from GLOBAL_CONTEXT, bound here: call submit_path_choice once the path is clear; ask_clarification only when the answer is genuinely ambiguous; only this beat tools.',
        specs: [
          {
            tool: 'submit_path_choice',
            args: '{ path: "beginner" | "advanced" }',
            when: 'once the user answer maps to beginner or advanced',
          },
          {
            tool: 'ask_clarification',
            args: '{ field: "path" }',
            when: 'only when the answer is genuinely ambiguous',
          },
          {
            tool: 'advance_step',
            args: '{}',
            when: 'immediately after submit_path_choice returns',
          },
        ],
        note: 'No category, goal, or habit tools on this beat; the fork only records the path.',
        enforcedBy: ['tool-contract-check'],
      },
      persistence: {
        rows: [
          {
            label: 'writes',
            value: 'onboarding_states.data.path = "beginner" | "advanced"',
          },
          {
            label: 'never re-ask',
            value:
              'the path, once captured, drives the branch; downstream beats read it, never re-ask',
          },
          {
            label: 'resume key',
            value:
              'onboarding_states.data.path rehydrates flow.path; current_step advanced past fork proves this beat is done on refresh',
          },
        ],
        watchOut:
          'AUTHORITATIVE RENDER CONTRACT. TODO app migration: replace the simple/braindump enum in both submit_path_choice implementations with beginner/advanced, stored at onboarding_states.data.path. Source: api/_lib/llm/onboarding/schemas.ts.',
        enforcedBy: ['persistence-contract-check'],
      },
      flow: {
        rows: [
          {
            label: 'advance condition',
            value: 'submit_path_choice fired with beginner or advanced, then advance_step',
          },
          {
            label: 'upstream branch (into this beat)',
            value: 'evening reflection setup advances here',
          },
          {
            label: 'downstream branch (out of this beat)',
            value: 'beginner -> category (order 11); advanced -> advanced-capture (order 54)',
          },
          { label: 'gate', value: 'a path must be chosen before advancing' },
        ],
        enforcedBy: ['advance-gate-check'],
      },
      edges: {
        rows: [
          {
            edge: 'tool failure',
            behavior:
              'submit_path_choice errors: retry once quietly. If it still fails, SURFACE it, never fail silently, and do not advance. Tap/text path: a toast "Couldn\'t save that, tap to retry" with the choice retained. Voice path: one short coach line "That didn\'t go through, let me try again."',
            voice: 'clip-family:onboard_fork_form_edge_1 (pending recording)',
          },
          {
            edge: 'ambiguous answer',
            behavior:
              'one short clarifying question (ask_clarification), then take the answer; never guess the path',
          },
          {
            edge: 'off-topic input',
            behavior: 'acknowledge briefly, steer back with the fork question, do not advance',
          },
        ],
        enforcedBy: ['eval:edge-walk'],
      },
      acceptance: {
        rows: [
          {
            criterion: 'shows the right thing',
            check: 'phone renders the two path cards, single-select, nothing preselected',
          },
          {
            criterion: 'says the right thing',
            check:
              'framing spoken verbatim, fork question verbal-only, no read-aloud list, no filler tail',
          },
          {
            criterion: 'advances correctly',
            check:
              'the path captured via submit_path_choice, then advance_step; routes beginner or advanced',
          },
          {
            criterion: 'survives a refresh',
            check: 'the path persists, the beat is not re-asked, current_step resumes past fork',
          },
        ],
        enforcedBy: [
          'component-registry-check',
          'advance-gate-check',
          'persistence-contract-check',
          'eval:edge-walk',
        ],
      },
      applicableDecisions: {
        rows: [
          {
            decision: '1-7 (profile gates, women-art, habit caps, reflection)',
            binds: false,
            how: 'the fork records the beginner/advanced path; it is not a profile gate, women-art, habit cap, or reflection decision, so none binds here',
          },
        ],
        enforcedBy: ['decisions-coverage-check'],
      },
    },
    script: [
      {
        seq: 1,
        words: 'One more question before we set up your habits.',
        bindsTo: {
          kind: 'bubble',
          element: 'bubble-1',
          screen: 'ONBOARD-FORK--FORM',
        },
        voice: 'mp3',
        clip: 'onboard_fork_form_1',
        clipPath: '/voice/ob/onboard_fork_form_1.wav',
      },
      {
        seq: 2,
        words: 'Do you already track habits or is this new to you?',
        bindsTo: {
          kind: 'component',
          element: 'reveal-1',
          screen: 'ONBOARD-FORK--FORM',
        },
        voice: 'mp3',
        clip: 'fork_question',
        clipPath: '/voice/ob/fork_question.wav',
      },
      {
        seq: 3,
        words: '',
        bindsTo: {
          kind: 'component',
          element: 'reveal-2',
          screen: 'ONBOARD-FORK--FORM',
        },
        voice: 'mp3',
        clip: null,
        clipPath: null,
      },
    ],
    io: {
      dataIn: [],
      dataOut: [
        {
          key: 'flow.path',
          from: 'flow-state',
          writtenBy: 'submit_path_choice',
          persistsTo: 'onboarding_states.data.path',
          note: 'drives the beginner/advanced branch',
        },
      ],
    },
  },
  {
    id: 'category',
    name: 'Category',
    order: 11,
    path: 'beginner',
    type: 'category-grid',
    screenId: 'ONBOARD-BEGINNER-01',
    allowedTools: 'submit_category, advance_step',
    expectedResponse: 'Names or picks one category',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: null,
    bible: {
      identity: {
        rows: [
          { label: 'beatId (canonical)', value: 'category' },
          { label: 'name', value: 'Category' },
          { label: 'order', value: '11' },
          { label: 'path', value: 'beginner' },
          { label: 'type', value: 'category-grid' },
        ],
        aliases: [
          { surface: 'screenId', value: 'ONBOARD-BEGINNER-01' },
          { surface: 'route', value: '/onboarding/beginner-01 (default variant)' },
          { surface: 'persisted current_step', value: 'category' },
          { surface: 'session_log value', value: 'category' },
          { surface: 'data-beat-id', value: 'category' },
        ],
        watchOut:
          'category and category-women SHARE screenId ONBOARD-BEGINNER-01. The beatId is the only unique key, so the render selects the variant by gender (code rule), not by screenId. The alias-check must allow two beatIds on one screenId while keeping each beatId other aliases unique.',
        enforcedBy: ['id-alias-check'],
      },
      scriptMeta: {
        rows: [
          {
            seq: 1,
            reveal: 'opener bubble; no gate',
            timing: 'karaoke per-word on the bubble',
          },
          {
            seq: 2,
            reveal: 'the category tiles bloom, GATED on seq 1 clip end',
            timing: 'n/a (silent reveal)',
          },
          {
            seq: 3,
            reveal:
              'the create-your-own tile blooms, GATED on seq 2 reveal; this clip is VERBAL ONLY (not a bubble)',
            timing: 'karaoke per-word, no bubble',
          },
        ],
        enforcedBy: ['render-link-integrity-check', 'reveal-timing-check'],
      },
      components: {
        rows: [
          { label: 'component (registry key)', value: 'category-grid' },
          { label: 'variant', value: 'default (renders for everyone except Female)' },
          {
            label: 'on-screen tiles',
            value:
              '8 category tiles: Sleep better, Move more, Eat better, Feel more energized, Reduce stress, Improve focus, Break bad habits, Get more organized (LOCKED, Yair 2026-07-09), plus a "Create your own" tile',
          },
          { label: 'selection mode', value: 'single-select, no preselection' },
          {
            label: 'exact state',
            value:
              'nothing selected on entry; tiles render with the default illustration set; create-your-own tile appears last (reveal-9)',
          },
          {
            label: 'derived (debug, generated never authored)',
            value: "resolved props: { variant: 'default', tileCount: 8, allowsCustom: true }",
          },
        ],
        watchOut:
          'The ONLY structural difference for category-women is variant: female. The tile labels, count, and single-select behavior are identical.',
        enforcedBy: ['component-registry-check'],
      },
      voice: {
        rows: [
          { label: 'engine', value: 'MP3' },
          {
            label: 'mode',
            value: 'Verbatim (reconciled from source Verbatim; enum is Verbatim / Generative)',
          },
        ],
        perLine: [
          { seq: 1, resolvesTo: 'recorded clip onboard_beginner_01_1', liveAllowed: 'NO' },
          { seq: 2, resolvesTo: 'silent reveal (no audio)', liveAllowed: 'n/a' },
          { seq: 3, resolvesTo: 'recorded clip create_your_own', liveAllowed: 'NO' },
        ],
        assertion:
          'No line here carries a live slot like {name}, so EVERY spoken line MUST resolve to a recorded clip id. None may resolve to live Cartesia.',
        enforcedBy: ['audio-ownership-check'],
      },
      rulesContext: [
        {
          id: 'cat-verbatim-opener',
          rule: 'Speaks the recorded opener and the create-your-own line verbatim, no improvised lead-in',
          severity: 'must',
          enforcedBy: ['eval:verbatim-opener'],
        },
        {
          id: 'cat-no-read-options',
          rule: 'Never reads the category tiles aloud, not in full, not one as an example',
          severity: 'must',
          enforcedBy: ['eval:no-read-options'],
        },
        {
          id: 'cat-silent-after-pick',
          rule: 'Silent after the pick: no praise, no commentary, nothing except submit_category and advance_step',
          severity: 'must',
          enforcedBy: ['eval:silent-after-pick'],
        },
        {
          id: 'cat-no-contrarian',
          rule: 'No reframe that undercuts the pick ("sleep isn\'t really the issue")',
          severity: 'must',
          enforcedBy: ['eval:no-contrarian'],
        },
        {
          id: 'cat-no-platitudes',
          rule: 'No per-category commentary or filler ("sleep is the foundation", "genuinely")',
          severity: 'must',
          enforcedBy: ['eval:no-platitudes'],
        },
        {
          id: 'cat-one-line-wait',
          rule: 'After the opener, asks one short pointer question then waits',
          severity: 'must',
          enforcedBy: ['eval:one-line-then-wait'],
        },
        {
          id: 'cat-single-select',
          rule: 'Allows exactly one category; on two, asks which feels most urgent',
          severity: 'must',
          enforcedBy: ['eval:single-select'],
        },
      ],
      rulesCode: [
        {
          id: 'cat-tools-only',
          rule: 'Only submit_category and advance_step are callable on this beat',
          severity: 'must',
          enforcedBy: ['tool-contract-check'],
        },
        {
          id: 'cat-advance-on-tool',
          rule: 'advance_step fires only after submit_category captured a valid category',
          severity: 'must',
          enforcedBy: ['advance-gate-check'],
        },
        {
          id: 'cat-default-variant',
          rule: "This DEFAULT render shows for everyone except Female; gender === 'Female' routes to the category-women variant",
          severity: 'must',
          enforcedBy: ['component-registry-check'],
        },
        {
          id: 'cat-reveal-gates',
          rule: 'reveal-8 and reveal-9 gate on the prior line clip end, never a fixed timer',
          severity: 'must',
          enforcedBy: ['reveal-timing-check'],
        },
        {
          id: 'cat-audio-ownership',
          rule: 'Every spoken line resolves to a recorded clip; no live Cartesia (no {name} slot)',
          severity: 'must',
          enforcedBy: ['audio-ownership-check'],
        },
        {
          id: 'cat-clips-resolve',
          rule: 'onboard_beginner_01_1 and create_your_own resolve to real assets',
          severity: 'must',
          enforcedBy: ['render-link-integrity-check'],
        },
        {
          id: 'cat-id-alias',
          rule: 'beatId maps to the screenId / route / step / session_log / data-beat-id in identity',
          severity: 'must',
          enforcedBy: ['id-alias-check'],
        },
      ],
      // section 13 - multi-turn conversation model (scripted prompts only, Yair 2026-07-09)
      conversation: {
        opens: 'after the opener bubble and the tiles reveal (ask what they most want to work on)',
        branches: [
          {
            on: 'names or taps one valid category',
            reply: 'none (silent after pick); map to the exact label',
            then: 'tool:submit_category',
          },
          {
            on: 'names two or more',
            reply: 'scripted: "Which feels most urgent right now?"',
            then: 'wait',
            voice: 'clip-family:onboard_category_2 (pending recording)',
          },
          {
            on: 'names something off-list',
            reply:
              'scripted: "You can create your own for that. Want to?" (routes to the create-your-own tile)',
            then: 'wait',
            voice: 'clip-family:onboard_category_3 (pending recording)',
          },
          {
            on: 'off-topic or world question',
            reply:
              'global rule glob-out-of-scope: one brief acknowledgement, steer back with the category question',
            then: 'wait',
            voice: 'clip-family:onboard_offtopic (pending recording)',
          },
        ],
        maxTurns: 4,
        onMaxTurns: 'plain one-line re-ask of the category question and point to the tap path',
      },
      contextProse: {
        prose:
          'Focus area. Collect one category. The opener shows as a coach bubble, then the category tiles appear (default illustration set). When the create-your-own option appears at the end, "Or you can create your own" is spoken verbal only. Ask what they most want to work on, then wait. If they name several, ask which feels most urgent. Keep the response specific to their pick.',
        pending: true,
        enforcedBy: ['eval:parity-walk'],
      },
      allowedTools: {
        tools: ['submit_category', 'advance_step'],
        callRules:
          'Inherited from GLOBAL_CONTEXT, bound here: call once the category is captured; only this beat tools; pass the canonical category value, not the user raw words.',
        specs: [
          {
            tool: 'submit_category',
            args: '{ category: string, source: "canonical" | "custom" } where canonical uses one of the 8 LOCKED labels and custom is the verbatim create-your-own label',
            when: 'once the user has settled on exactly one category',
          },
          {
            tool: 'advance_step',
            args: '{}',
            when: 'immediately after submit_category returns',
          },
        ],
        note: 'There is NO submit_habits or submit_goals on this beat. Category uses submit_category only (per coach-per-beat tool correction).',
        enforcedBy: ['tool-contract-check'],
      },
      persistence: {
        rows: [
          {
            label: 'writes',
            value:
              'onboarding_states.data.category = the chosen category label and onboarding_states.data.categorySource = "canonical" | "custom"',
          },
          {
            label: 'never re-ask',
            value:
              'the category, once captured, is carried forward; downstream goal/habit beats read it, never re-prompt',
          },
          {
            label: 'resume key',
            value:
              'onboarding_states.data.category + categorySource, then current_step advanced past category, prove this beat is done on refresh',
          },
        ],
        watchOut:
          'Canonical categories route to the matching typed goals-* list. A custom category routes to goal-custom and its free-text goals, never to a guessed canonical family. AUTHORITATIVE RENDER CONTRACT. TODO app migration: remove the fixed-only submit_category enum, accept source, and write category/categorySource keys. Source: api/_lib/llm/onboarding/handlers/submitCategory.ts.',
        enforcedBy: ['persistence-contract-check'],
      },
      flow: {
        rows: [
          {
            label: 'advance condition',
            value: 'submit_category fired with a valid single category, then advance_step',
          },
          {
            label: 'upstream branch (into this beat)',
            value:
              "gender is Male or Other (everyone except Female) selects this default category beat; gender === 'Female' routes to the category-women women-art variant",
          },
          {
            label: 'downstream branch (out of this beat)',
            value:
              'create-your-own tile -> goal-custom (order 21); any of the 8 canonical categories -> the matching goals-* beat by category (e.g. Sleep better -> goals-sleep, order 13)',
          },
          {
            label: 'gate',
            value:
              'exactly one category; if the user names two, the coach resolves to one before the tool fires (cat-single-select)',
          },
        ],
        enforcedBy: ['advance-gate-check'],
      },
      edges: {
        rows: [
          {
            edge: 'tool failure',
            behavior:
              'submit_category errors: retry once quietly. If it still fails, SURFACE it, never fail silently, and do not advance. Tap/text path: a toast "Couldn\'t save that, tap to retry" and the picked category stays selected for the retry. Voice path: one short coach line "That didn\'t go through, let me try again." (Yair-approved tool-failure contract, 2026-07-09.)',
            voice: 'clip-family:onboard_category_edge_1 (pending recording)',
          },
          {
            edge: 'off-topic input',
            behavior:
              'acknowledge briefly, steer back with one short pointer question, do not advance',
          },
          {
            edge: 'skip / decline',
            behavior:
              'user will not choose: falls to the plain one-line re-ask and the tap path (max-turns behavior, no brainstorm; copy-decisions 2026-07-10), never force',
          },
          {
            edge: 'empty state',
            behavior:
              'no tiles appeared for the user: ask one neutral question ("Is anything coming up for you to pick from?"), do NOT recite the category list to fill the silence',
            voice: 'clip-family:onboard_category_edge_4 (pending recording)',
          },
          {
            edge: 'names two',
            behavior: 'ask which feels most urgent, then take the one',
          },
          {
            edge: 'names something off-list',
            behavior: 'route to the create-your-own tile / custom category',
          },
        ],
        enforcedBy: ['eval:edge-walk'],
      },
      acceptance: {
        rows: [
          {
            criterion: 'shows the right thing',
            check:
              'phone renders category-grid default variant, 8 tiles + create-your-own, single-select, nothing preselected (diff phone vs components)',
          },
          {
            criterion: 'says the right thing',
            check:
              'opener spoken verbatim, create-your-own verbal-only, no read / praise / contrarian / platitude (rules.context evals)',
          },
          {
            criterion: 'advances correctly',
            check:
              'exactly one category captured via submit_category, then advance_step; two-category attempt resolves to one first (flow gate)',
          },
          {
            criterion: 'survives a refresh',
            check:
              'category persists, beat not re-asked, current_step resumes past category (persistence resume key)',
          },
          {
            criterion: 'variant is correct',
            check:
              "Male and Other render this default beat; gender === 'Female' renders category-women (cat-default-variant)",
          },
        ],
        enforcedBy: [
          'component-registry-check',
          'advance-gate-check',
          'persistence-contract-check',
          'render-link-integrity-check',
          'eval:parity-walk',
          'eval:edge-walk',
        ],
      },
      applicableDecisions: {
        rows: [
          {
            decision:
              "3. Women's art variant (gender === 'Female' is the ONLY selector; Male and Other get this default render)",
            binds: true,
            how: 'this beat IS the DEFAULT side of decision 3; encoded as rules.code cat-default-variant with component-registry-check',
          },
          {
            decision: '1, 2 (profile gates), 4/5 (habit caps), 6, 7 (reflection)',
            binds: false,
            how: 'not this beat',
          },
        ],
        enforcedBy: ['decisions-coverage-check'],
      },
      sectionManifest: {
        identity: 'filled',
        scriptMeta: 'filled',
        components: 'filled',
        voice: 'filled',
        rulesContext: 'filled',
        rulesCode: 'filled',
        conversation: 'filled',
        contextProse: 'filled',
        allowedTools: 'filled',
        persistence: 'filled',
        flow: 'filled',
        edges: 'filled',
        acceptance: 'filled',
        applicableDecisions: 'filled',
      },
    },
    script: [
      {
        seq: 1,
        words:
          "Let's choose one area of your life that you'd like to improve on. Here are our recommended categories.",
        bindsTo: {
          kind: 'bubble',
          element: 'bubble-1',
          screen: 'ONBOARD-BEGINNER-01',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_01_1',
        clipPath: '/voice/ob/onboard_beginner_01_1.wav',
      },
      {
        seq: 2,
        words: '',
        bindsTo: {
          kind: 'component',
          element: 'reveal-8',
          screen: 'ONBOARD-BEGINNER-01',
        },
        voice: 'mp3',
        clip: null,
        clipPath: null,
      },
      {
        seq: 3,
        words: 'Or you can create your own.',
        bindsTo: {
          kind: 'component',
          element: 'reveal-9',
          screen: 'ONBOARD-BEGINNER-01',
        },
        voice: 'mp3',
        clip: 'create_your_own',
        clipPath: '/voice/ob/create_your_own.wav',
      },
    ],
    io: {
      dataIn: [
        {
          key: 'profile.gender',
          from: 'flow-state',
          writtenBy: 'submit_profile',
          note: 'default variant: renders for everyone except Female (decision 3)',
        },
      ],
      dataOut: [
        {
          key: 'onboarding.category',
          from: 'flow-state',
          writtenBy: 'submit_category',
          persistsTo: 'onboarding_states.data (verify key at app-reconcile)',
        },
      ],
    },
  },
  {
    id: 'category-women',
    name: 'Category (women’s art)',
    order: 12,
    path: 'beginner',
    type: 'category-grid',
    variantOf: 'category',
    screenId: 'ONBOARD-BEGINNER-01',
    allowedTools: 'submit_category, advance_step',
    expectedResponse: 'Names or picks one category',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      variant: 'female',
    },
    bible: {
      identity: {
        rows: [
          { label: 'beatId (canonical)', value: 'category-women' },
          { label: 'name', value: "Category (women's art)" },
          { label: 'order', value: '12' },
          { label: 'path', value: 'beginner' },
          { label: 'type', value: 'category-grid' },
        ],
        aliases: [
          { surface: 'screenId', value: 'ONBOARD-BEGINNER-01' },
          { surface: 'route', value: '/onboarding/beginner-01 (women-art variant)' },
          { surface: 'persisted current_step', value: 'category-women' },
          { surface: 'session_log value', value: 'category-women' },
          { surface: 'data-beat-id', value: 'category-women' },
        ],
        watchOut:
          'category and category-women SHARE screenId ONBOARD-BEGINNER-01. The beatId is the only unique key, so the render selects the variant by gender (code rule), not by screenId. The alias-check must allow two beatIds on one screenId while keeping each beatId other aliases unique.',
        enforcedBy: ['id-alias-check'],
      },
      scriptMeta: {
        rows: [
          {
            seq: 1,
            reveal: 'opener bubble; no gate',
            timing: 'karaoke per-word on the bubble',
          },
          {
            seq: 2,
            reveal: 'the category tiles bloom, GATED on seq 1 clip end',
            timing: 'n/a (silent reveal)',
          },
          {
            seq: 3,
            reveal:
              'the create-your-own tile blooms, GATED on seq 2 reveal; this clip is VERBAL ONLY (not a bubble)',
            timing: 'karaoke per-word, no bubble',
          },
        ],
        enforcedBy: ['render-link-integrity-check', 'reveal-timing-check'],
      },
      components: {
        rows: [
          { label: 'component (registry key)', value: 'category-grid' },
          { label: 'variant', value: "female (from source props.variant: 'female')" },
          {
            label: 'on-screen tiles',
            value:
              '8 category tiles: Sleep better, Move more, Eat better, Feel more energized, Reduce stress, Improve focus, Break bad habits, Get more organized (LOCKED, Yair 2026-07-09), plus a "Create your own" tile',
          },
          { label: 'selection mode', value: 'single-select, no preselection' },
          {
            label: 'exact state',
            value:
              'nothing selected on entry; tiles render with the women-art illustration set; create-your-own tile appears last (reveal-9)',
          },
          {
            label: 'derived (debug, generated never authored)',
            value: "resolved props: { variant: 'female', tileCount: 8, allowsCustom: true }",
          },
        ],
        watchOut:
          'The ONLY structural difference from category is variant: female. The tile labels, count, and single-select behavior are identical.',
        enforcedBy: ['component-registry-check'],
      },
      voice: {
        rows: [
          { label: 'engine', value: 'MP3' },
          {
            label: 'mode',
            value: 'Verbatim (reconciled from source Verbatim; enum is Verbatim / Generative)',
          },
        ],
        perLine: [
          { seq: 1, resolvesTo: 'recorded clip onboard_beginner_01_1', liveAllowed: 'NO' },
          { seq: 2, resolvesTo: 'silent reveal (no audio)', liveAllowed: 'n/a' },
          { seq: 3, resolvesTo: 'recorded clip create_your_own', liveAllowed: 'NO' },
        ],
        assertion:
          'No line here carries a live slot like {name}, so EVERY spoken line MUST resolve to a recorded clip id. None may resolve to live Cartesia.',
        enforcedBy: ['audio-ownership-check'],
      },
      rulesContext: [
        {
          id: 'catw-verbatim-opener',
          rule: 'Speaks the recorded opener and the create-your-own line verbatim, no improvised lead-in',
          severity: 'must',
          enforcedBy: ['eval:verbatim-opener'],
        },
        {
          id: 'catw-no-read-options',
          rule: 'Never reads the category tiles aloud, not in full, not one as an example',
          severity: 'must',
          enforcedBy: ['eval:no-read-options'],
        },
        {
          id: 'catw-silent-after-pick',
          rule: 'Silent after the pick: no praise, no commentary, nothing except submit_category and advance_step',
          severity: 'must',
          enforcedBy: ['eval:silent-after-pick'],
        },
        {
          id: 'catw-no-contrarian',
          rule: 'No reframe that undercuts the pick ("sleep isn\'t really the issue")',
          severity: 'must',
          enforcedBy: ['eval:no-contrarian'],
        },
        {
          id: 'catw-no-platitudes',
          rule: 'No per-category commentary or filler ("sleep is the foundation", "genuinely")',
          severity: 'must',
          enforcedBy: ['eval:no-platitudes'],
        },
        {
          id: 'catw-one-line-wait',
          rule: 'After the opener, asks one short pointer question then waits',
          severity: 'must',
          enforcedBy: ['eval:one-line-then-wait'],
        },
        {
          id: 'catw-single-select',
          rule: 'Allows exactly one category; on two, asks which feels most urgent',
          severity: 'must',
          enforcedBy: ['eval:single-select'],
        },
      ],
      rulesCode: [
        {
          id: 'catw-tools-only',
          rule: 'Only submit_category and advance_step are callable on this beat',
          severity: 'must',
          enforcedBy: ['tool-contract-check'],
        },
        {
          id: 'catw-advance-on-tool',
          rule: 'advance_step fires only after submit_category captured a valid category',
          severity: 'must',
          enforcedBy: ['advance-gate-check'],
        },
        {
          id: 'catw-women-variant',
          rule: "This variant renders ONLY when gender === 'Female'; Male and Other get the default category render",
          severity: 'must',
          enforcedBy: ['component-registry-check'],
        },
        {
          id: 'catw-reveal-gates',
          rule: 'reveal-8 and reveal-9 gate on the prior line clip end, never a fixed timer',
          severity: 'must',
          enforcedBy: ['reveal-timing-check'],
        },
        {
          id: 'catw-audio-ownership',
          rule: 'Every spoken line resolves to a recorded clip; no live Cartesia (no {name} slot)',
          severity: 'must',
          enforcedBy: ['audio-ownership-check'],
        },
        {
          id: 'catw-clips-resolve',
          rule: 'onboard_beginner_01_1 and create_your_own resolve to real assets',
          severity: 'must',
          enforcedBy: ['render-link-integrity-check'],
        },
        {
          id: 'catw-id-alias',
          rule: 'beatId maps to the screenId / route / step / session_log / data-beat-id in identity',
          severity: 'must',
          enforcedBy: ['id-alias-check'],
        },
      ],
      // section 13 - multi-turn conversation model (scripted prompts only, Yair 2026-07-09)
      conversation: {
        opens: 'after the opener bubble and the tiles reveal (ask what they most want to work on)',
        branches: [
          {
            on: 'names or taps one valid category',
            reply: 'none (silent after pick); map to the exact label',
            then: 'tool:submit_category',
          },
          {
            on: 'names two or more',
            reply: 'scripted: "Which feels most urgent right now?"',
            then: 'wait',
            voice: 'clip-family:onboard_category_women_2 (pending recording)',
          },
          {
            on: 'names something off-list',
            reply:
              'scripted: "You can create your own for that. Want to?" (routes to the create-your-own tile)',
            then: 'wait',
            voice: 'clip-family:onboard_category_women_3 (pending recording)',
          },
          {
            on: 'off-topic or world question',
            reply:
              'global rule glob-out-of-scope: one brief acknowledgement, steer back with the category question',
            then: 'wait',
            voice: 'clip-family:onboard_offtopic (pending recording)',
          },
        ],
        maxTurns: 4,
        onMaxTurns: 'plain one-line re-ask of the category question and point to the tap path',
      },
      contextProse: {
        prose:
          'Focus area. Collect one category. The opener shows as a coach bubble, then the category tiles appear (women-art illustration set). When the create-your-own option appears at the end, "Or you can create your own" is spoken verbal only. Ask what they most want to work on, then wait. If they name several, ask which feels most urgent. Keep the response specific to their pick.',
        pending: true,
        enforcedBy: ['eval:parity-walk'],
      },
      allowedTools: {
        tools: ['submit_category', 'advance_step'],
        callRules:
          'Inherited from GLOBAL_CONTEXT, bound here: call once the category is captured; only this beat tools; pass the canonical category value, not the user raw words.',
        specs: [
          {
            tool: 'submit_category',
            args: '{ category: string } where category is one of the 8 LOCKED labels (CANONICAL_ENUMS.categories) OR a custom string from the create-your-own tile',
            when: 'once the user has settled on exactly one category',
          },
          {
            tool: 'advance_step',
            args: '{}',
            when: 'immediately after submit_category returns',
          },
        ],
        note: 'There is NO submit_habits or submit_goals on this beat. Category uses submit_category only (per coach-per-beat tool correction).',
        enforcedBy: ['tool-contract-check'],
      },
      persistence: {
        rows: [
          {
            label: 'writes',
            value: 'the chosen category (one value)',
          },
          {
            label: 'never re-ask',
            value:
              'the category, once captured, is carried forward; downstream goal/habit beats read it, never re-prompt',
          },
          {
            label: 'resume key',
            value: 'current_step advanced past category-women proves this beat is done on refresh',
          },
        ],
        watchOut:
          'Exact table + column for the category write is NOT in the render source or the docs read. Flagged for app-reconcile; do not invent a table name. The carry-forward contract (never re-ask category) is from GLOBAL_CONTEXT and is real.',
        enforcedBy: ['persistence-contract-check'],
      },
      flow: {
        rows: [
          {
            label: 'advance condition',
            value: 'submit_category fired with a valid single category, then advance_step',
          },
          {
            label: 'upstream branch (into this beat)',
            value:
              "gender === 'Female' selects this women-art variant; Male and Other route to the default category beat",
          },
          {
            label: 'downstream branch (out of this beat)',
            value:
              'create-your-own tile -> goal-custom (order 21); any of the 8 canonical categories -> the matching goals-* beat by category (e.g. Sleep better -> goals-sleep, order 13)',
          },
          {
            label: 'gate',
            value:
              'exactly one category; if the user names two, the coach resolves to one before the tool fires (catw-single-select)',
          },
        ],
        enforcedBy: ['advance-gate-check'],
      },
      edges: {
        rows: [
          {
            edge: 'tool failure',
            behavior:
              'submit_category errors: retry once quietly. If it still fails, SURFACE it, never fail silently, and do not advance. Tap/text path: a toast "Couldn\'t save that, tap to retry" and the picked category stays selected for the retry. Voice path: one short coach line "That didn\'t go through, let me try again." (Yair-approved tool-failure contract, 2026-07-09.)',
            voice: 'clip-family:onboard_category_women_edge_1 (pending recording)',
          },
          {
            edge: 'off-topic input',
            behavior:
              'acknowledge briefly, steer back with one short pointer question, do not advance',
          },
          {
            edge: 'skip / decline',
            behavior:
              'user will not choose: falls to the plain one-line re-ask and the tap path (max-turns behavior, no brainstorm; copy-decisions 2026-07-10), never force',
          },
          {
            edge: 'empty state',
            behavior:
              'no tiles appeared for the user: ask one neutral question ("Is anything coming up for you to pick from?"), do NOT recite the category list to fill the silence',
            voice: 'clip-family:onboard_category_women_edge_4 (pending recording)',
          },
          {
            edge: 'names two',
            behavior: 'ask which feels most urgent, then take the one',
          },
          {
            edge: 'names something off-list',
            behavior: 'route to the create-your-own tile / custom category',
          },
        ],
        enforcedBy: ['eval:edge-walk'],
      },
      acceptance: {
        rows: [
          {
            criterion: 'shows the right thing',
            check:
              'phone renders category-grid variant female, 8 tiles + create-your-own, single-select, nothing preselected (diff phone vs components)',
          },
          {
            criterion: 'says the right thing',
            check:
              'opener spoken verbatim, create-your-own verbal-only, no read / praise / contrarian / platitude (rules.context evals)',
          },
          {
            criterion: 'advances correctly',
            check:
              'exactly one category captured via submit_category, then advance_step; two-category attempt resolves to one first (flow gate)',
          },
          {
            criterion: 'survives a refresh',
            check:
              'category persists, beat not re-asked, current_step resumes past category-women (persistence resume key)',
          },
          {
            criterion: 'variant is correct',
            check:
              "gender === 'Female' renders this beat; Male and Other render default category (catw-women-variant)",
          },
        ],
        enforcedBy: [
          'component-registry-check',
          'advance-gate-check',
          'persistence-contract-check',
          'render-link-integrity-check',
          'eval:parity-walk',
          'eval:edge-walk',
        ],
      },
      applicableDecisions: {
        rows: [
          {
            decision:
              "3. Women's art variant (gender === 'Female' is the ONLY selector; Male and Other get default)",
            binds: true,
            how: 'this beat IS the render side of decision 3; encoded as rules.code catw-women-variant with component-registry-check',
          },
          {
            decision: '1, 2 (profile gates), 4/5 (habit caps), 6, 7 (reflection)',
            binds: false,
            how: 'not this beat',
          },
        ],
        enforcedBy: ['decisions-coverage-check'],
      },
      sectionManifest: {
        identity: 'filled',
        scriptMeta: 'filled',
        components: 'filled',
        voice: 'filled',
        rulesContext: 'filled',
        rulesCode: 'filled',
        conversation: 'filled',
        contextProse: 'filled',
        allowedTools: 'filled',
        persistence: 'filled',
        flow: 'filled',
        edges: 'filled',
        acceptance: 'filled',
        applicableDecisions: 'filled',
      },
    },
    script: [
      {
        seq: 1,
        words:
          "Let's choose one area of your life that you'd like to improve on. Here are our recommended categories.",
        bindsTo: {
          kind: 'bubble',
          element: 'bubble-1',
          screen: 'ONBOARD-BEGINNER-01',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_01_1',
        clipPath: '/voice/ob/onboard_beginner_01_1.wav',
      },
      {
        seq: 2,
        words: '',
        bindsTo: {
          kind: 'component',
          element: 'reveal-8',
          screen: 'ONBOARD-BEGINNER-01',
        },
        voice: 'mp3',
        clip: null,
        clipPath: null,
      },
      {
        seq: 3,
        words: 'Or you can create your own.',
        bindsTo: {
          kind: 'component',
          element: 'reveal-9',
          screen: 'ONBOARD-BEGINNER-01',
        },
        voice: 'mp3',
        clip: 'create_your_own',
        clipPath: '/voice/ob/create_your_own.wav',
      },
    ],
    io: {
      dataIn: [
        {
          key: 'profile.gender',
          from: 'flow-state',
          writtenBy: 'submit_profile',
          note: 'variant selector: Female renders this beat, everyone else gets category (decision 3)',
        },
      ],
      dataOut: [
        {
          key: 'onboarding.category',
          from: 'flow-state',
          writtenBy: 'submit_category',
          persistsTo: 'onboarding_states.data (verify key at app-reconcile)',
        },
      ],
    },
  },
  {
    // L4c: merged category-reaction + goals-ask opener. Resolves by the category
    // picked upstream (Sleep better). Named once, one fewer beat than a separate reaction.
    id: 'goals-sleep',
    name: 'Goals (Sleep better)',
    order: 13,
    path: 'beginner',
    type: 'goals-list',
    screenId: 'ONBOARD-BEGINNER-02--SLEEP',
    allowedTools: 'submit_goals, advance_step',
    expectedResponse: 'Names or picks 1 to 2 goals',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      category: 'Sleep better',
    },
    bible: {
      // components pending-app-reconcile: the "n of 2 selected" counter + Continue affordance
      // are ASSERTED SPEC the render component does not build yet (see components.watchOut).
      sectionManifest: {
        identity: 'filled',
        scriptMeta: 'filled',
        components: 'pending-app-reconcile',
        voice: 'filled',
        rulesContext: 'filled',
        rulesCode: 'filled',
        conversation: 'filled',
        contextProse: 'filled',
        allowedTools: 'filled',
        persistence: 'filled',
        flow: 'filled',
        edges: 'filled',
        acceptance: 'filled',
        applicableDecisions: 'filled',
      },
      identity: {
        rows: [
          { label: 'beatId (canonical)', value: 'goals-sleep' },
          { label: 'name', value: 'Goals (Sleep better)' },
          { label: 'order', value: '13' },
          { label: 'path', value: 'beginner' },
          { label: 'type', value: 'goals-list' },
        ],
        aliases: [
          { surface: 'screenId', value: 'ONBOARD-BEGINNER-02--SLEEP' },
          { surface: 'route', value: '/onboarding/beginner-02 (sleep category variant)' },
          { surface: 'persisted current_step', value: 'goals-sleep' },
          { surface: 'session_log value', value: 'goals-sleep' },
          { surface: 'data-beat-id', value: 'goals-sleep' },
        ],
        watchOut:
          'The 8 goals-* beats share the base screen ONBOARD-BEGINNER-02 and differ only by the category suffix (--SLEEP). The beatId is the unique key; the render selects the variant by the category picked upstream, not by a distinct screenId root. The alias-check must keep each goals-* beatId other aliases unique.',
        enforcedBy: ['id-alias-check'],
      },
      scriptMeta: {
        rows: [
          {
            seq: 1,
            reveal:
              'opener bubble; the Goals tiles bloom GATED on this opener (seq-1) clip end, never a fixed timer',
            timing: 'karaoke per-word on the bubble',
          },
        ],
        enforcedBy: ['render-link-integrity-check', 'reveal-timing-check'],
      },
      components: {
        rows: [
          { label: 'component (registry key)', value: 'goals-list' },
          {
            label: 'variant',
            value: "category = Sleep better (from source props.category: 'Sleep better')",
          },
          {
            label: 'on-screen tiles',
            value:
              '4 goal tiles for Sleep better: Fall asleep earlier, Wake up earlier, Sleep more consistently, Sleep more deeply (verbatim from GOAL OPTIONS BY CATEGORY), plus a "Create your own" custom-add affordance',
          },
          { label: 'selection mode', value: 'multi-select, 1 to 2 max, nothing preselected' },
          {
            label: 'exact state',
            value:
              'nothing selected on entry; the "Goals" section label renders above the tiles; a running "n of 2 selected" reflects taps; the Continue affordance advances once 1 to 2 goals are picked',
          },
          {
            label: 'derived (debug, generated never authored)',
            value:
              "resolved props: { category: 'Sleep better', tileCount: 4, min: 1, max: 2, allowsCustom: true }",
          },
        ],
        watchOut:
          'The ONLY structural difference across the 8 goals-* beats is the category and its tile set. Sleep better carries exactly these 4 labels; do not add, rename, or reorder them (they are the canonical GOAL OPTIONS BY CATEGORY strings). The "n of 2 selected" counter and Continue affordance in exact-state are ASSERTED SPEC the render component does not implement yet.',
        enforcedBy: ['component-registry-check'],
        status: 'app-reconcile-pending',
      },
      voice: {
        rows: [
          { label: 'engine', value: 'MP3' },
          {
            label: 'mode',
            value: 'Verbatim (reconciled from source Verbatim; enum is Verbatim / Generative)',
          },
        ],
        perLine: [
          { seq: 1, resolvesTo: 'recorded clip onboard_beginner_02_sleep', liveAllowed: 'NO' },
        ],
        assertion:
          'The opener carries no live slot like {name}, so the one spoken line MUST resolve to the recorded clip onboard_beginner_02_sleep. No live Cartesia on this beat.',
        enforcedBy: ['audio-ownership-check'],
      },
      rulesContext: [
        {
          id: 'gsleep-verbatim-opener',
          rule: 'Speaks the recorded sleep opener verbatim, no improvised lead-in or addition',
          severity: 'must',
          enforcedBy: ['eval:verbatim-opener'],
        },
        {
          id: 'gsleep-no-read-options',
          rule: 'Never reads the goal tiles aloud, not in full, not one as an example',
          severity: 'must',
          enforcedBy: ['eval:no-read-options'],
        },
        {
          id: 'gsleep-react-and-ask',
          rule: 'React warmly and ask for goals in one merged moment, naming the category (sleep) once',
          severity: 'must',
          enforcedBy: ['eval:warm-opener'],
        },
        {
          id: 'gsleep-no-contrarian',
          rule: 'No reframe that undercuts the pick ("sleep isn\'t really the issue")',
          severity: 'must',
          enforcedBy: ['eval:no-contrarian'],
        },
        {
          id: 'gsleep-no-platitudes',
          rule: 'No per-goal commentary or filler ("sleep is the foundation", "genuinely")',
          severity: 'must',
          enforcedBy: ['eval:no-platitudes'],
        },
        {
          id: 'gsleep-silent-after-pick',
          rule: 'Silent after each pick: no praise, no commentary, nothing except submit_goals and advance_step',
          severity: 'must',
          enforcedBy: ['eval:silent-after-pick'],
        },
        {
          id: 'gsleep-one-line-wait',
          rule: 'After the opener, asks one short pointer question then waits',
          severity: 'must',
          enforcedBy: ['eval:one-line-then-wait'],
        },
        {
          id: 'gsleep-one-or-two',
          rule: 'Allows one or two goals only; on three, asks which two matter most',
          severity: 'must',
          enforcedBy: ['eval:selection-cap'],
        },
      ],
      rulesCode: [
        {
          id: 'gsleep-tools-only',
          rule: 'Only submit_goals and advance_step are callable on this beat',
          severity: 'must',
          enforcedBy: ['tool-contract-check'],
        },
        {
          id: 'gsleep-canonical-values',
          rule: 'submit_goals passes the exact canonical goal labels (never raw words or renamed labels) and includes the COMPLETE 1-2 selection',
          severity: 'must',
          enforcedBy: ['tool-contract-check'],
        },
        {
          id: 'gsleep-advance-on-tool',
          rule: 'advance_step fires only after submit_goals captured 1 to 2 valid goals',
          severity: 'must',
          enforcedBy: ['advance-gate-check'],
        },
        {
          id: 'gsleep-goal-cap',
          rule: 'At most two goals; floor of one goal to advance',
          severity: 'must',
          enforcedBy: ['advance-gate-check'],
        },
        {
          id: 'gsleep-count-sets-branch',
          rule: 'The goal count (1 or 2) is persisted so the downstream habits beat can distribute the 2-habit cap',
          severity: 'must',
          enforcedBy: ['advance-gate-check'],
        },
        {
          id: 'gsleep-reveal-gates',
          rule: 'The Goals tiles reveal gates on the opener clip end, never a fixed timer',
          severity: 'must',
          enforcedBy: ['reveal-timing-check'],
        },
        {
          id: 'gsleep-audio-ownership',
          rule: 'The opener resolves to a recorded clip; no live Cartesia (no {name} slot)',
          severity: 'must',
          enforcedBy: ['audio-ownership-check'],
        },
        {
          id: 'gsleep-clip-resolves',
          rule: 'onboard_beginner_02_sleep resolves to a real asset',
          severity: 'must',
          enforcedBy: ['render-link-integrity-check'],
        },
        {
          id: 'gsleep-id-alias',
          rule: 'beatId maps to the screenId / route / step / session_log / data-beat-id in identity',
          severity: 'must',
          enforcedBy: ['id-alias-check'],
        },
      ],
      // section 13 - multi-turn conversation model (scripted prompts only, Yair 2026-07-09)
      conversation: {
        opens:
          'after the opener question ("Which of these would you like to start with? Pick one or two.")',
        branches: [
          {
            on: 'names or taps one or two valid goals',
            reply: 'none (silent after pick); map to the exact labels',
            then: 'tool:submit_goals',
          },
          {
            on: 'names three or more',
            reply: 'scripted: "Which two matter most right now?"',
            then: 'wait',
            voice: 'clip-family:onboard_goals_sleep_2 (pending recording)',
          },
          {
            on: 'vague or general ("just sleep in general")',
            reply: 'scripted: "If you had to pick one, what bothers you most?"',
            then: 'wait',
            voice: 'clip-family:onboard_goals_sleep_3 (pending recording)',
          },
          {
            on: 'off-topic or world question',
            reply:
              'global rule glob-out-of-scope: one brief acknowledgement, steer back with the goal question',
            then: 'wait',
            voice: 'clip-family:onboard_offtopic (pending recording)',
          },
        ],
        maxTurns: 4,
        onMaxTurns: 'plain one-line re-ask of the goal question and point to the tap path',
      },
      contextProse: {
        prose:
          'Goals inside the chosen category (Sleep better). The opener reacts warmly to the category and asks for goals in one merged moment, then the Goals tiles appear. Collect one or two goals. Map what the user says to the exact on-screen label; if they speak generally, map to the closest one or ask one short question. One or two, no more. The goal count sets up the downstream habit distribution. Do not read the tiles out loud, do not coach or explain per goal, do not allow more than two.',
        pending: true,
        enforcedBy: ['eval:parity-walk'],
      },
      allowedTools: {
        tools: ['submit_goals', 'advance_step'],
        callRules:
          'Inherited from GLOBAL_CONTEXT, bound here: call once one or two goals are captured; only this beat tools; pass the canonical goal labels including the COMPLETE selection, not the user raw words.',
        specs: [
          {
            tool: 'submit_goals',
            args: '{ goals: string[] } - the COMPLETE current selection of 1 or 2 goals, each an exact label from GOAL OPTIONS BY CATEGORY for Sleep better (confirm canonical arg name/shape)',
            when: 'once the user has settled on one or two goals',
            pending: true,
          },
          {
            tool: 'advance_step',
            args: '{}',
            when: 'immediately after submit_goals returns',
          },
        ],
        note: 'No submit_category or habit tools on this beat; goals-list uses submit_goals only. Habits are added on the downstream habits-* beat.',
        enforcedBy: ['tool-contract-check'],
      },
      persistence: {
        rows: [
          {
            label: 'writes',
            value:
              'the chosen 1-2 goals + the goal count (1 or 2) that sets up the downstream habit distribution',
          },
          {
            label: 'never re-ask',
            value:
              'the goals and count, once captured, carry forward; the habits beat reads them, never re-prompts',
          },
          {
            label: 'resume key',
            value: 'current_step advanced past goals-sleep proves this beat is done on refresh',
          },
        ],
        watchOut:
          'The exact table + column for the goals write is NOT confirmed in the render source. screen_contexts (Vapi-era) indicates user_onboarding.selected_subcategories[]; treat as an app-side hint, not final. Flagged for app-reconcile; do not invent a table name. The carry-forward contract (never re-ask goals) is from GLOBAL_CONTEXT and is real.',
        enforcedBy: ['persistence-contract-check'],
      },
      flow: {
        rows: [
          {
            label: 'advance condition',
            value: 'submit_goals fired with 1 to 2 valid goals, then advance_step',
          },
          {
            label: 'upstream branch (into this beat)',
            value:
              'the category picked upstream (Sleep better) routes to this goals-sleep variant; the other 7 categories route to their matching goals-* beat',
          },
          {
            label: 'downstream branch (out of this beat)',
            value:
              'the goal count sets up the habit distribution: two goals -> the next beat gives one habit per goal; one goal -> the next beat allows one or two habits. Each picked goal routes to its matching habits-* opener (e.g. Fall asleep earlier -> habits-fall-asleep-earlier)',
          },
          {
            label: 'gate',
            value:
              'one or two goals; if the user names three, the coach resolves to two before the tool fires (gsleep-one-or-two)',
          },
        ],
        enforcedBy: ['advance-gate-check'],
      },
      edges: {
        rows: [
          {
            edge: 'tool failure',
            behavior:
              'submit_goals errors: retry once quietly. If it still fails, SURFACE it, never fail silently, and do not advance. Tap/text path: a toast "Couldn\'t save that, tap to retry" and the picked tiles stay selected for the retry. Voice path: one short coach line "That didn\'t go through, let me try again." (Yair-approved tool-failure contract, 2026-07-09.)',
            voice: 'clip-family:onboard_goals_sleep_edge_1 (pending recording)',
          },
          {
            edge: 'off-topic input',
            behavior:
              'one short acknowledgement, at most one sentence, no new topic and no advice, then re-ask the goal question ("Which of these feels right to start with?"). Do not follow the tangent, do not add commentary, do not advance.',
            voice: 'clip-family:onboard_goals_sleep_edge_2 (pending recording)',
          },
          {
            edge: 'skip / decline',
            behavior:
              'user will not choose: falls to the plain one-line re-ask and the tap path (max-turns behavior, no brainstorm; copy-decisions 2026-07-10), never force a pick',
          },
          {
            edge: 'empty state',
            behavior:
              'no tiles appeared for the user: ask one neutral question ("Is anything coming up for you to pick from?"), do NOT recite the goal list to fill the silence',
            voice: 'clip-family:onboard_goals_sleep_edge_4 (pending recording)',
          },
          {
            edge: 'names three',
            behavior: 'ask which two matter most, then take those two',
          },
          {
            edge: 'vague / general ("just sleep in general")',
            behavior:
              'map to the closest label or ask one short question to pin it ("If you had to pick one, what bothers you most?"); never invent a label',
            voice: 'clip-family:onboard_goals_sleep_edge_6 (pending recording)',
          },
        ],
        enforcedBy: ['eval:edge-walk'],
      },
      acceptance: {
        rows: [
          {
            criterion: 'shows the right thing',
            check:
              'phone renders goals-list for Sleep better, 4 tiles + create-your-own, multi-select 1-2, nothing preselected (diff phone vs components)',
          },
          {
            criterion: 'says the right thing',
            check:
              'opener spoken verbatim, category named once, no read / praise / contrarian / platitude (rules.context evals)',
          },
          {
            criterion: 'advances correctly',
            check:
              'one or two goals captured via submit_goals, then advance_step; a three-goal attempt resolves to two first (flow gate)',
          },
          {
            criterion: 'survives a refresh',
            check:
              'goals + count persist, beat not re-asked, current_step resumes past goals-sleep (persistence resume key)',
          },
          {
            criterion: 'routes correctly',
            check:
              'each picked goal routes to its matching habits-* opener; the goal count sets the downstream habit distribution',
          },
        ],
        enforcedBy: [
          'component-registry-check',
          'advance-gate-check',
          'persistence-contract-check',
          'render-link-integrity-check',
          'eval:parity-walk',
          'eval:edge-walk',
        ],
      },
      applicableDecisions: {
        rows: [
          {
            decision:
              '4/5. Habit cap (2 habits total, floor 1, distributable: 2 goals x1 or 1 goal x2)',
            binds: false,
            how: 'not enforced on this beat; the cap is enforced on the downstream habits beat. This goals beat captures the 1-or-2 goal COUNT that decision 4/5 uses to distribute the cap, so it is the input, not the gate.',
          },
          {
            decision: '1, 2 (profile gates), 3 (women-art), 6, 7 (reflection)',
            binds: false,
            how: 'not this beat',
          },
        ],
        enforcedBy: ['decisions-coverage-check'],
      },
    },
    script: [
      {
        seq: 1,
        words:
          "Awesome that you started with sleep. When your sleep is solid, almost everything else gets easier, your mood, your patience, your focus. Strong place to begin, and I'm glad you did. Which of these would you like to start with? Pick one or two.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-02--SLEEP',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_02_sleep',
        clipPath: '/voice/ob/onboard_beginner_02_sleep.wav',
      },
    ],
    io: {
      dataIn: [{ key: 'onboarding.category', from: 'flow-state', writtenBy: 'submit_category' }],
      dataOut: [
        {
          key: 'onboarding.goals',
          from: 'flow-state',
          writtenBy: 'submit_goals',
          persistsTo: 'onboarding_states.data (verify key)',
          note: 'goal count = goals.length, DERIVED (drives the habits distribution); not a separate persisted field',
        },
      ],
    },
  },
  {
    // L4c: merged category-reaction + goals-ask opener. Resolves by the category
    // picked upstream (Move more). Named once, one fewer beat than a separate reaction.
    id: 'goals-move',
    name: 'Goals (Move more)',
    order: 14,
    path: 'beginner',
    type: 'goals-list',
    variantOf: 'goals-sleep',
    screenId: 'ONBOARD-BEGINNER-02--MOVE',
    allowedTools: 'submit_goals, advance_step',
    expectedResponse: 'Names or picks 1 to 2 goals',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      category: 'Move more',
    },
    script: [
      {
        seq: 1,
        words:
          "Love that you chose this. Movement is one of those things where a little goes a long way, and I think you're going to feel the difference faster than you'd expect. Which of these would you like to start with? Pick one or two.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-02--MOVE',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_02_move',
        clipPath: '/voice/ob/onboard_beginner_02_move.wav',
      },
    ],
  },
  {
    // L4c: merged category-reaction + goals-ask opener. Resolves by the category
    // picked upstream (Eat better). Named once, one fewer beat than a separate reaction.
    id: 'goals-eat',
    name: 'Goals (Eat better)',
    order: 15,
    path: 'beginner',
    type: 'goals-list',
    variantOf: 'goals-sleep',
    screenId: 'ONBOARD-BEGINNER-02--EAT',
    allowedTools: 'submit_goals, advance_step',
    expectedResponse: 'Names or picks 1 to 2 goals',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      category: 'Eat better',
    },
    script: [
      {
        seq: 1,
        words:
          "I'm happy you went with this one. Food is something you touch every single day, so it's a place where small changes really add up, and I'm excited to help you find yours. Which of these would you like to start with? Pick one or two.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-02--EAT',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_02_eat',
        clipPath: '/voice/ob/onboard_beginner_02_eat.wav',
      },
    ],
  },
  {
    // L4c: merged category-reaction + goals-ask opener. Resolves by the category
    // picked upstream (Feel more energized). Named once, one fewer beat than a separate reaction.
    id: 'goals-energy',
    name: 'Goals (Feel more energized)',
    order: 16,
    path: 'beginner',
    type: 'goals-list',
    variantOf: 'goals-sleep',
    screenId: 'ONBOARD-BEGINNER-02--ENERGY',
    allowedTools: 'submit_goals, advance_step',
    expectedResponse: 'Names or picks 1 to 2 goals',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      category: 'Feel more energized',
    },
    script: [
      {
        seq: 1,
        words:
          "This is a great one to choose. More energy changes how every part of your day feels, and I'm excited for what that could open up for you. Which of these would you like to start with? Pick one or two.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-02--ENERGY',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_02_energy',
        clipPath: '/voice/ob/onboard_beginner_02_energy.wav',
      },
    ],
  },
  {
    // L4c: merged category-reaction + goals-ask opener. Resolves by the category
    // picked upstream (Reduce stress). Named once, one fewer beat than a separate reaction.
    id: 'goals-stress',
    name: 'Goals (Reduce stress)',
    order: 17,
    path: 'beginner',
    type: 'goals-list',
    variantOf: 'goals-sleep',
    screenId: 'ONBOARD-BEGINNER-02--STRESS',
    allowedTools: 'submit_goals, advance_step',
    expectedResponse: 'Names or picks 1 to 2 goals',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      category: 'Reduce stress',
    },
    script: [
      {
        seq: 1,
        words:
          "I'm really glad you chose this. Giving your stress somewhere to go is one of the kindest things you can do for yourself, and I'd love to help you build that. Which of these would you like to start with? Pick one or two.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-02--STRESS',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_02_stress',
        clipPath: '/voice/ob/onboard_beginner_02_stress.wav',
      },
    ],
  },
  {
    // L4c: merged category-reaction + goals-ask opener. Resolves by the category
    // picked upstream (Improve focus). Named once, one fewer beat than a separate reaction.
    id: 'goals-focus',
    name: 'Goals (Improve focus)',
    order: 18,
    path: 'beginner',
    type: 'goals-list',
    variantOf: 'goals-sleep',
    screenId: 'ONBOARD-BEGINNER-02--FOCUS',
    allowedTools: 'submit_goals, advance_step',
    expectedResponse: 'Names or picks 1 to 2 goals',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      category: 'Improve focus',
    },
    script: [
      {
        seq: 1,
        words:
          "I'm happy you went with focus. There's a specific kind of good that comes from finishing something without your attention scattering everywhere, and I'd love to help you get more of that. Which of these would you like to start with? Pick one or two.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-02--FOCUS',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_02_focus',
        clipPath: '/voice/ob/onboard_beginner_02_focus.wav',
      },
    ],
  },
  {
    // L4c: merged category-reaction + goals-ask opener. Resolves by the category
    // picked upstream (Break bad habits). Named once, one fewer beat than a separate reaction.
    id: 'goals-break',
    name: 'Goals (Break bad habits)',
    order: 19,
    path: 'beginner',
    type: 'goals-list',
    variantOf: 'goals-sleep',
    screenId: 'ONBOARD-BEGINNER-02--BREAK',
    allowedTools: 'submit_goals, advance_step',
    expectedResponse: 'Names or picks 1 to 2 goals',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      category: 'Break bad habits',
    },
    script: [
      {
        seq: 1,
        words:
          "Love that you're taking this on. These are the changes that actually free up something in your life, and I think you'll be surprised how good it feels to loosen the grip. Which of these would you like to start with? Pick one or two.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-02--BREAK',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_02_break',
        clipPath: '/voice/ob/onboard_beginner_02_break.wav',
      },
    ],
  },
  {
    // L4c: merged category-reaction + goals-ask opener. Resolves by the category
    // picked upstream (Get more organized). Named once, one fewer beat than a separate reaction.
    id: 'goals-organize',
    name: 'Goals (Get more organized)',
    order: 20,
    path: 'beginner',
    type: 'goals-list',
    variantOf: 'goals-sleep',
    screenId: 'ONBOARD-BEGINNER-02--ORGANIZE',
    allowedTools: 'submit_goals, advance_step',
    expectedResponse: 'Names or picks 1 to 2 goals',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      category: 'Get more organized',
    },
    script: [
      {
        seq: 1,
        words:
          "I'm happy you picked this. There's something really good about clearing the mental clutter, and I think you're going to feel lighter as we go. Which of these would you like to start with? Pick one or two.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-02--ORGANIZE',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_02_organize',
        clipPath: '/voice/ob/onboard_beginner_02_organize.wav',
      },
    ],
  },
  {
    id: 'goal-custom',
    name: 'Create your own goal',
    order: 21,
    path: 'beginner',
    type: 'custom-entry',
    screenId: 'ONBOARD-BEGINNER-02-CUSTOM',
    context: null,
    allowedTools: 'submit_goals, advance_step',
    expectedResponse: 'Names their own goal',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      kind: 'goal',
    },
    // Archetype = single free-entry data beat (one spoken prompt, the user names their
    // own goal in the text input). conversation is { na } (a single capture, no branch);
    // The render owns the custom-goal contract: custom goals use submit_goals with
    // source=custom and are never forced through a canonical-category label list.
    bible: {
      sectionManifest: {
        identity: 'filled',
        scriptMeta: 'filled',
        components: 'filled',
        voice: 'filled',
        rulesContext: 'filled',
        rulesCode: 'filled',
        conversation: { na: 'single free-entry — the user names one goal; no branching turn' },
        contextProse: 'filled',
        allowedTools: 'filled',
        persistence: 'filled',
        flow: 'filled',
        edges: 'filled',
        acceptance: 'filled',
        applicableDecisions: 'filled',
      },
      identity: {
        rows: [
          { label: 'beatId (canonical)', value: 'goal-custom' },
          { label: 'name', value: 'Create your own goal' },
          { label: 'order', value: '21' },
          { label: 'path', value: 'beginner' },
          { label: 'type', value: 'custom-entry' },
        ],
        aliases: [
          { surface: 'screenId', value: 'ONBOARD-BEGINNER-02-CUSTOM' },
          { surface: 'route', value: '/onboarding/beginner-02-custom' },
          { surface: 'persisted current_step', value: 'goal-custom' },
          { surface: 'session_log value', value: 'goal-custom' },
          { surface: 'data-beat-id', value: 'goal-custom' },
        ],
        enforcedBy: ['id-alias-check'],
      },
      scriptMeta: {
        rows: [
          {
            seq: 1,
            reveal:
              'opener prompt on entry alongside the text input; no gate (the one spoken line)',
            timing: 'karaoke per-word on the prompt',
          },
        ],
        enforcedBy: ['render-link-integrity-check', 'reveal-timing-check'],
      },
      components: {
        rows: [
          { label: 'component (registry key)', value: 'custom-entry' },
          { label: 'kind', value: 'goal (from source props.kind)' },
          { label: 'on-screen', value: 'a single text input for the user to name their own goal' },
          { label: 'selection mode', value: 'free text entry; nothing preselected' },
        ],
        watchOut:
          'This beat is reached from the create-your-own category tile; the user types a goal in their own words.',
        enforcedBy: ['component-registry-check'],
      },
      voice: {
        rows: [
          { label: 'engine', value: 'MP3' },
          { label: 'mode', value: 'Verbatim (enum is Verbatim / Generative)' },
        ],
        perLine: [
          { seq: 1, resolvesTo: 'recorded clip onboard_beginner_02_custom_1', liveAllowed: 'NO' },
        ],
        assertion:
          'The prompt carries no live slot like {name}, so it MUST resolve to the recorded clip onboard_beginner_02_custom_1. No live Cartesia on this beat.',
        enforcedBy: ['audio-ownership-check'],
      },
      rulesContext: [
        {
          id: 'goalcustom-verbatim-opener',
          rule: 'Speaks the prompt verbatim, then waits for the user to name their goal',
          severity: 'must',
          enforcedBy: ['eval:verbatim-opener'],
        },
        {
          id: 'goalcustom-capture-their-words',
          rule: 'Captures the goal in the user own words; never rewords or reframes it',
          severity: 'must',
          enforcedBy: ['eval:one-line-then-wait'],
        },
        {
          id: 'goalcustom-no-platitudes',
          rule: 'No praise or commentary on the goal they name; take it and move on',
          severity: 'must',
          enforcedBy: ['eval:no-platitudes'],
        },
      ],
      rulesCode: [
        {
          id: 'goalcustom-audio-ownership',
          rule: 'The prompt resolves to a recorded clip; no live Cartesia (no {name} slot)',
          severity: 'must',
          enforcedBy: ['audio-ownership-check'],
        },
        {
          id: 'goalcustom-clip-resolves',
          rule: 'onboard_beginner_02_custom_1 resolves to a real asset',
          severity: 'must',
          enforcedBy: ['render-link-integrity-check'],
        },
        {
          id: 'goalcustom-id-alias',
          rule: 'beatId maps to the screenId / route / step / session_log / data-beat-id in identity',
          severity: 'must',
          enforcedBy: ['id-alias-check'],
        },
      ],
      contextProse: {
        prose:
          'Create your own goal. Reached from the create-your-own category tile. Speak the prompt, then let the user name their own goal in the text input, in their own words. Capture it verbatim, add no praise, and move on to the habits.',
        enforcedBy: ['eval:parity-walk'],
      },
      allowedTools: {
        tools: ['submit_goals', 'advance_step'],
        callRules:
          'Call submit_goals once with the complete custom-goal selection. Preserve the user wording, except trim surrounding whitespace. Then advance.',
        specs: [
          {
            tool: 'submit_goals',
            args: '{ goals: string[] (1-2 entries, each 1-100 characters), source: "custom" }',
            when: 'once the user submits one or two non-empty custom goals',
          },
          { tool: 'advance_step', args: '{}', when: 'immediately after submit_goals succeeds' },
        ],
        note: 'AUTHORITATIVE RENDER CONTRACT. TODO app migration: submit_goals must accept source=custom and preserve free-text goals without canonical-category matching.',
        enforcedBy: ['tool-contract-check'],
      },
      persistence: {
        rows: [
          {
            label: 'writes',
            value:
              'onboarding_states.data.goals = the complete custom-goal string array (verbatim except surrounding whitespace)',
          },
          {
            label: 'never re-ask',
            value:
              'the custom goals rehydrate from onboarding_states.data.goals and seed the custom habit picker',
          },
          {
            label: 'resume key',
            value:
              'onboarding_states.data.goals with onboarding_states.data.categorySource = custom, plus current_step past goal-custom',
          },
        ],
        watchOut:
          'AUTHORITATIVE RENDER CONTRACT. TODO app migration: custom-category goals bypass the fixed-label validator, while canonical goals keep exact-label validation. Source: api/_lib/llm/onboarding/handlers/submitGoals.ts.',
        enforcedBy: ['persistence-contract-check'],
      },
      flow: {
        rows: [
          { label: 'advance condition', value: 'the user submits a non-empty custom goal' },
          {
            label: 'upstream branch (into this beat)',
            value: 'the create-your-own category tile routes here',
          },
          {
            label: 'downstream branch (out of this beat)',
            value: 'proceeds to the habits picker for the custom goal',
          },
          { label: 'gate', value: 'a non-empty goal must be entered before advancing' },
        ],
        enforcedBy: ['advance-gate-check'],
      },
      edges: {
        rows: [
          {
            edge: 'empty submission',
            behavior: 'do not advance on an empty entry; wait for the user to name a goal',
          },
          {
            edge: 'save contract migration',
            behavior:
              'submit_goals must preserve custom-goal wording and write the complete goals array before this beat advances; until migrated, do not substitute a canonical category or invent a goal',
          },
        ],
        enforcedBy: ['eval:edge-walk'],
      },
      acceptance: {
        rows: [
          {
            criterion: 'shows the right thing',
            check: 'phone renders a single text input for the custom goal, nothing preselected',
          },
          {
            criterion: 'says the right thing',
            check: 'the prompt plays verbatim from onboard_beginner_02_custom_1',
          },
          {
            criterion: 'advances correctly',
            check: 'a non-empty custom goal is captured, then the flow proceeds to habits',
          },
        ],
        enforcedBy: ['component-registry-check', 'render-link-integrity-check', 'eval:edge-walk'],
      },
      applicableDecisions: {
        rows: [
          {
            decision: '1-7 (profile gates, women-art, habit caps, reflection)',
            binds: false,
            how: 'the custom-goal entry captures a free-text goal; no profile gate, women-art, habit cap, or reflection decision binds here',
          },
        ],
        enforcedBy: ['decisions-coverage-check'],
      },
    },
    script: [
      {
        seq: 1,
        words: 'What goal do you want to work toward?',
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-02-CUSTOM',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_02_custom_1',
        clipPath: '/voice/ob/onboard_beginner_02_custom_1.wav',
      },
    ],
    io: {
      dataIn: [{ key: 'onboarding.category', from: 'flow-state', writtenBy: 'submit_category' }],
      dataOut: [
        {
          key: 'onboarding.goals',
          from: 'flow-state',
          writtenBy: 'submit_goals',
          persistsTo: 'onboarding_states.data.goals',
          note: 'custom-goal values are the verbatim seed for the custom habit picker',
        },
      ],
    },
  },
  {
    id: 'habits',
    name: 'Habits',
    order: 22,
    path: 'beginner',
    type: 'habit-picker',
    screenId: 'ONBOARD-BEGINNER-03',
    allowedTools: 'add_habit, remove_habit, advance_step',
    expectedResponse: 'Picks habits: one per goal if two goals, one or two if one goal',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: null,
    // HEAD of the habits family (habit-picker). This is the GENERIC multi-goal
    // picker (names no goal); its ~29 per-goal children (variantOf: 'habits') derive
    // their 4 category-sensitive sections from typed per-goal data via buildHabits*
    // (resolveBeatStructure step 3b, gated on type === 'habit-picker'), so no head
    // token leaks onto a variant. The head authors all 14 sections generically here.
    bible: {
      // components pending-app-reconcile: the per-goal on-screen habit sub-lists +
      // the running counter / Continue affordance are ASSERTED SPEC not in the typed
      // source (only goalsByCategory exists; there is no habitsByGoal table yet).
      sectionManifest: {
        identity: 'filled',
        scriptMeta: 'filled',
        components: 'pending-app-reconcile',
        voice: 'filled',
        rulesContext: 'filled',
        rulesCode: 'filled',
        conversation: 'filled',
        contextProse: 'filled',
        allowedTools: 'filled',
        persistence: 'filled',
        flow: 'filled',
        edges: 'filled',
        acceptance: 'filled',
        applicableDecisions: 'filled',
      },
      identity: {
        rows: [
          { label: 'beatId (canonical)', value: 'habits' },
          { label: 'name', value: 'Habits' },
          { label: 'order', value: '22' },
          { label: 'path', value: 'beginner' },
          { label: 'type', value: 'habit-picker' },
        ],
        aliases: [
          { surface: 'screenId', value: 'ONBOARD-BEGINNER-03' },
          { surface: 'route', value: '/onboarding/beginner-03 (generic multi-goal picker)' },
          { surface: 'persisted current_step', value: 'habits' },
          { surface: 'session_log value', value: 'habits' },
          { surface: 'data-beat-id', value: 'habits' },
        ],
        watchOut:
          'This is the GENERIC head; the ~29 per-goal habits-* variants share the base screen ONBOARD-BEGINNER-03 and differ only by the goal suffix (--FALL-ASLEEP-EARLIER, ...). The beatId is the unique key; the render selects the per-goal variant by the goal picked upstream. The alias-check keeps each habits-* beatId unique.',
        enforcedBy: ['id-alias-check'],
      },
      scriptMeta: {
        rows: [
          {
            seq: 1,
            reveal:
              'opener bubble; the habit options bloom GATED on this opener (seq-1) clip end, never a fixed timer',
            timing: 'karaoke per-word on the bubble',
          },
        ],
        enforcedBy: ['render-link-integrity-check', 'reveal-timing-check'],
      },
      components: {
        rows: [
          { label: 'component (registry key)', value: 'habit-picker' },
          {
            label: 'variant',
            value:
              'generic (no goal on the head); the per-goal variants render the habit set for the goal picked upstream',
          },
          {
            label: 'on-screen options',
            value:
              'the habit options for the picked goal(s), one panel per goal, plus a "Create your own" custom-add affordance',
          },
          {
            label: 'selection mode',
            value:
              'multi-select, nothing selected on entry; at least one to continue; at most two habits total (one per goal when two goals were picked)',
          },
          {
            label: 'exact state',
            value:
              'nothing selected on entry; the habit options render under the opener; the Continue affordance advances once at least one habit is picked within the cap',
          },
          {
            label: 'derived (debug, generated never authored)',
            value:
              'resolved props: { min: 1, max: 2, onePerGoalWhenTwoGoals: true, allowsCustom: true }',
          },
        ],
        watchOut:
          'The per-goal on-screen habit sub-lists are NOT in the typed source (goalsByCategory covers goals only; there is no habitsByGoal table yet), and the running counter / Continue affordance in exact-state are ASSERTED SPEC the render component does not implement yet. Flagged app-reconcile-pending.',
        enforcedBy: ['component-registry-check'],
        status: 'app-reconcile-pending',
      },
      voice: {
        rows: [
          { label: 'engine', value: 'MP3' },
          {
            label: 'mode',
            value: 'Verbatim (reconciled from source Verbatim; enum is Verbatim / Generative)',
          },
        ],
        perLine: [
          { seq: 1, resolvesTo: 'recorded clip onboard_beginner_03_1', liveAllowed: 'NO' },
          {
            seq: 2,
            resolvesTo: 'silent reveal (no audio): the createOwn on-screen label',
            liveAllowed: 'NO',
          },
        ],
        assertion:
          'The generic opener carries no live slot like {name}, so the one spoken line MUST resolve to the recorded clip onboard_beginner_03_1. The seq-2 "Create your own" text is an on-screen component label, not coach audio. No live Cartesia on this beat.',
        enforcedBy: ['audio-ownership-check'],
      },
      rulesContext: [
        {
          id: 'h-verbatim-opener',
          rule: 'Speaks the recorded opener verbatim, no improvised lead-in or addition',
          severity: 'must',
          enforcedBy: ['eval:verbatim-opener'],
        },
        {
          id: 'h-count-agnostic',
          rule: 'Opener wording works whether one or two goals were picked upstream',
          severity: 'must',
          enforcedBy: ['eval:count-agnostic'],
        },
        {
          id: 'h-no-read-list',
          rule: 'Never reads the habit list aloud, in full or in part, not even one as an example',
          severity: 'must',
          enforcedBy: ['eval:no-read-options'],
        },
        {
          id: 'h-no-sublists',
          rule: 'Never reads sub-lists or anything the screen is not currently showing',
          severity: 'must',
          enforcedBy: ['eval:no-read-options'],
        },
        {
          id: 'h-match-canonical',
          rule: "Matches the user's words to the closest canonical habit name; never invents a habit not on the list",
          severity: 'must',
          enforcedBy: ['eval:invalid-value-redirect'],
        },
        {
          id: 'h-keep-the-gem',
          rule: 'Keeps the less-is-more point: one kept habit beats five, small on purpose',
          severity: 'must',
          enforcedBy: ['eval:keep-the-gem'],
        },
        {
          id: 'h-one-per-goal',
          rule: 'With two goals, takes exactly one habit per goal; never two for a single goal',
          severity: 'must',
          enforcedBy: ['eval:single-select'],
        },
        {
          id: 'h-silent-after-pick',
          rule: 'Silent after each pick: no praise or commentary, nothing except add_habit, remove_habit and advance_step',
          severity: 'must',
          enforcedBy: ['eval:silent-after-pick'],
        },
        {
          id: 'h-no-motivation',
          rule: 'No commentary or motivation after each pick',
          severity: 'must',
          enforcedBy: ['eval:no-platitudes'],
        },
      ],
      rulesCode: [
        {
          id: 'h-tools-only',
          rule: 'Only add_habit, remove_habit and advance_step are callable on this beat',
          severity: 'must',
          enforcedBy: ['tool-contract-check'],
        },
        {
          id: 'h-canonical-values',
          rule: 'add_habit passes the exact canonical habit name (never the raw words), or a custom name only when the user offers one not on the list',
          severity: 'must',
          enforcedBy: ['tool-contract-check'],
        },
        {
          id: 'h-advance-on-tool',
          rule: 'advance_step fires only after at least one habit is captured within the cap',
          severity: 'must',
          enforcedBy: ['advance-gate-check'],
        },
        {
          id: 'h-habit-cap',
          rule: 'At most two habits total; with two goals, one habit per goal; floor of one habit to advance',
          severity: 'must',
          enforcedBy: ['advance-gate-check'],
        },
        {
          id: 'h-reveal-gates',
          rule: 'The habit options reveal gates on the opener clip end, never a fixed timer',
          severity: 'must',
          enforcedBy: ['reveal-timing-check'],
        },
        {
          id: 'h-audio-ownership',
          rule: 'The opener resolves to a recorded clip; no live Cartesia (no {name} slot)',
          severity: 'must',
          enforcedBy: ['audio-ownership-check'],
        },
        {
          id: 'h-clip-resolves',
          rule: 'onboard_beginner_03_1 resolves to a real asset',
          severity: 'must',
          enforcedBy: ['render-link-integrity-check'],
        },
        {
          id: 'h-id-alias',
          rule: 'beatId maps to the screenId / route / step / session_log / data-beat-id in identity',
          severity: 'must',
          enforcedBy: ['id-alias-check'],
        },
      ],
      // section 13 - multi-turn conversation model (scripted prompts only, Yair 2026-07-09)
      conversation: {
        opens: 'after the opener asks for a habit or two that feels doable',
        branches: [
          {
            on: 'names or taps a valid habit (one per goal, or one to two for a single goal)',
            reply: 'none (silent after pick); map to the exact canonical habit name',
            then: 'tool:add_habit',
          },
          {
            on: 'names more habits than the cap allows',
            reply: 'scripted: "Let\'s keep it to one or two for now. Which matters most?"',
            then: 'wait',
            voice: 'clip-family:onboard_beginner_03_2 (pending recording)',
          },
          {
            on: 'offers a habit not on the list',
            reply:
              'accept it as a custom habit ("Create your own"); do not force it onto a canonical name',
            then: 'tool:add_habit',
            voice: 'clip-family:onboard_beginner_03_3 (pending recording)',
          },
          {
            on: 'off-topic or world question',
            reply:
              'global rule glob-out-of-scope: one brief acknowledgement, steer back with the habit question',
            then: 'wait',
            voice: 'clip-family:onboard_offtopic (pending recording)',
          },
        ],
        maxTurns: 4,
        onMaxTurns: 'plain one-line re-ask of the habit question and point to the tap path',
      },
      contextProse: {
        prose:
          'Habit selection after the goal(s) are chosen. The opener reacts to the picked goal and asks for a habit or two that feels doable, then the habit options appear. If two goals were picked, collect one habit per goal (two total, one each); if one goal was picked, collect one or two habits for it. Map what the user says to the closest canonical habit name; accept a custom habit only when they offer something not on the list. At least one to continue, at most two total. Do not read the habit list out loud, do not read sub-lists, do not add commentary after each pick. Less is more: one kept habit beats five.',
        pending: true,
        enforcedBy: ['eval:parity-walk'],
      },
      allowedTools: {
        tools: ['add_habit', 'remove_habit', 'advance_step'],
        callRules:
          'Inherited from GLOBAL_CONTEXT, bound here: call add_habit as each habit is captured; only this beat tools; pass the canonical habit name (or a custom name when offered), not the user raw words. remove_habit undoes a pick; advance_step fires once at least one habit is captured within the cap.',
        specs: [
          {
            tool: 'add_habit',
            args: '{ name: string (1-100 characters) } - one canonical habit name from the on-screen list for the picked goal, or a custom name the user offered',
            when: 'as each habit is picked, within the cap',
          },
          {
            tool: 'remove_habit',
            args: '{ name: string } - the canonical or custom habit name to remove',
            when: 'when the user unpicks a habit before advancing',
          },
          {
            tool: 'advance_step',
            args: '{}',
            when: 'once at least one habit is captured within the cap',
          },
        ],
        note: 'No goal or category tools on this beat; goals were captured on the upstream goals-* beat. habit-picker uses add_habit / remove_habit only.',
        enforcedBy: ['tool-contract-check'],
      },
      persistence: {
        rows: [
          {
            label: 'writes',
            value:
              'onboarding_states.data.habitConfigs: the chosen habits (1 or 2, capped at 2; one per goal when two goals were picked), keyed by name with add_habit defaults',
          },
          {
            label: 'never re-ask',
            value:
              'the habits, once captured, carry forward; downstream beats read them, never re-prompt',
          },
          {
            label: 'resume key',
            value: 'onboarding_states.data.habitConfigs, plus current_step advanced past this beat',
          },
        ],
        watchOut:
          'Source: api/_lib/llm/onboarding/schemas.ts and flowBible.ts Table 3. add_habit, remove_habit, and later update_habit all operate on the same habitConfigs collection.',
        enforcedBy: ['persistence-contract-check'],
      },
      flow: {
        rows: [
          {
            label: 'advance condition',
            value: 'add_habit fired with at least one habit within the cap, then advance_step',
          },
          {
            label: 'upstream branch (into this beat)',
            value:
              'the goal(s) picked upstream route into the habit pick; each picked goal routes to its matching habits-* variant of this beat',
          },
          {
            label: 'downstream branch (out of this beat)',
            value:
              'once the habit(s) are captured within the cap, onboarding continues to the next step (schedule / day-picker), then the reflection beats',
          },
          {
            label: 'gate',
            value:
              'at least one habit to advance; at most two habits total; with two goals, exactly one habit per goal (h-habit-cap)',
          },
        ],
        enforcedBy: ['advance-gate-check'],
      },
      edges: {
        rows: [
          {
            edge: 'tool failure',
            behavior:
              'add_habit errors: retry once quietly. If it still fails, SURFACE it, never fail silently, and do not advance. Tap/text path: a toast "Couldn\'t save that, tap to retry" and the picked habit stays selected for the retry. Voice path: one short coach line "That didn\'t go through, let me try again." (Yair-approved tool-failure contract, 2026-07-09.)',
            voice: 'clip-family:onboard_beginner_03_edge_1 (pending recording)',
          },
          {
            edge: 'off-topic input',
            behavior:
              'one short acknowledgement, at most one sentence, no new topic and no advice, then re-ask the habit question ("Which of these feels doable to start with?"). Do not follow the tangent, do not add commentary, do not advance.',
            voice: 'clip-family:onboard_beginner_03_edge_2 (pending recording)',
          },
          {
            edge: 'skip / decline',
            behavior:
              'user will not pick: at least one habit is needed to continue; help them find one small doable habit (h-keep-the-gem), never force a heroic one',
          },
          {
            edge: 'empty state',
            behavior:
              'no habit options appeared for the user: ask one neutral question ("Is there one small thing you could keep?"), do NOT recite the habit list to fill the silence',
            voice: 'clip-family:onboard_beginner_03_edge_4 (pending recording)',
          },
          {
            edge: 'over the cap',
            behavior:
              'user wants three or more habits: keep it to one or two, ask which matter most, then take those',
          },
          {
            edge: 'not on the list / custom',
            behavior:
              'user offers something not on the list: accept it as a custom habit ("Create your own"); never force it onto a canonical name and never invent one',
            voice: 'clip-family:onboard_beginner_03_edge_6 (pending recording)',
          },
        ],
        enforcedBy: ['eval:edge-walk'],
      },
      acceptance: {
        rows: [
          {
            criterion: 'shows the right thing',
            check:
              'phone renders habit-picker under the opener, habit options for the picked goal(s) + create-your-own, multi-select within the cap, nothing preselected (diff phone vs components)',
          },
          {
            criterion: 'says the right thing',
            check:
              'opener spoken verbatim, no read / praise / commentary; one habit per goal with two goals (rules.context evals)',
          },
          {
            criterion: 'advances correctly',
            check:
              'at least one habit captured via add_habit within the cap, then advance_step; a three-habit attempt resolves to two first (flow gate)',
          },
          {
            criterion: 'survives a refresh',
            check:
              'habits persist, beat not re-asked, current_step resumes past this beat (persistence resume key)',
          },
          {
            criterion: 'routes correctly',
            check:
              'each picked goal routes to its matching habits-* variant; after the pick, onboarding continues to the next step',
          },
        ],
        enforcedBy: [
          'component-registry-check',
          'advance-gate-check',
          'persistence-contract-check',
          'render-link-integrity-check',
          'eval:parity-walk',
          'eval:edge-walk',
        ],
      },
      applicableDecisions: {
        rows: [
          {
            decision:
              '4/5. Habit cap (2 habits total, floor 1, distributable: 2 goals x1 or 1 goal x2)',
            binds: true,
            how: 'enforced on this beat: add_habit is capped at two total, at least one to advance, one per goal when two goals were picked (h-habit-cap, advance-gate-check).',
          },
          {
            decision: '1, 2 (profile gates), 3 (women-art), 6, 7 (reflection)',
            binds: false,
            how: 'not this beat',
          },
        ],
        enforcedBy: ['decisions-coverage-check'],
      },
    },
    elements: ['createOwn'],
    script: [
      {
        seq: 1,
        words:
          "Pick one or two habits that feel doable. One habit that you actually keep is much better than a list of five that you don't keep. Create your own if nothing here fits.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-03',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_03_1',
        clipPath: '/voice/ob/onboard_beginner_03_1.wav',
      },
      {
        seq: 2,
        words: 'Create your own if nothing here fits.',
        bindsTo: {
          kind: 'component',
          element: 'createOwn',
          screen: 'ONBOARD-BEGINNER-03',
        },
        voice: 'mp3',
        clip: null,
        clipPath: null,
      },
    ],
    io: {
      dataIn: [{ key: 'onboarding.goals', from: 'flow-state', writtenBy: 'submit_goals' }],
      dataOut: [
        {
          key: 'onboarding.habits',
          from: 'flow-state',
          writtenBy: 'add_habit / remove_habit',
          persistsTo: 'onboarding_states.data.habitConfigs',
        },
      ],
    },
  },
  {
    // L3: per-goal habit-pick opener. Resolves by the goal picked (Fall asleep earlier).
    // Count-agnostic wording ("a habit or two") serves one-goal and two-goal alike.
    id: 'habits-fall-asleep-earlier',
    name: 'Habits (Fall asleep earlier)',
    order: 23,
    path: 'beginner',
    type: 'habit-picker',
    variantOf: 'habits',
    screenId: 'ONBOARD-BEGINNER-03--FALL-ASLEEP-EARLIER',
    allowedTools: 'add_habit, remove_habit, advance_step',
    expectedResponse: 'Picks habits: one per goal if two goals, one or two if one goal',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      goal: 'Fall asleep earlier',
    },
    elements: ['createOwn'],
    script: [
      {
        seq: 1,
        words: "To fall asleep earlier, let's pick a habit or two you'll actually keep.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-03--FALL-ASLEEP-EARLIER',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_03_goal_fall_asleep_earlier',
        clipPath: '/voice/ob/onboard_beginner_03_goal_fall_asleep_earlier.wav',
      },
    ],
  },
  {
    // L3: per-goal habit-pick opener. Resolves by the goal picked (Wake up earlier).
    // Count-agnostic wording ("a habit or two") serves one-goal and two-goal alike.
    id: 'habits-wake-earlier',
    name: 'Habits (Wake up earlier)',
    order: 24,
    path: 'beginner',
    type: 'habit-picker',
    variantOf: 'habits',
    screenId: 'ONBOARD-BEGINNER-03--WAKE-EARLIER',
    allowedTools: 'add_habit, remove_habit, advance_step',
    expectedResponse: 'Picks habits: one per goal if two goals, one or two if one goal',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      goal: 'Wake up earlier',
    },
    elements: ['createOwn'],
    script: [
      {
        seq: 1,
        words: "To wake up earlier, let's pick a habit or two you'll actually keep.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-03--WAKE-EARLIER',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_03_goal_wake_earlier',
        clipPath: '/voice/ob/onboard_beginner_03_goal_wake_earlier.wav',
      },
    ],
  },
  {
    // L3: per-goal habit-pick opener. Resolves by the goal picked (Sleep more consistently).
    // Count-agnostic wording ("a habit or two") serves one-goal and two-goal alike.
    id: 'habits-sleep-consistently',
    name: 'Habits (Sleep more consistently)',
    order: 25,
    path: 'beginner',
    type: 'habit-picker',
    variantOf: 'habits',
    screenId: 'ONBOARD-BEGINNER-03--SLEEP-CONSISTENTLY',
    allowedTools: 'add_habit, remove_habit, advance_step',
    expectedResponse: 'Picks habits: one per goal if two goals, one or two if one goal',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      goal: 'Sleep more consistently',
    },
    elements: ['createOwn'],
    script: [
      {
        seq: 1,
        words: "To sleep more consistently, let's pick a habit or two you'll actually keep.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-03--SLEEP-CONSISTENTLY',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_03_goal_sleep_consistently',
        clipPath: '/voice/ob/onboard_beginner_03_goal_sleep_consistently.wav',
      },
    ],
  },
  {
    // L3: per-goal habit-pick opener. Resolves by the goal picked (Sleep more deeply).
    // Count-agnostic wording ("a habit or two") serves one-goal and two-goal alike.
    id: 'habits-sleep-deeply',
    name: 'Habits (Sleep more deeply)',
    order: 26,
    path: 'beginner',
    type: 'habit-picker',
    variantOf: 'habits',
    screenId: 'ONBOARD-BEGINNER-03--SLEEP-DEEPLY',
    allowedTools: 'add_habit, remove_habit, advance_step',
    expectedResponse: 'Picks habits: one per goal if two goals, one or two if one goal',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      goal: 'Sleep more deeply',
    },
    elements: ['createOwn'],
    script: [
      {
        seq: 1,
        words: "To sleep more deeply, let's pick a habit or two you'll actually keep.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-03--SLEEP-DEEPLY',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_03_goal_sleep_deeply',
        clipPath: '/voice/ob/onboard_beginner_03_goal_sleep_deeply.wav',
      },
    ],
  },
  {
    // L3: per-goal habit-pick opener. Resolves by the goal picked (Walk more).
    // Count-agnostic wording ("a habit or two") serves one-goal and two-goal alike.
    id: 'habits-walk-more',
    name: 'Habits (Walk more)',
    order: 27,
    path: 'beginner',
    type: 'habit-picker',
    variantOf: 'habits',
    screenId: 'ONBOARD-BEGINNER-03--WALK-MORE',
    allowedTools: 'add_habit, remove_habit, advance_step',
    expectedResponse: 'Picks habits: one per goal if two goals, one or two if one goal',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      goal: 'Walk more',
    },
    elements: ['createOwn'],
    script: [
      {
        seq: 1,
        words: "For walking more, let's pick a habit or two you'll actually keep.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-03--WALK-MORE',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_03_goal_walk_more',
        clipPath: '/voice/ob/onboard_beginner_03_goal_walk_more.wav',
      },
    ],
  },
  {
    // L3: per-goal habit-pick opener. Resolves by the goal picked (Exercise consistently).
    // Count-agnostic wording ("a habit or two") serves one-goal and two-goal alike.
    id: 'habits-exercise-consistently',
    name: 'Habits (Exercise consistently)',
    order: 28,
    path: 'beginner',
    type: 'habit-picker',
    variantOf: 'habits',
    screenId: 'ONBOARD-BEGINNER-03--EXERCISE-CONSISTENTLY',
    allowedTools: 'add_habit, remove_habit, advance_step',
    expectedResponse: 'Picks habits: one per goal if two goals, one or two if one goal',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      goal: 'Exercise consistently',
    },
    elements: ['createOwn'],
    script: [
      {
        seq: 1,
        words: "To exercise more consistently, let's pick a habit or two you'll actually keep.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-03--EXERCISE-CONSISTENTLY',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_03_goal_exercise_consistently',
        clipPath: '/voice/ob/onboard_beginner_03_goal_exercise_consistently.wav',
      },
    ],
  },
  {
    // L3: per-goal habit-pick opener. Resolves by the goal picked (Improve mobility).
    // Count-agnostic wording ("a habit or two") serves one-goal and two-goal alike.
    id: 'habits-mobility',
    name: 'Habits (Improve mobility)',
    order: 29,
    path: 'beginner',
    type: 'habit-picker',
    variantOf: 'habits',
    screenId: 'ONBOARD-BEGINNER-03--MOBILITY',
    allowedTools: 'add_habit, remove_habit, advance_step',
    expectedResponse: 'Picks habits: one per goal if two goals, one or two if one goal',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      goal: 'Improve mobility',
    },
    elements: ['createOwn'],
    script: [
      {
        seq: 1,
        words: "For better mobility, let's pick a habit or two you'll actually keep.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-03--MOBILITY',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_03_goal_mobility',
        clipPath: '/voice/ob/onboard_beginner_03_goal_mobility.wav',
      },
    ],
  },
  {
    // L3: per-goal habit-pick opener. Resolves by the goal picked (Eat more intentionally).
    // Count-agnostic wording ("a habit or two") serves one-goal and two-goal alike.
    id: 'habits-eat-intentionally',
    name: 'Habits (Eat more intentionally)',
    order: 30,
    path: 'beginner',
    type: 'habit-picker',
    variantOf: 'habits',
    screenId: 'ONBOARD-BEGINNER-03--EAT-INTENTIONALLY',
    allowedTools: 'add_habit, remove_habit, advance_step',
    expectedResponse: 'Picks habits: one per goal if two goals, one or two if one goal',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      goal: 'Eat more intentionally',
    },
    elements: ['createOwn'],
    script: [
      {
        seq: 1,
        words: "To eat more intentionally, let's pick a habit or two you'll actually keep.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-03--EAT-INTENTIONALLY',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_03_goal_eat_intentionally',
        clipPath: '/voice/ob/onboard_beginner_03_goal_eat_intentionally.wav',
      },
    ],
  },
  {
    // L3: per-goal habit-pick opener. Resolves by the goal picked (Reduce overeating).
    // Count-agnostic wording ("a habit or two") serves one-goal and two-goal alike.
    id: 'habits-reduce-overeating',
    name: 'Habits (Reduce overeating)',
    order: 31,
    path: 'beginner',
    type: 'habit-picker',
    variantOf: 'habits',
    screenId: 'ONBOARD-BEGINNER-03--REDUCE-OVEREATING',
    allowedTools: 'add_habit, remove_habit, advance_step',
    expectedResponse: 'Picks habits: one per goal if two goals, one or two if one goal',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      goal: 'Reduce overeating',
    },
    elements: ['createOwn'],
    script: [
      {
        seq: 1,
        words: "To reduce overeating, let's pick a habit or two you'll actually keep.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-03--REDUCE-OVEREATING',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_03_goal_reduce_overeating',
        clipPath: '/voice/ob/onboard_beginner_03_goal_reduce_overeating.wav',
      },
    ],
  },
  {
    // L3: per-goal habit-pick opener. Resolves by the goal picked (Plan food better).
    // Count-agnostic wording ("a habit or two") serves one-goal and two-goal alike.
    id: 'habits-plan-food',
    name: 'Habits (Plan food better)',
    order: 32,
    path: 'beginner',
    type: 'habit-picker',
    variantOf: 'habits',
    screenId: 'ONBOARD-BEGINNER-03--PLAN-FOOD',
    allowedTools: 'add_habit, remove_habit, advance_step',
    expectedResponse: 'Picks habits: one per goal if two goals, one or two if one goal',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      goal: 'Plan food better',
    },
    elements: ['createOwn'],
    script: [
      {
        seq: 1,
        words: "To plan your food better, let's pick a habit or two you'll actually keep.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-03--PLAN-FOOD',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_03_goal_plan_food',
        clipPath: '/voice/ob/onboard_beginner_03_goal_plan_food.wav',
      },
    ],
  },
  {
    // L3: per-goal habit-pick opener. Resolves by the goal picked (Have more morning energy).
    // Count-agnostic wording ("a habit or two") serves one-goal and two-goal alike.
    id: 'habits-morning-energy',
    name: 'Habits (Have more morning energy)',
    order: 33,
    path: 'beginner',
    type: 'habit-picker',
    variantOf: 'habits',
    screenId: 'ONBOARD-BEGINNER-03--MORNING-ENERGY',
    allowedTools: 'add_habit, remove_habit, advance_step',
    expectedResponse: 'Picks habits: one per goal if two goals, one or two if one goal',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      goal: 'Have more morning energy',
    },
    elements: ['createOwn'],
    script: [
      {
        seq: 1,
        words: "For more morning energy, let's pick a habit or two you'll actually keep.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-03--MORNING-ENERGY',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_03_goal_morning_energy',
        clipPath: '/voice/ob/onboard_beginner_03_goal_morning_energy.wav',
      },
    ],
  },
  {
    // L3: per-goal habit-pick opener. Resolves by the goal picked (Avoid afternoon crashes).
    // Count-agnostic wording ("a habit or two") serves one-goal and two-goal alike.
    id: 'habits-avoid-crashes',
    name: 'Habits (Avoid afternoon crashes)',
    order: 34,
    path: 'beginner',
    type: 'habit-picker',
    variantOf: 'habits',
    screenId: 'ONBOARD-BEGINNER-03--AVOID-CRASHES',
    allowedTools: 'add_habit, remove_habit, advance_step',
    expectedResponse: 'Picks habits: one per goal if two goals, one or two if one goal',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      goal: 'Avoid afternoon crashes',
    },
    elements: ['createOwn'],
    script: [
      {
        seq: 1,
        words: "To avoid afternoon crashes, let's pick a habit or two you'll actually keep.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-03--AVOID-CRASHES',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_03_goal_avoid_crashes',
        clipPath: '/voice/ob/onboard_beginner_03_goal_avoid_crashes.wav',
      },
    ],
  },
  {
    // L3: per-goal habit-pick opener. Resolves by the goal picked (Keep energy more stable).
    // Count-agnostic wording ("a habit or two") serves one-goal and two-goal alike.
    id: 'habits-stable-energy',
    name: 'Habits (Keep energy more stable)',
    order: 35,
    path: 'beginner',
    type: 'habit-picker',
    variantOf: 'habits',
    screenId: 'ONBOARD-BEGINNER-03--STABLE-ENERGY',
    allowedTools: 'add_habit, remove_habit, advance_step',
    expectedResponse: 'Picks habits: one per goal if two goals, one or two if one goal',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      goal: 'Keep energy more stable',
    },
    elements: ['createOwn'],
    script: [
      {
        seq: 1,
        words: "To keep your energy more stable, let's pick a habit or two you'll actually keep.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-03--STABLE-ENERGY',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_03_goal_stable_energy',
        clipPath: '/voice/ob/onboard_beginner_03_goal_stable_energy.wav',
      },
    ],
  },
  {
    // L3: per-goal habit-pick opener. Resolves by the goal picked (Feel calmer during the day).
    // Count-agnostic wording ("a habit or two") serves one-goal and two-goal alike.
    id: 'habits-calmer-day',
    name: 'Habits (Feel calmer during the day)',
    order: 36,
    path: 'beginner',
    type: 'habit-picker',
    variantOf: 'habits',
    screenId: 'ONBOARD-BEGINNER-03--CALMER-DAY',
    allowedTools: 'add_habit, remove_habit, advance_step',
    expectedResponse: 'Picks habits: one per goal if two goals, one or two if one goal',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      goal: 'Feel calmer during the day',
    },
    elements: ['createOwn'],
    script: [
      {
        seq: 1,
        words: "To feel calmer during the day, let's pick a habit or two you'll actually keep.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-03--CALMER-DAY',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_03_goal_calmer_day',
        clipPath: '/voice/ob/onboard_beginner_03_goal_calmer_day.wav',
      },
    ],
  },
  {
    // L3: per-goal habit-pick opener. Resolves by the goal picked (Reduce evening stress).
    // Count-agnostic wording ("a habit or two") serves one-goal and two-goal alike.
    id: 'habits-evening-stress',
    name: 'Habits (Reduce evening stress)',
    order: 37,
    path: 'beginner',
    type: 'habit-picker',
    variantOf: 'habits',
    screenId: 'ONBOARD-BEGINNER-03--EVENING-STRESS',
    allowedTools: 'add_habit, remove_habit, advance_step',
    expectedResponse: 'Picks habits: one per goal if two goals, one or two if one goal',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      goal: 'Reduce evening stress',
    },
    elements: ['createOwn'],
    script: [
      {
        seq: 1,
        words: "To reduce evening stress, let's pick a habit or two you'll actually keep.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-03--EVENING-STRESS',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_03_goal_evening_stress',
        clipPath: '/voice/ob/onboard_beginner_03_goal_evening_stress.wav',
      },
    ],
  },
  {
    // L3: per-goal habit-pick opener. Resolves by the goal picked (Feel less overwhelmed).
    // Count-agnostic wording ("a habit or two") serves one-goal and two-goal alike.
    id: 'habits-less-overwhelmed',
    name: 'Habits (Feel less overwhelmed)',
    order: 38,
    path: 'beginner',
    type: 'habit-picker',
    variantOf: 'habits',
    screenId: 'ONBOARD-BEGINNER-03--LESS-OVERWHELMED',
    allowedTools: 'add_habit, remove_habit, advance_step',
    expectedResponse: 'Picks habits: one per goal if two goals, one or two if one goal',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      goal: 'Feel less overwhelmed',
    },
    elements: ['createOwn'],
    script: [
      {
        seq: 1,
        words: "To feel less overwhelmed, let's pick a habit or two you'll actually keep.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-03--LESS-OVERWHELMED',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_03_goal_less_overwhelmed',
        clipPath: '/voice/ob/onboard_beginner_03_goal_less_overwhelmed.wav',
      },
    ],
  },
  {
    // L3: per-goal habit-pick opener. Resolves by the goal picked (Start work with less friction).
    // Count-agnostic wording ("a habit or two") serves one-goal and two-goal alike.
    id: 'habits-start-work',
    name: 'Habits (Start work with less friction)',
    order: 39,
    path: 'beginner',
    type: 'habit-picker',
    variantOf: 'habits',
    screenId: 'ONBOARD-BEGINNER-03--START-WORK',
    allowedTools: 'add_habit, remove_habit, advance_step',
    expectedResponse: 'Picks habits: one per goal if two goals, one or two if one goal',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      goal: 'Start work with less friction',
    },
    elements: ['createOwn'],
    script: [
      {
        seq: 1,
        words: "To start work with less friction, let's pick a habit or two you'll actually keep.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-03--START-WORK',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_03_goal_start_work',
        clipPath: '/voice/ob/onboard_beginner_03_goal_start_work.wav',
      },
    ],
  },
  {
    // L3: per-goal habit-pick opener. Resolves by the goal picked (Do deeper work).
    // Count-agnostic wording ("a habit or two") serves one-goal and two-goal alike.
    id: 'habits-deeper-work',
    name: 'Habits (Do deeper work)',
    order: 40,
    path: 'beginner',
    type: 'habit-picker',
    variantOf: 'habits',
    screenId: 'ONBOARD-BEGINNER-03--DEEPER-WORK',
    allowedTools: 'add_habit, remove_habit, advance_step',
    expectedResponse: 'Picks habits: one per goal if two goals, one or two if one goal',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      goal: 'Do deeper work',
    },
    elements: ['createOwn'],
    script: [
      {
        seq: 1,
        words: "For deeper work, let's pick a habit or two you'll actually keep.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-03--DEEPER-WORK',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_03_goal_deeper_work',
        clipPath: '/voice/ob/onboard_beginner_03_goal_deeper_work.wav',
      },
    ],
  },
  {
    // L3: per-goal habit-pick opener. Resolves by the goal picked (Procrastinate less).
    // Count-agnostic wording ("a habit or two") serves one-goal and two-goal alike.
    id: 'habits-procrastinate-less',
    name: 'Habits (Procrastinate less)',
    order: 41,
    path: 'beginner',
    type: 'habit-picker',
    variantOf: 'habits',
    screenId: 'ONBOARD-BEGINNER-03--PROCRASTINATE-LESS',
    allowedTools: 'add_habit, remove_habit, advance_step',
    expectedResponse: 'Picks habits: one per goal if two goals, one or two if one goal',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      goal: 'Procrastinate less',
    },
    elements: ['createOwn'],
    script: [
      {
        seq: 1,
        words: "To procrastinate less, let's pick a habit or two you'll actually keep.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-03--PROCRASTINATE-LESS',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_03_goal_procrastinate_less',
        clipPath: '/voice/ob/onboard_beginner_03_goal_procrastinate_less.wav',
      },
    ],
  },
  {
    // L3: per-goal habit-pick opener. Resolves by the goal picked (Smoking).
    // Count-agnostic wording ("a habit or two") serves one-goal and two-goal alike.
    id: 'habits-smoking',
    name: 'Habits (Smoking)',
    order: 42,
    path: 'beginner',
    type: 'habit-picker',
    variantOf: 'habits',
    screenId: 'ONBOARD-BEGINNER-03--SMOKING',
    allowedTools: 'add_habit, remove_habit, advance_step',
    expectedResponse: 'Picks habits: one per goal if two goals, one or two if one goal',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      goal: 'Smoking',
    },
    elements: ['createOwn'],
    script: [
      {
        seq: 1,
        words: "To cut back on smoking, let's pick a habit or two you'll actually keep.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-03--SMOKING',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_03_goal_smoking',
        clipPath: '/voice/ob/onboard_beginner_03_goal_smoking.wav',
      },
    ],
  },
  {
    // L3: per-goal habit-pick opener. Resolves by the goal picked (Weed).
    // Count-agnostic wording ("a habit or two") serves one-goal and two-goal alike.
    id: 'habits-weed',
    name: 'Habits (Weed)',
    order: 43,
    path: 'beginner',
    type: 'habit-picker',
    variantOf: 'habits',
    screenId: 'ONBOARD-BEGINNER-03--WEED',
    allowedTools: 'add_habit, remove_habit, advance_step',
    expectedResponse: 'Picks habits: one per goal if two goals, one or two if one goal',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      goal: 'Weed',
    },
    elements: ['createOwn'],
    script: [
      {
        seq: 1,
        words: "To cut back on weed, let's pick a habit or two you'll actually keep.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-03--WEED',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_03_goal_weed',
        clipPath: '/voice/ob/onboard_beginner_03_goal_weed.wav',
      },
    ],
  },
  {
    // L3: per-goal habit-pick opener. Resolves by the goal picked (Alcohol).
    // Count-agnostic wording ("a habit or two") serves one-goal and two-goal alike.
    id: 'habits-alcohol',
    name: 'Habits (Alcohol)',
    order: 44,
    path: 'beginner',
    type: 'habit-picker',
    variantOf: 'habits',
    screenId: 'ONBOARD-BEGINNER-03--ALCOHOL',
    allowedTools: 'add_habit, remove_habit, advance_step',
    expectedResponse: 'Picks habits: one per goal if two goals, one or two if one goal',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      goal: 'Alcohol',
    },
    elements: ['createOwn'],
    script: [
      {
        seq: 1,
        words: "To cut back on alcohol, let's pick a habit or two you'll actually keep.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-03--ALCOHOL',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_03_goal_alcohol',
        clipPath: '/voice/ob/onboard_beginner_03_goal_alcohol.wav',
      },
    ],
  },
  {
    // L3: per-goal habit-pick opener. Resolves by the goal picked (Porn).
    // Count-agnostic wording ("a habit or two") serves one-goal and two-goal alike.
    id: 'habits-porn',
    name: 'Habits (Porn)',
    order: 45,
    path: 'beginner',
    type: 'habit-picker',
    variantOf: 'habits',
    screenId: 'ONBOARD-BEGINNER-03--PORN',
    allowedTools: 'add_habit, remove_habit, advance_step',
    expectedResponse: 'Picks habits: one per goal if two goals, one or two if one goal',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      goal: 'Porn',
    },
    elements: ['createOwn'],
    script: [
      {
        seq: 1,
        words: "To cut back on porn, let's pick a habit or two you'll actually keep.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-03--PORN',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_03_goal_porn',
        clipPath: '/voice/ob/onboard_beginner_03_goal_porn.wav',
      },
    ],
  },
  {
    // L3: per-goal habit-pick opener. Resolves by the goal picked (Phone use).
    // Count-agnostic wording ("a habit or two") serves one-goal and two-goal alike.
    id: 'habits-phone-use',
    name: 'Habits (Phone use)',
    order: 46,
    path: 'beginner',
    type: 'habit-picker',
    variantOf: 'habits',
    screenId: 'ONBOARD-BEGINNER-03--PHONE-USE',
    allowedTools: 'add_habit, remove_habit, advance_step',
    expectedResponse: 'Picks habits: one per goal if two goals, one or two if one goal',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      goal: 'Phone use',
    },
    elements: ['createOwn'],
    script: [
      {
        seq: 1,
        words: "To cut back on phone use, let's pick a habit or two you'll actually keep.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-03--PHONE-USE',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_03_goal_phone_use',
        clipPath: '/voice/ob/onboard_beginner_03_goal_phone_use.wav',
      },
    ],
  },
  {
    // L3: per-goal habit-pick opener. Resolves by the goal picked (Late-night snacking).
    // Count-agnostic wording ("a habit or two") serves one-goal and two-goal alike.
    id: 'habits-late-snacking',
    name: 'Habits (Late-night snacking)',
    order: 47,
    path: 'beginner',
    type: 'habit-picker',
    variantOf: 'habits',
    screenId: 'ONBOARD-BEGINNER-03--LATE-SNACKING',
    allowedTools: 'add_habit, remove_habit, advance_step',
    expectedResponse: 'Picks habits: one per goal if two goals, one or two if one goal',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      goal: 'Late-night snacking',
    },
    elements: ['createOwn'],
    script: [
      {
        seq: 1,
        words:
          "To cut back on late-night snacking, let's pick a habit or two you'll actually keep.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-03--LATE-SNACKING',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_03_goal_late_snacking',
        clipPath: '/voice/ob/onboard_beginner_03_goal_late_snacking.wav',
      },
    ],
  },
  {
    // L3: per-goal habit-pick opener. Resolves by the goal picked (Caffeine).
    // Count-agnostic wording ("a habit or two") serves one-goal and two-goal alike.
    id: 'habits-caffeine',
    name: 'Habits (Caffeine)',
    order: 48,
    path: 'beginner',
    type: 'habit-picker',
    variantOf: 'habits',
    screenId: 'ONBOARD-BEGINNER-03--CAFFEINE',
    allowedTools: 'add_habit, remove_habit, advance_step',
    expectedResponse: 'Picks habits: one per goal if two goals, one or two if one goal',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      goal: 'Caffeine',
    },
    elements: ['createOwn'],
    script: [
      {
        seq: 1,
        words: "To cut back on caffeine, let's pick a habit or two you'll actually keep.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-03--CAFFEINE',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_03_goal_caffeine',
        clipPath: '/voice/ob/onboard_beginner_03_goal_caffeine.wav',
      },
    ],
  },
  {
    // L3: per-goal habit-pick opener. Resolves by the goal picked (Stay on top of tasks).
    // Count-agnostic wording ("a habit or two") serves one-goal and two-goal alike.
    id: 'habits-stay-on-tasks',
    name: 'Habits (Stay on top of tasks)',
    order: 49,
    path: 'beginner',
    type: 'habit-picker',
    variantOf: 'habits',
    screenId: 'ONBOARD-BEGINNER-03--STAY-ON-TASKS',
    allowedTools: 'add_habit, remove_habit, advance_step',
    expectedResponse: 'Picks habits: one per goal if two goals, one or two if one goal',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      goal: 'Stay on top of tasks',
    },
    elements: ['createOwn'],
    script: [
      {
        seq: 1,
        words: "To stay on top of your tasks, let's pick a habit or two you'll actually keep.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-03--STAY-ON-TASKS',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_03_goal_stay_on_tasks',
        clipPath: '/voice/ob/onboard_beginner_03_goal_stay_on_tasks.wav',
      },
    ],
  },
  {
    // L3: per-goal habit-pick opener. Resolves by the goal picked (Keep spaces tidy).
    // Count-agnostic wording ("a habit or two") serves one-goal and two-goal alike.
    id: 'habits-tidy-spaces',
    name: 'Habits (Keep spaces tidy)',
    order: 50,
    path: 'beginner',
    type: 'habit-picker',
    variantOf: 'habits',
    screenId: 'ONBOARD-BEGINNER-03--TIDY-SPACES',
    allowedTools: 'add_habit, remove_habit, advance_step',
    expectedResponse: 'Picks habits: one per goal if two goals, one or two if one goal',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      goal: 'Keep spaces tidy',
    },
    elements: ['createOwn'],
    script: [
      {
        seq: 1,
        words: "To keep your spaces tidy, let's pick a habit or two you'll actually keep.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-03--TIDY-SPACES',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_03_goal_tidy_spaces',
        clipPath: '/voice/ob/onboard_beginner_03_goal_tidy_spaces.wav',
      },
    ],
  },
  {
    // L3: per-goal habit-pick opener. Resolves by the goal picked (Handle life admin better).
    // Count-agnostic wording ("a habit or two") serves one-goal and two-goal alike.
    id: 'habits-life-admin',
    name: 'Habits (Handle life admin better)',
    order: 51,
    path: 'beginner',
    type: 'habit-picker',
    variantOf: 'habits',
    screenId: 'ONBOARD-BEGINNER-03--LIFE-ADMIN',
    allowedTools: 'add_habit, remove_habit, advance_step',
    expectedResponse: 'Picks habits: one per goal if two goals, one or two if one goal',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      goal: 'Handle life admin better',
    },
    elements: ['createOwn'],
    script: [
      {
        seq: 1,
        words: "To handle life admin better, let's pick a habit or two you'll actually keep.",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-03--LIFE-ADMIN',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_03_goal_life_admin',
        clipPath: '/voice/ob/onboard_beginner_03_goal_life_admin.wav',
      },
    ],
  },
  {
    id: 'habit-custom',
    name: 'Create your own habit',
    order: 52,
    path: 'beginner',
    type: 'custom-entry',
    screenId: 'ONBOARD-BEGINNER-03-CUSTOM',
    context: null,
    allowedTools: 'add_habit, advance_step',
    expectedResponse: 'Names their own habit',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      kind: 'habit',
    },
    // Archetype = single free-entry data beat (one spoken prompt, the user names their
    // own habit in the text input). conversation is { na } (a single capture, no branch);
    // Custom habits use the same canonical add_habit contract as picker selections.
    bible: {
      sectionManifest: {
        identity: 'filled',
        scriptMeta: 'filled',
        components: 'filled',
        voice: 'filled',
        rulesContext: 'filled',
        rulesCode: 'filled',
        conversation: { na: 'single free-entry — the user names one habit; no branching turn' },
        contextProse: 'filled',
        allowedTools: 'filled',
        persistence: 'filled',
        flow: 'filled',
        edges: 'filled',
        acceptance: 'filled',
        applicableDecisions: 'filled',
      },
      identity: {
        rows: [
          { label: 'beatId (canonical)', value: 'habit-custom' },
          { label: 'name', value: 'Create your own habit' },
          { label: 'order', value: '52' },
          { label: 'path', value: 'beginner' },
          { label: 'type', value: 'custom-entry' },
        ],
        aliases: [
          { surface: 'screenId', value: 'ONBOARD-BEGINNER-03-CUSTOM' },
          { surface: 'route', value: '/onboarding/beginner-03-custom' },
          { surface: 'persisted current_step', value: 'habit-custom' },
          { surface: 'session_log value', value: 'habit-custom' },
          { surface: 'data-beat-id', value: 'habit-custom' },
        ],
        enforcedBy: ['id-alias-check'],
      },
      scriptMeta: {
        rows: [
          {
            seq: 1,
            reveal:
              'opener prompt on entry alongside the text input; no gate (the one spoken line)',
            timing: 'karaoke per-word on the prompt',
          },
        ],
        enforcedBy: ['render-link-integrity-check', 'reveal-timing-check'],
      },
      components: {
        rows: [
          { label: 'component (registry key)', value: 'custom-entry' },
          { label: 'kind', value: 'habit (from source props.kind)' },
          { label: 'on-screen', value: 'a single text input for the user to name their own habit' },
          { label: 'selection mode', value: 'free text entry; nothing preselected' },
        ],
        watchOut:
          'Reached from the create-your-own habit tile; the user types a habit in their own words. The 2-habit cap (decision 4/5) is enforced at the add_habit handler, not here.',
        enforcedBy: ['component-registry-check'],
      },
      voice: {
        rows: [
          { label: 'engine', value: 'MP3' },
          { label: 'mode', value: 'Verbatim (enum is Verbatim / Generative)' },
        ],
        perLine: [
          { seq: 1, resolvesTo: 'recorded clip onboard_beginner_03_custom_1', liveAllowed: 'NO' },
        ],
        assertion:
          'The prompt carries no live slot like {name}, so it MUST resolve to the recorded clip onboard_beginner_03_custom_1. No live Cartesia on this beat.',
        enforcedBy: ['audio-ownership-check'],
      },
      rulesContext: [
        {
          id: 'habitcustom-verbatim-opener',
          rule: 'Speaks the prompt verbatim, then waits for the user to name their habit',
          severity: 'must',
          enforcedBy: ['eval:verbatim-opener'],
        },
        {
          id: 'habitcustom-capture-their-words',
          rule: 'Captures the habit in the user own words; never rewords or reframes it',
          severity: 'must',
          enforcedBy: ['eval:one-line-then-wait'],
        },
        {
          id: 'habitcustom-no-platitudes',
          rule: 'No praise or commentary on the habit they name; take it and move on',
          severity: 'must',
          enforcedBy: ['eval:no-platitudes'],
        },
      ],
      rulesCode: [
        {
          id: 'habitcustom-audio-ownership',
          rule: 'The prompt resolves to a recorded clip; no live Cartesia (no {name} slot)',
          severity: 'must',
          enforcedBy: ['audio-ownership-check'],
        },
        {
          id: 'habitcustom-clip-resolves',
          rule: 'onboard_beginner_03_custom_1 resolves to a real asset',
          severity: 'must',
          enforcedBy: ['render-link-integrity-check'],
        },
        {
          id: 'habitcustom-id-alias',
          rule: 'beatId maps to the screenId / route / step / session_log / data-beat-id in identity',
          severity: 'must',
          enforcedBy: ['id-alias-check'],
        },
      ],
      contextProse: {
        prose:
          'Create your own habit. Reached from the create-your-own habit tile. Speak the prompt, then let the user name their own habit in the text input, in their own words. Capture it verbatim, add no praise, and move on to setting the days.',
        enforcedBy: ['eval:parity-walk'],
      },
      allowedTools: {
        tools: ['add_habit', 'advance_step'],
        callRules:
          'Call add_habit with the verbatim custom name, then advance once the cap still permits it.',
        specs: [
          {
            tool: 'add_habit',
            args: '{ name: string (1-100 characters) }',
            when: 'once the user submits a non-empty custom habit within the total cap of two',
          },
          { tool: 'advance_step', args: '{}', when: 'immediately after add_habit succeeds' },
        ],
        note: 'Defaults are supplied by add_habit. The custom name persists without canonical-list matching.',
        enforcedBy: ['tool-contract-check'],
      },
      persistence: {
        rows: [
          {
            label: 'writes',
            value:
              'onboarding_states.data.habitConfigs entry for the custom onboarding.habits collection, keyed by custom habit name with add_habit defaults',
          },
          {
            label: 'never re-ask',
            value: 'the later schedule reads and patches the same habitConfigs entry by name',
          },
          {
            label: 'resume key',
            value: 'onboarding_states.data.habitConfigs, plus current_step past habit-custom',
          },
        ],
        watchOut:
          'Source: api/_lib/llm/onboarding/schemas.ts and flowBible.ts Table 3. TODO app migration only if either lane does not yet expose add_habit on this screen.',
        enforcedBy: ['persistence-contract-check'],
      },
      flow: {
        rows: [
          { label: 'advance condition', value: 'the user submits a non-empty custom habit' },
          {
            label: 'upstream branch (into this beat)',
            value: 'the create-your-own habit tile routes here',
          },
          {
            label: 'downstream branch (out of this beat)',
            value: 'proceeds to the habit schedule (set the days)',
          },
          {
            label: 'gate',
            value:
              'a non-empty habit must be entered before advancing (subject to the 2-habit cap)',
          },
        ],
        enforcedBy: ['advance-gate-check'],
      },
      edges: {
        rows: [
          {
            edge: 'empty submission',
            behavior: 'do not advance on an empty entry; wait for the user to name a habit',
          },
          {
            edge: 'cap reached',
            behavior:
              'the 2-habit cap (decision 4/5) is enforced at the add_habit handler; the render surfaces the cap',
          },
          {
            edge: 'save contract',
            behavior:
              'add_habit saves the custom name with defaults, enforces the total cap, and must succeed before this beat advances',
          },
        ],
        enforcedBy: ['eval:edge-walk'],
      },
      acceptance: {
        rows: [
          {
            criterion: 'shows the right thing',
            check: 'phone renders a single text input for the custom habit, nothing preselected',
          },
          {
            criterion: 'says the right thing',
            check: 'the prompt plays verbatim from onboard_beginner_03_custom_1',
          },
          {
            criterion: 'advances correctly',
            check:
              'a non-empty custom habit is captured (within the 2-habit cap), then the flow proceeds to the schedule',
          },
        ],
        enforcedBy: ['component-registry-check', 'render-link-integrity-check', 'eval:edge-walk'],
      },
      applicableDecisions: {
        rows: [
          {
            decision: '4/5 (habit caps: max 2 habits)',
            binds: false,
            how: 'a custom habit counts against the 2-habit cap, but the cap is enforced at the add_habit handler, not by a rule on this render beat; the render only surfaces the cap',
          },
          {
            decision: '1, 2 (profile gates), 3 (women-art), 6, 7 (reflection)',
            binds: false,
            how: 'not this beat',
          },
        ],
        enforcedBy: ['decisions-coverage-check'],
      },
    },
    script: [
      {
        seq: 1,
        words: 'What habit do you want to build?',
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-BEGINNER-03-CUSTOM',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_03_custom_1',
        clipPath: '/voice/ob/onboard_beginner_03_custom_1.wav',
      },
    ],
    io: {
      dataIn: [{ key: 'onboarding.goals', from: 'flow-state', writtenBy: 'submit_goals' }],
      dataOut: [
        {
          key: 'onboarding.habits',
          from: 'flow-state',
          writtenBy: 'add_habit / remove_habit',
          persistsTo: 'onboarding_states.data.habitConfigs',
          note: 'later update_habit patches this same configuration by name',
        },
      ],
    },
  },
  {
    id: 'schedule',
    name: 'Habit schedule',
    order: 53,
    path: 'beginner',
    type: 'habit-schedule',
    screenId: 'ONBOARD-BEGINNER-04',
    allowedTools: 'add_habit, update_habit, advance_step',
    expectedResponse: 'Sets the days per habit',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: null,
    // Archetype = interactive data-gate (card-fill day pickers). The coach frames it,
    // then all picked habits show as cards with day pickers; reminders OFF by default.
    // conversation is { na } (per-habit card fill, no branching); allowedTools is
    // owner-filled; persistence is pending-app-reconcile (writes go "per handler").
    bible: {
      sectionManifest: {
        identity: 'filled',
        scriptMeta: 'filled',
        components: 'filled',
        voice: 'filled',
        rulesContext: 'filled',
        rulesCode: 'filled',
        conversation: {
          na: 'card-fill day pickers — the coach frames it once; each habit card day picker is filled directly, no branching turn',
        },
        contextProse: 'filled',
        allowedTools: 'filled',
        persistence: 'filled',
        flow: 'filled',
        edges: 'filled',
        acceptance: 'filled',
        applicableDecisions: 'filled',
      },
      identity: {
        rows: [
          { label: 'beatId (canonical)', value: 'schedule' },
          { label: 'name', value: 'Habit schedule' },
          { label: 'order', value: '53' },
          { label: 'path', value: 'beginner' },
          { label: 'type', value: 'habit-schedule' },
        ],
        aliases: [
          { surface: 'screenId', value: 'ONBOARD-BEGINNER-04' },
          { surface: 'route', value: '/onboarding/beginner-04' },
          { surface: 'persisted current_step', value: 'schedule' },
          { surface: 'session_log value', value: 'schedule' },
          { surface: 'data-beat-id', value: 'schedule' },
        ],
        enforcedBy: ['id-alias-check'],
      },
      scriptMeta: {
        rows: [
          {
            seq: 1,
            reveal: 'first framing bubble on entry; no gate (first spoken line)',
            timing: 'karaoke per-word on the bubble',
          },
          {
            seq: 2,
            reveal: 'second framing bubble, GATED on seq 1 clip end',
            timing: 'karaoke per-word on the bubble',
          },
          {
            seq: 3,
            reveal: 'all picked habit cards with their day pickers bloom, GATED on seq 2 clip end',
            timing: 'n/a (silent reveal)',
          },
        ],
        enforcedBy: ['render-link-integrity-check', 'reveal-timing-check'],
      },
      components: {
        rows: [
          { label: 'component (registry key)', value: 'habit-schedule' },
          {
            label: 'on-screen cards',
            value:
              'one card per picked habit, each with a day picker (frequency); per-habit reminders OFF by default',
          },
          {
            label: 'selection mode',
            value: 'days set per habit; the weekday preset by locale is offered, nothing forced',
          },
          {
            label: 'exact state',
            value:
              'the daily check-in and the evening reflection are NOT shown here (they are rituals, not habits)',
          },
        ],
        watchOut:
          'Per-habit reminders default OFF (on only if the user asks). Never include the check-in or the reflection as habits here.',
        enforcedBy: ['component-registry-check'],
      },
      voice: {
        rows: [
          { label: 'engine', value: 'MP3' },
          { label: 'mode', value: 'Verbatim (enum is Verbatim / Generative)' },
        ],
        perLine: [
          { seq: 1, resolvesTo: 'recorded clip onboard_beginner_04_1', liveAllowed: 'NO' },
          { seq: 2, resolvesTo: 'recorded clip onboard_beginner_04_2', liveAllowed: 'NO' },
          { seq: 3, resolvesTo: 'silent reveal (no audio)', liveAllowed: 'n/a' },
        ],
        assertion:
          'No line here carries a live slot like {name}, so both spoken lines MUST resolve to recorded clips; the cards reveal silently. No live Cartesia on this beat.',
        enforcedBy: ['audio-ownership-check'],
      },
      rulesContext: [
        {
          id: 'schedule-verbatim-opener',
          rule: 'Speaks the two framing lines verbatim, no improvised lead-in',
          severity: 'must',
          enforcedBy: ['eval:verbatim-opener'],
        },
        {
          id: 'schedule-recommend-weekdays',
          rule: 'Recommends weekdays to start; never insists every habit must be daily',
          severity: 'must',
          enforcedBy: ['eval:one-line-then-wait'],
        },
        {
          id: 'schedule-no-reask',
          rule: 'Never re-asks a piece the user already gave; never adds the check-in or reflection as a habit',
          severity: 'must',
          enforcedBy: ['eval:carry-forward'],
        },
      ],
      rulesCode: [
        {
          id: 'schedule-tools-only',
          rule: 'Only add_habit, update_habit, and advance_step are callable on this beat',
          severity: 'must',
          enforcedBy: ['tool-contract-check'],
        },
        {
          id: 'schedule-advance-on-days',
          rule: 'advance_step fires only after each habit has its days set',
          severity: 'must',
          enforcedBy: ['advance-gate-check'],
        },
        {
          id: 'schedule-reminders-off',
          rule: 'Per-habit reminders stay OFF unless the user asks; never turn one on unprompted',
          severity: 'must',
          enforcedBy: ['component-registry-check'],
        },
        {
          id: 'schedule-reveal-gates',
          rule: 'the habit cards reveal gates on the prior line clip end, never a fixed timer',
          severity: 'must',
          enforcedBy: ['reveal-timing-check'],
        },
        {
          id: 'schedule-audio-ownership',
          rule: 'Every spoken line resolves to a recorded clip; no live Cartesia (no {name} slot)',
          severity: 'must',
          enforcedBy: ['audio-ownership-check'],
        },
        {
          id: 'schedule-id-alias',
          rule: 'beatId maps to the screenId / route / step / session_log / data-beat-id in identity',
          severity: 'must',
          enforcedBy: ['id-alias-check'],
        },
      ],
      contextProse: {
        prose:
          'Habit schedule. Shows all the habits the user just picked, each as its own card with the habit name and its day picker. The daily check-in and the evening reflection are NOT here (rituals, not habits). For each habit, set which days; recommend weekdays to start. Days default to the weekday preset by locale. Per-habit reminders are OFF by default, on only if the user asks. Never turn a reminder on unless they ask, never re-ask a piece already given, and never include the check-in or reflection as habits.',
        enforcedBy: ['eval:parity-walk'],
      },
      allowedTools: {
        tools: ['add_habit', 'update_habit', 'advance_step'],
        callRules:
          'Inherited from GLOBAL_CONTEXT, bound here: update_habit to set days on an existing habit, add_habit only if needed; only this beat tools.',
        specs: [
          {
            tool: 'update_habit',
            args: '{ name: string, days: (0 | 1 | 2 | 3 | 4 | 5 | 6)[], reminder?: boolean, time?: "HH:MM", schedule?: "Weekday" | "Weekend" | "Every day" | "Custom" }',
            when: 'to set the days (and optionally a reminder) on a picked habit',
          },
          {
            tool: 'add_habit',
            args: '{ name: string, days?: (0 | 1 | 2 | 3 | 4 | 5 | 6)[], reminder?: boolean, time?: "HH:MM", schedule?: "Weekday" | "Weekend" | "Every day" | "Custom" }',
            when: 'only if a habit needs adding here',
          },
          { tool: 'advance_step', args: '{}', when: 'once every habit has its days set' },
        ],
        note: 'Days are numeric 0-6 values, name identifies the existing configuration, and omitted update fields are preserved.',
        enforcedBy: ['tool-contract-check'],
      },
      persistence: {
        rows: [
          {
            label: 'writes',
            value:
              'update_habit patches the onboarding.habits collection at onboarding_states.data.habitConfigs[name] with days, time, reminder, and schedule; omitted fields remain unchanged',
          },
          {
            label: 'never re-ask',
            value:
              'the plan and resume read the same habitConfigs collection after each per-habit schedule save',
          },
          {
            label: 'resume key',
            value: 'onboarding_states.data.habitConfigs, plus current_step past schedule',
          },
        ],
        watchOut:
          'AUTHORITATIVE RENDER CONTRACT. TODO app migration: replace habitId/string-days payloads with name/numeric-days in any schedule client or lane that still uses the old shape. Source: api/_lib/llm/onboarding/schemas.ts.',
        enforcedBy: ['persistence-contract-check'],
      },
      flow: {
        rows: [
          {
            label: 'advance condition',
            value: 'every picked habit has its days set (via update_habit), then advance_step',
          },
          {
            label: 'upstream branch (into this beat)',
            value: 'the habits picker (or the custom habit) routes here',
          },
          {
            label: 'downstream branch (out of this beat)',
            value: 'proceeds to the plan confirm',
          },
          { label: 'gate', value: 'each habit needs days set before advancing' },
        ],
        enforcedBy: ['advance-gate-check'],
      },
      edges: {
        rows: [
          {
            edge: 'tool failure',
            behavior:
              'update_habit errors: retry once quietly. If it still fails, SURFACE it, never fail silently, and do not advance. Tap/text path: a toast "Couldn\'t save that, tap to retry" with the days retained. Voice path: one short coach line "That didn\'t go through, let me try again."',
            voice: 'clip-family:onboard_beginner_04_edge_1 (pending recording)',
          },
          {
            edge: 'a habit left with no days',
            behavior: 'prompt once for that habit days; do not advance until every habit has days',
          },
          {
            edge: 'asks for a reminder',
            behavior: 'turn the per-habit reminder on for that habit; otherwise reminders stay OFF',
          },
        ],
        enforcedBy: ['eval:edge-walk'],
      },
      acceptance: {
        rows: [
          {
            criterion: 'shows the right thing',
            check:
              'phone renders one card per picked habit with a day picker; no check-in or reflection card appears here',
          },
          {
            criterion: 'says the right thing',
            check: 'the two framing lines play verbatim; weekdays recommended, not forced',
          },
          {
            criterion: 'advances correctly',
            check: 'each habit days set via update_habit, then advance_step',
          },
        ],
        enforcedBy: ['component-registry-check', 'render-link-integrity-check', 'eval:edge-walk'],
      },
      applicableDecisions: {
        rows: [
          {
            decision: '4/5 (habit caps: max 2 habits)',
            binds: false,
            how: 'the cap is applied when habits are picked, not here; this beat only sets days on the already-capped set',
          },
          {
            decision: '1, 2 (profile gates), 3 (women-art), 6, 7 (reflection)',
            binds: false,
            how: 'not this beat',
          },
        ],
        enforcedBy: ['decisions-coverage-check'],
      },
    },
    script: [
      {
        seq: 1,
        words: "Please set the days that you're going to actually do these habits.",
        bindsTo: {
          kind: 'bubble',
          element: 'bubble-1',
          screen: 'ONBOARD-BEGINNER-04',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_04_1',
        clipPath: '/voice/ob/onboard_beginner_04_1.wav',
      },
      {
        seq: 2,
        words:
          'Not every habit needs to be done every day. Three specific days in the week is great as well. Once a week for specific habits, also great.',
        bindsTo: {
          kind: 'bubble',
          element: 'bubble-2',
          screen: 'ONBOARD-BEGINNER-04',
        },
        voice: 'mp3',
        clip: 'onboard_beginner_04_2',
        clipPath: '/voice/ob/onboard_beginner_04_2.wav',
      },
      {
        seq: 3,
        words: '',
        bindsTo: {
          kind: 'component',
          element: 'reveal-99',
          screen: 'ONBOARD-BEGINNER-04',
        },
        voice: 'mp3',
        clip: null,
        clipPath: null,
      },
    ],
    io: {
      dataIn: [{ key: 'onboarding.habits', from: 'flow-state' }],
      dataOut: [
        {
          key: 'onboarding.habits',
          from: 'flow-state',
          writtenBy: 'update_habit / add_habit',
          persistsTo: 'onboarding_states.data.habitConfigs',
          note: 'adds days per habit',
        },
      ],
    },
  },
  {
    id: 'advanced-capture',
    name: 'Advanced capture',
    order: 54,
    path: 'advanced',
    type: 'advanced-capture',
    screenId: 'ONBOARD-ADVANCED',
    allowedTools: 'submit_brain_dump, advance_step',
    expectedResponse: 'Reads or types their habits',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: null,
    // Archetype = multi-turn conversation (brain dump). The user reads or types their
    // existing habits; cards form live, each auto-marked build or break for display. The
    // persistence boundary remains the verbatim source transcript, not parsed cards.
    bible: {
      sectionManifest: {
        identity: 'filled',
        scriptMeta: 'filled',
        components: 'filled',
        voice: 'filled',
        rulesContext: 'filled',
        rulesCode: 'filled',
        conversation: 'filled',
        contextProse: 'filled',
        allowedTools: 'filled',
        persistence: 'filled',
        flow: 'filled',
        edges: 'filled',
        acceptance: 'filled',
        applicableDecisions: 'filled',
      },
      identity: {
        rows: [
          { label: 'beatId (canonical)', value: 'advanced-capture' },
          { label: 'name', value: 'Advanced capture' },
          { label: 'order', value: '54' },
          { label: 'path', value: 'advanced' },
          { label: 'type', value: 'advanced-capture' },
        ],
        aliases: [
          { surface: 'screenId', value: 'ONBOARD-ADVANCED' },
          { surface: 'route', value: '/onboarding/advanced' },
          { surface: 'persisted current_step', value: 'advanced-capture' },
          { surface: 'session_log value', value: 'advanced-capture' },
          { surface: 'data-beat-id', value: 'advanced-capture' },
        ],
        enforcedBy: ['id-alias-check'],
      },
      scriptMeta: {
        rows: [
          {
            seq: 1,
            reveal: 'opener bubble on entry; no gate (first spoken line)',
            timing: 'karaoke per-word on the bubble',
          },
          {
            seq: 2,
            reveal:
              'habit cards form live as the user reads them, each auto-marked build or break, GATED on seq 1 clip end',
            timing: 'n/a (silent, cards form as the user speaks)',
          },
          {
            seq: 3,
            reveal: 'the close/confirm bubble, GATED on seq 2 reveal',
            timing: 'karaoke per-word on the bubble',
          },
        ],
        enforcedBy: ['render-link-integrity-check', 'reveal-timing-check'],
      },
      components: {
        rows: [
          { label: 'component (registry key)', value: 'advanced-capture' },
          {
            label: 'on-screen cards',
            value:
              'habit cards forming live as the user reads or types; each card auto-marked build or break',
          },
          {
            label: 'selection mode',
            value: 'free capture; avoidance wording reads as break, everything else as build',
          },
          {
            label: 'exact state',
            value:
              'nothing preselected; the coach does not ask build or break per habit (the cards already mark it)',
          },
        ],
        watchOut:
          'The coach never asks build or break per habit; the card marks it. Capture verbatim, do not reorganize as the user talks.',
        enforcedBy: ['component-registry-check'],
      },
      voice: {
        rows: [
          { label: 'engine', value: 'MP3' },
          { label: 'mode', value: 'Verbatim (enum is Verbatim / Generative)' },
        ],
        perLine: [
          { seq: 1, resolvesTo: 'recorded clip onboard_advanced_1', liveAllowed: 'NO' },
          { seq: 2, resolvesTo: 'silent reveal (no audio)', liveAllowed: 'n/a' },
          { seq: 3, resolvesTo: 'recorded clip close', liveAllowed: 'NO' },
        ],
        assertion:
          'No line here carries a live slot like {name}, so both spoken lines MUST resolve to recorded clips; the cards form silently. No live Cartesia on this beat.',
        enforcedBy: ['audio-ownership-check'],
      },
      rulesContext: [
        {
          id: 'advcap-verbatim-opener',
          rule: 'Speaks the opener and the close line verbatim, no improvised lead-in',
          severity: 'must',
          enforcedBy: ['eval:verbatim-opener'],
        },
        {
          id: 'advcap-no-build-break-ask',
          rule: 'Never asks build or break per habit; the cards already mark it',
          severity: 'must',
          enforcedBy: ['eval:one-line-then-wait'],
        },
        {
          id: 'advcap-capture-verbatim',
          rule: 'Captures verbatim; never rewords or reorganizes what the user said',
          severity: 'must',
          enforcedBy: ['eval:carry-forward'],
        },
        {
          id: 'advcap-less-is-more',
          rule: 'Never pushes for more; less is more, they can build on it later',
          severity: 'must',
          enforcedBy: ['eval:no-platitudes'],
        },
        {
          id: 'advcap-confirm-once',
          rule: 'Names the build and break read once over the whole set and asks for a single yes',
          severity: 'must',
          enforcedBy: ['eval:one-line-then-wait'],
        },
      ],
      rulesCode: [
        {
          id: 'advcap-tools-only',
          rule: 'Only submit_brain_dump and advance_step are callable on this beat',
          severity: 'must',
          enforcedBy: ['tool-contract-check'],
        },
        {
          id: 'advcap-advance-on-tool',
          rule: 'advance_step fires only after submit_brain_dump captured the confirmed set',
          severity: 'must',
          enforcedBy: ['advance-gate-check'],
        },
        {
          id: 'advcap-reveal-gates',
          rule: 'the cards and the close bubble gate on the prior line clip end, never a fixed timer',
          severity: 'must',
          enforcedBy: ['reveal-timing-check'],
        },
        {
          id: 'advcap-audio-ownership',
          rule: 'Every spoken line resolves to a recorded clip; no live Cartesia (no {name} slot)',
          severity: 'must',
          enforcedBy: ['audio-ownership-check'],
        },
        {
          id: 'advcap-id-alias',
          rule: 'beatId maps to the screenId / route / step / session_log / data-beat-id in identity',
          severity: 'must',
          enforcedBy: ['id-alias-check'],
        },
      ],
      conversation: {
        opens: 'after the opener (read me the list of habits you already track)',
        branches: [
          {
            on: 'reads or types their habits',
            reply: 'none (silent); each habit forms a card, auto-marked build or break',
            then: 'tool:submit_brain_dump',
          },
          {
            on: 'flags a card as wrong (build/break or wording)',
            reply: 'scripted: fix that one card only; do not reorganize or reword the rest',
            then: 'wait',
            voice: 'clip-family:onboard_advanced_fix_one (pending recording)',
          },
          {
            on: 'confirms the set is good',
            reply: 'none (silent); proceed to set the days next',
            then: 'advance',
          },
          {
            on: 'off-topic or world question',
            reply:
              'global rule glob-out-of-scope: one brief acknowledgement, steer back to the habit list',
            then: 'wait',
            voice: 'clip-family:onboard_offtopic (pending recording)',
          },
        ],
        maxTurns: 6,
        onMaxTurns: 'name the build/break read once over the whole set and ask for a single yes',
      },
      contextProse: {
        prose:
          'Advanced capture. The user already has habits. Let them read or type them all, in their own words. Each one forms on screen as a card, auto-marked build or break (avoidance wording reads as break, everything else as build). Do NOT ask build or break per habit. Capture verbatim, do not reorganize as they talk. Less is more, especially at the start, they can build on it later. When they finish, name the build and break read once over the whole set and ask for a single yes. If they flag one as wrong, fix that one. Then the days get set on the next beat.',
        enforcedBy: ['eval:parity-walk'],
      },
      allowedTools: {
        tools: ['submit_brain_dump', 'advance_step'],
        callRules:
          'Inherited from GLOBAL_CONTEXT, bound here: submit_brain_dump with the full verbatim transcript once the user confirms; parsed cards are display-only derived state.',
        specs: [
          {
            tool: 'submit_brain_dump',
            args: '{ brain_dump_raw: string (10-5000 characters) } (the full verbatim transcript, never a summary or structured card set)',
            when: 'once the user confirms the read set',
          },
          { tool: 'advance_step', args: '{}', when: 'immediately after submit_brain_dump returns' },
        ],
        note: 'Build/break polarity belongs only to the rendered derived cards; it is not part of the persistence payload.',
        enforcedBy: ['tool-contract-check'],
      },
      persistence: {
        rows: [
          {
            label: 'writes',
            value:
              'onboarding_states.data.brainDumpText and onboarding_states.brain_dump_raw both hold the same verbatim brain_dump_raw transcript',
          },
          {
            label: 'never re-ask',
            value:
              'the transcript rehydrates advanced capture and its derived cards; the coach never summarizes or re-collects it',
          },
          {
            label: 'resume key',
            value:
              'onboarding_states.data.brainDumpText + onboarding_states.brain_dump_raw, plus current_step past advanced-capture',
          },
        ],
        watchOut:
          'AUTHORITATIVE RENDER CONTRACT. TODO app migration: any client or lane sending structured habits must send the raw transcript instead; derive cards and build/break polarity after persistence. Source: api/_lib/llm/onboarding/handlers/submitBrainDump.ts.',
        enforcedBy: ['persistence-contract-check'],
      },
      flow: {
        rows: [
          {
            label: 'advance condition',
            value: 'submit_brain_dump captured the confirmed set, then advance_step',
          },
          {
            label: 'upstream branch (into this beat)',
            value: 'the fork advanced choice routes here',
          },
          {
            label: 'downstream branch (out of this beat)',
            value: 'proceeds to advanced-frequency (order 55) to set the days',
          },
          { label: 'gate', value: 'the user confirms the read set before advancing' },
        ],
        enforcedBy: ['advance-gate-check'],
      },
      edges: {
        rows: [
          {
            edge: 'tool failure',
            behavior:
              'submit_brain_dump errors: retry once quietly. If it still fails, SURFACE it, never fail silently, and do not advance. Tap/text path: a toast "Couldn\'t save that, tap to retry" with the cards retained. Voice path: one short coach line "That didn\'t go through, let me try again."',
            voice: 'clip-family:onboard_advanced_edge_1 (pending recording)',
          },
          {
            edge: 'flags a card wrong',
            behavior: 'fix that one card only; never reorganize or reword the rest',
          },
          {
            edge: 'user reports something heavy',
            behavior:
              'if the user shares something hard, drop the capture, be human first, and do not rush them back (global glob-crisis)',
          },
        ],
        enforcedBy: ['eval:edge-walk'],
      },
      acceptance: {
        rows: [
          {
            criterion: 'shows the right thing',
            check:
              'phone renders habit cards forming live, each auto-marked build or break; nothing preselected',
          },
          {
            criterion: 'says the right thing',
            check:
              'opener and close play verbatim; the coach never asks build or break per habit (rules.context evals)',
          },
          {
            criterion: 'advances correctly',
            check: 'the confirmed set captured via submit_brain_dump, then advance_step',
          },
        ],
        enforcedBy: ['component-registry-check', 'render-link-integrity-check', 'eval:edge-walk'],
      },
      applicableDecisions: {
        rows: [
          {
            decision: '4/5 (habit caps: max 2 habits)',
            binds: false,
            how: 'advanced capture takes the user existing list; the beginner 2-habit cap does not gate this path',
          },
          {
            decision: '1, 2 (profile gates), 3 (women-art), 6, 7 (reflection)',
            binds: false,
            how: 'not this beat',
          },
        ],
        enforcedBy: ['decisions-coverage-check'],
      },
    },
    script: [
      {
        seq: 1,
        words:
          "Read me the habits you already track. We'll pick days next. For now just the list, and I recommend starting small, you can always add more.",
        bindsTo: {
          kind: 'bubble',
          element: 'bubble-1',
          screen: 'ONBOARD-ADVANCED',
        },
        voice: 'mp3',
        clip: 'onboard_advanced_1',
        clipPath: '/voice/ob/onboard_advanced_1.wav',
      },
      {
        seq: 2,
        words: '',
        bindsTo: {
          kind: 'component',
          element: 'reveal-99',
          screen: 'ONBOARD-ADVANCED',
        },
        voice: 'mp3',
        clip: null,
        clipPath: null,
      },
      {
        seq: 3,
        words:
          "Those are all in, and I marked each as build or break. Tell me if any look wrong. If they're good, we'll set the days next.",
        bindsTo: {
          kind: 'bubble',
          element: 'bubble-3',
          screen: 'ONBOARD-ADVANCED',
        },
        voice: 'mp3',
        clip: 'close',
        clipPath: '/voice/ob/close.wav',
      },
    ],
    io: {
      dataIn: [{ key: 'flow.path', from: 'flow-state' }],
      dataOut: [
        {
          key: 'advanced.brainDump',
          from: 'flow-state',
          writtenBy: 'submit_brain_dump',
          persistsTo: 'onboarding_states.data.brainDumpText + onboarding_states.brain_dump_raw',
        },
      ],
    },
  },
  {
    id: 'advanced-frequency',
    name: 'Advanced frequency',
    order: 55,
    path: 'advanced',
    type: 'advanced-frequency',
    screenId: 'ONBOARD-ADVANCED-FREQUENCY',
    allowedTools: 'add_habit, update_habit, advance_step',
    expectedResponse: 'Says the days per habit',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: null,
    // Archetype = interactive data-gate (card-fill day circles) for the advanced path.
    // The day circles grow out of the already-captured habit cards; the coach parses a
    // full frequency answer, asks only for what is missing. conversation is { na }
    // (card-fill, no branching); persistence uses the same habitConfigs contract as
    // the beginner schedule beat.
    bible: {
      sectionManifest: {
        identity: 'filled',
        scriptMeta: 'filled',
        components: 'filled',
        voice: 'filled',
        rulesContext: 'filled',
        rulesCode: 'filled',
        conversation: {
          na: 'card-fill day circles — the coach parses a spoken frequency onto the same cards; the missing-field prompt is generative, no branching turn',
        },
        contextProse: 'filled',
        allowedTools: 'filled',
        persistence: 'filled',
        flow: 'filled',
        edges: 'filled',
        acceptance: 'filled',
        applicableDecisions: 'filled',
      },
      identity: {
        rows: [
          { label: 'beatId (canonical)', value: 'advanced-frequency' },
          { label: 'name', value: 'Advanced frequency' },
          { label: 'order', value: '55' },
          { label: 'path', value: 'advanced' },
          { label: 'type', value: 'advanced-frequency' },
        ],
        aliases: [
          { surface: 'screenId', value: 'ONBOARD-ADVANCED-FREQUENCY' },
          { surface: 'route', value: '/onboarding/advanced-frequency' },
          { surface: 'persisted current_step', value: 'advanced-frequency' },
          { surface: 'session_log value', value: 'advanced-frequency' },
          { surface: 'data-beat-id', value: 'advanced-frequency' },
        ],
        enforcedBy: ['id-alias-check'],
      },
      scriptMeta: {
        rows: [
          {
            seq: 1,
            reveal: 'first framing bubble on entry; no gate (first spoken line)',
            timing: 'karaoke per-word on the bubble',
          },
          {
            seq: 2,
            reveal: 'second framing bubble, GATED on seq 1 clip end',
            timing: 'karaoke per-word on the bubble',
          },
          {
            seq: 3,
            reveal: 'the day circles grow out of the habit cards, GATED on seq 2 clip end',
            timing: 'n/a (silent reveal)',
          },
          {
            seq: 4,
            reveal: 'the plan-ready bubble, GATED on seq 3 reveal',
            timing: 'karaoke per-word on the bubble',
          },
        ],
        enforcedBy: ['render-link-integrity-check', 'reveal-timing-check'],
      },
      components: {
        rows: [
          { label: 'component (registry key)', value: 'advanced-frequency' },
          {
            label: 'on-screen',
            value:
              'the already-captured habit cards, each growing a day-circle picker (frequency); per-habit reminders OFF by default',
          },
          {
            label: 'selection mode',
            value:
              'days set per habit; a full spoken answer is parsed onto the cards, nothing forced',
          },
          {
            label: 'exact state',
            value:
              'the cards are the same ones from advanced-capture; no new cards are created here',
          },
        ],
        watchOut:
          'Per-habit reminders default OFF (on only if the user asks). Parse a full answer when given; ask only for what is missing.',
        enforcedBy: ['component-registry-check'],
      },
      voice: {
        rows: [
          { label: 'engine', value: 'MP3' },
          { label: 'mode', value: 'Verbatim (enum is Verbatim / Generative)' },
        ],
        perLine: [
          {
            seq: 1,
            resolvesTo: 'recorded clip onboard_advanced_frequency_days',
            liveAllowed: 'NO',
          },
          { seq: 2, resolvesTo: 'recorded clip onboard_advanced_frequency_1', liveAllowed: 'NO' },
          { seq: 3, resolvesTo: 'silent reveal (no audio)', liveAllowed: 'n/a' },
          { seq: 4, resolvesTo: 'recorded clip onboard_advanced_frequency_2', liveAllowed: 'NO' },
        ],
        assertion:
          'No line here carries a live slot like {name}, so every spoken line MUST resolve to a recorded clip; the day circles reveal silently. No live Cartesia on this beat.',
        enforcedBy: ['audio-ownership-check'],
      },
      rulesContext: [
        {
          id: 'advfreq-verbatim-opener',
          rule: 'Speaks the framing and the plan-ready lines verbatim, no improvised lead-in',
          severity: 'must',
          enforcedBy: ['eval:verbatim-opener'],
        },
        {
          id: 'advfreq-parse-full-answer',
          rule: 'Parses a full frequency answer when given; asks only for what is missing',
          severity: 'must',
          enforcedBy: ['eval:one-line-then-wait'],
        },
        {
          id: 'advfreq-no-reask',
          rule: 'Never re-asks anything already captured',
          severity: 'must',
          enforcedBy: ['eval:carry-forward'],
        },
      ],
      rulesCode: [
        {
          id: 'advfreq-tools-only',
          rule: 'Only add_habit, update_habit, and advance_step are callable on this beat',
          severity: 'must',
          enforcedBy: ['tool-contract-check'],
        },
        {
          id: 'advfreq-advance-on-days',
          rule: 'advance_step fires only after each habit has its days set',
          severity: 'must',
          enforcedBy: ['advance-gate-check'],
        },
        {
          id: 'advfreq-reminders-off',
          rule: 'Per-habit reminders stay OFF unless the user asks; never turn one on unprompted',
          severity: 'must',
          enforcedBy: ['component-registry-check'],
        },
        {
          id: 'advfreq-reveal-gates',
          rule: 'the day circles reveal gates on the prior line clip end, never a fixed timer',
          severity: 'must',
          enforcedBy: ['reveal-timing-check'],
        },
        {
          id: 'advfreq-audio-ownership',
          rule: 'Every spoken line resolves to a recorded clip; no live Cartesia (no {name} slot)',
          severity: 'must',
          enforcedBy: ['audio-ownership-check'],
        },
        {
          id: 'advfreq-id-alias',
          rule: 'beatId maps to the screenId / route / step / session_log / data-beat-id in identity',
          severity: 'must',
          enforcedBy: ['id-alias-check'],
        },
      ],
      contextProse: {
        prose:
          'Habit days, advanced. The habits are already captured as cards. Now set how often each one runs; the day circles grow out of the same cards. Parse a full answer when the user gives one, ask only for what is missing. Per-habit reminders OFF by default. Go through them, then the plan is ready. Never re-ask anything already captured, and never turn a reminder on unless they ask.',
        enforcedBy: ['eval:parity-walk'],
      },
      allowedTools: {
        tools: ['add_habit', 'update_habit', 'advance_step'],
        callRules:
          'Inherited from GLOBAL_CONTEXT, bound here: update_habit to set the frequency on an existing card; only this beat tools.',
        specs: [
          {
            tool: 'update_habit',
            args: '{ name: string, days: (0 | 1 | 2 | 3 | 4 | 5 | 6)[], reminder?: boolean, time?: "HH:MM", schedule?: "Weekday" | "Weekend" | "Every day" | "Custom" }',
            when: 'to set the days (frequency) on a captured habit',
          },
          {
            tool: 'add_habit',
            args: '{ name: string, days?: (0 | 1 | 2 | 3 | 4 | 5 | 6)[], reminder?: boolean, time?: "HH:MM", schedule?: "Weekday" | "Weekend" | "Every day" | "Custom" }',
            when: 'only if a habit needs adding here',
          },
          { tool: 'advance_step', args: '{}', when: 'once every habit has its days set' },
        ],
        note: 'Days are numeric 0-6 values, name identifies the card configuration, and omitted update fields are preserved.',
        enforcedBy: ['tool-contract-check'],
      },
      persistence: {
        rows: [
          {
            label: 'writes',
            value:
              'update_habit or add_habit writes the onboarding.habits collection at onboarding_states.data.habitConfigs[name], including numeric days and optional reminder/time/schedule',
          },
          {
            label: 'never re-ask',
            value:
              'the plan and resume read the same habitConfigs collection after every advanced frequency update',
          },
          {
            label: 'resume key',
            value: 'onboarding_states.data.habitConfigs, plus current_step past advanced-frequency',
          },
        ],
        watchOut:
          'AUTHORITATIVE RENDER CONTRACT. TODO app migration: replace habitId/string-days payloads with name/numeric-days in all advanced-frequency consumers and both execution lanes.',
        enforcedBy: ['persistence-contract-check'],
      },
      flow: {
        rows: [
          {
            label: 'advance condition',
            value: 'every captured habit has its days set (via update_habit), then advance_step',
          },
          { label: 'upstream branch (into this beat)', value: 'advanced-capture advances here' },
          {
            label: 'downstream branch (out of this beat)',
            value: 'proceeds to the plan confirm (the plan is ready)',
          },
          { label: 'gate', value: 'each captured habit needs days set before advancing' },
        ],
        enforcedBy: ['advance-gate-check'],
      },
      edges: {
        rows: [
          {
            edge: 'tool failure',
            behavior:
              'update_habit errors: retry once quietly. If it still fails, SURFACE it, never fail silently, and do not advance. Tap/text path: a toast "Couldn\'t save that, tap to retry" with the days retained. Voice path: one short coach line "That didn\'t go through, let me try again."',
            voice: 'clip-family:onboard_advanced_frequency_edge_1 (pending recording)',
          },
          {
            edge: 'partial frequency answer',
            behavior:
              'take what was given, ask only for the missing habits days; never re-ask a set one',
          },
          {
            edge: 'asks for a reminder',
            behavior: 'turn the per-habit reminder on for that habit; otherwise reminders stay OFF',
          },
        ],
        enforcedBy: ['eval:edge-walk'],
      },
      acceptance: {
        rows: [
          {
            criterion: 'shows the right thing',
            check:
              'phone renders the captured habit cards, each with a day-circle picker; no new cards are created',
          },
          {
            criterion: 'says the right thing',
            check:
              'the framing and plan-ready lines play verbatim; a full answer is parsed, only gaps asked',
          },
          {
            criterion: 'advances correctly',
            check: 'each habit days set via update_habit, then advance_step',
          },
        ],
        enforcedBy: ['component-registry-check', 'render-link-integrity-check', 'eval:edge-walk'],
      },
      applicableDecisions: {
        rows: [
          {
            decision: '4/5 (habit caps: max 2 habits)',
            binds: false,
            how: 'the advanced path uses the user existing list; the beginner 2-habit cap does not gate this frequency beat',
          },
          {
            decision: '1, 2 (profile gates), 3 (women-art), 6, 7 (reflection)',
            binds: false,
            how: 'not this beat',
          },
        ],
        enforcedBy: ['decisions-coverage-check'],
      },
    },
    script: [
      {
        seq: 1,
        words: "Please set the days that you're going to actually do these habits.",
        bindsTo: {
          kind: 'bubble',
          element: 'bubble-1',
          screen: 'ONBOARD-ADVANCED-FREQUENCY',
        },
        voice: 'mp3',
        clip: 'onboard_advanced_frequency_days',
        clipPath: '/voice/ob/onboard_advanced_frequency_days.wav',
      },
      {
        seq: 2,
        words:
          'Not every habit needs to be done every day. Three specific days in the week is great as well. Once a week for a certain habit, also great.',
        bindsTo: {
          kind: 'bubble',
          element: 'bubble-2',
          screen: 'ONBOARD-ADVANCED-FREQUENCY',
        },
        voice: 'mp3',
        clip: 'onboard_advanced_frequency_1',
        clipPath: '/voice/ob/onboard_advanced_frequency_1.wav',
      },
      {
        seq: 3,
        words: '',
        bindsTo: {
          kind: 'component',
          element: 'reveal-99',
          screen: 'ONBOARD-ADVANCED-FREQUENCY',
        },
        voice: 'mp3',
        clip: null,
        clipPath: null,
      },
      {
        seq: 4,
        words: 'Your habits are all set, your plan is ready.',
        bindsTo: {
          kind: 'bubble',
          element: 'bubble-4',
          screen: 'ONBOARD-ADVANCED-FREQUENCY',
        },
        voice: 'mp3',
        clip: 'onboard_advanced_frequency_2',
        clipPath: '/voice/ob/onboard_advanced_frequency_2.wav',
      },
    ],
    io: {
      dataIn: [
        { key: 'onboarding.habits', from: 'flow-state', note: 'parsed from the brain dump' },
      ],
      dataOut: [
        {
          key: 'onboarding.habits',
          from: 'flow-state',
          writtenBy: 'update_habit / remove_habit / add_habit',
          persistsTo: 'onboarding_states.data.habitConfigs',
        },
      ],
    },
  },
  {
    id: 'plan',
    name: 'Plan confirm',
    order: 56,
    path: 'both',
    type: 'into-app',
    screenId: 'ONBOARD-COMPLETE',
    allowedTools: 'confirm_plan',
    expectedResponse: 'Approves the ready-to-start plan',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: { buttonLabel: 'Ready to start' },
    // Archetype = read-only ready-to-start gate. The plan confirms the setup without
    // reopening edits. confirm_plan completes onboarding atomically in both lanes.
    bible: {
      sectionManifest: {
        identity: 'filled',
        scriptMeta: 'filled',
        components: 'filled',
        voice: 'filled',
        rulesContext: 'filled',
        rulesCode: 'filled',
        conversation: 'filled',
        contextProse: 'filled',
        allowedTools: 'filled',
        persistence: 'filled',
        flow: 'filled',
        edges: 'filled',
        acceptance: 'filled',
        applicableDecisions: 'filled',
      },
      identity: {
        rows: [
          { label: 'beatId (canonical)', value: 'plan' },
          { label: 'name', value: 'Plan confirm' },
          { label: 'order', value: '56' },
          { label: 'path', value: 'both' },
          { label: 'type', value: 'into-app' },
        ],
        aliases: [
          { surface: 'screenId', value: 'ONBOARD-COMPLETE' },
          { surface: 'route', value: '/onboarding/complete' },
          { surface: 'persisted current_step', value: 'plan' },
          { surface: 'session_log value', value: 'plan' },
          { surface: 'data-beat-id', value: 'plan' },
        ],
        enforcedBy: ['id-alias-check'],
      },
      scriptMeta: {
        rows: [
          {
            seq: 1,
            reveal: 'opener line with the whole plan on screen; no gate (the one spoken line)',
            timing: 'karaoke per-word on the bubble',
          },
        ],
        enforcedBy: ['render-link-integrity-check', 'reveal-timing-check'],
      },
      components: {
        rows: [
          { label: 'component (registry key)', value: 'into-app' },
          {
            label: 'on-screen',
            value:
              'the whole plan: the check-in time, the evening reflection time, and all the habits under them',
          },
          {
            label: 'button (tap path only)',
            value:
              'one button: "Ready to start"; the voice path shows no button and accepts spoken approval',
          },
          {
            label: 'selection mode',
            value: 'read-only plan, approval only; this beat has no edit or change path',
          },
        ],
        watchOut:
          'LOCKED copy decision (2026-07-10): plan is read-only and ready to start. On the voice path there is no button; the user speaks approval. TODO app migration: remove the edit surface from plan review.',
        enforcedBy: ['component-registry-check'],
      },
      voice: {
        rows: [
          { label: 'engine', value: 'MP3' },
          { label: 'mode', value: 'Verbatim (enum is Verbatim / Generative)' },
        ],
        perLine: [{ seq: 1, resolvesTo: 'recorded clip onboard_complete_1', liveAllowed: 'NO' }],
        assertion:
          'The line carries no live slot like {name}, so it MUST resolve to the recorded clip onboard_complete_1. No live Cartesia on this beat.',
        enforcedBy: ['audio-ownership-check'],
      },
      rulesContext: [
        {
          id: 'plan-verbatim-opener',
          rule: 'Speaks the confirm line verbatim; the line is real and specific to the plan, not generic',
          severity: 'must',
          enforcedBy: ['eval:verbatim-opener'],
        },
        {
          id: 'plan-one-confirm',
          rule: 'One confirm: show the read-only plan, ask if they are ready to start, then wait',
          severity: 'must',
          enforcedBy: ['eval:one-line-then-wait'],
        },
        {
          id: 'plan-no-platitudes',
          rule: 'This is a high-investment moment; make the line real, no generic praise or filler',
          severity: 'must',
          enforcedBy: ['eval:no-platitudes'],
        },
      ],
      rulesCode: [
        {
          id: 'plan-tools-only',
          rule: 'Only confirm_plan is callable on this beat',
          severity: 'must',
          enforcedBy: ['tool-contract-check'],
        },
        {
          id: 'plan-confirm-enters-app',
          rule: 'confirm_plan fires on approval and completes onboarding into the app',
          severity: 'must',
          enforcedBy: ['advance-gate-check'],
        },
        {
          id: 'plan-audio-ownership',
          rule: 'The line resolves to a recorded clip; no live Cartesia (no {name} slot)',
          severity: 'must',
          enforcedBy: ['audio-ownership-check'],
        },
        {
          id: 'plan-id-alias',
          rule: 'beatId maps to the screenId / route / step / session_log / data-beat-id in identity',
          severity: 'must',
          enforcedBy: ['id-alias-check'],
        },
      ],
      conversation: {
        opens: 'after the confirm line (ready to start)',
        branches: [
          {
            on: 'approves (taps Ready to start, or says it looks good)',
            reply: 'none (silent); enter the app',
            then: 'tool:confirm_plan',
          },
          {
            on: 'off-topic or world question',
            reply:
              'global rule glob-out-of-scope: one brief acknowledgement, steer back to the plan confirm',
            then: 'wait',
            voice: 'clip-family:onboard_offtopic (pending recording)',
          },
        ],
        maxTurns: 5,
        onMaxTurns: 'plain one-line re-ask of whether they are ready to start',
      },
      contextProse: {
        prose:
          'Full plan. One confirm. Show the whole plan: the check-in time, the evening reflection time, and all the habits under them. It is read-only. Ask whether they are ready to start. On approval, they enter the app. This is a high-investment moment, so make the line real and specific, not generic. On the tap path, show one "Ready to start" button; on voice, no button, the user just speaks approval.',
        enforcedBy: ['eval:parity-walk'],
      },
      allowedTools: {
        tools: ['confirm_plan'],
        callRules:
          'Inherited from GLOBAL_CONTEXT, bound here: confirm_plan only on approval; this read-only beat has no edit tools.',
        specs: [
          {
            tool: 'confirm_plan',
            args: '{}',
            when: 'once the user approves the plan',
          },
        ],
        note: 'AUTHORITATIVE RENDER CONTRACT. confirm_plan is the one completion operation in Direct LLM and Vapi.',
        enforcedBy: ['tool-contract-check'],
      },
      persistence: {
        rows: [
          {
            label: 'writes',
            value:
              'onboarding_states.data.plan.confirmed = true, onboarding_states.status = "completed", onboarding_states.completed_at = now(), and onboarding_states.current_step = "completed" in the same confirm_plan transaction',
          },
          {
            label: 'never re-ask',
            value:
              'a completed onboarding state routes directly into the app; plan is never re-opened as an edit surface',
          },
          {
            label: 'resume key',
            value: 'onboarding_states.status = completed and completed_at is non-null',
          },
        ],
        watchOut:
          'AUTHORITATIVE RENDER CONTRACT. TODO app migration: Direct LLM confirm_plan must perform this server-side completion write, matching Vapi, before navigation. Keep both lanes behaviorally identical and do not use a client-only completion side effect.',
        enforcedBy: ['persistence-contract-check'],
      },
      flow: {
        rows: [
          {
            label: 'advance condition',
            value: 'the user approves and confirm_plan completes onboarding into the app',
          },
          {
            label: 'upstream branch (into this beat)',
            value: 'the habit schedule (beginner) or advanced-frequency (advanced) routes here',
          },
          {
            label: 'downstream branch (out of this beat)',
            value: 'on approval, into the app, then the weekly projection frames',
          },
          {
            label: 'gate',
            value:
              'the user must approve the read-only plan (confirm_plan) before entering the app',
          },
        ],
        enforcedBy: ['advance-gate-check'],
      },
      edges: {
        rows: [
          {
            edge: 'tool failure',
            behavior:
              'confirm_plan errors: retry once quietly. If it still fails, SURFACE it, never fail silently, and do not enter the app. Tap/text path: a toast "Couldn\'t save that, tap to retry". Voice path: one short coach line "That didn\'t go through, let me try again."',
            voice: 'clip-family:onboard_complete_edge_1 (pending recording)',
          },
          {
            edge: 'no tap on voice path',
            behavior:
              'no button on voice; take spoken approval and instrument users who complete without a tap',
          },
        ],
        enforcedBy: ['eval:edge-walk'],
      },
      acceptance: {
        rows: [
          {
            criterion: 'shows the right thing',
            check:
              'phone renders the read-only whole plan (check-in, reflection, habits); tap path shows one Ready to start button, voice path shows none',
          },
          {
            criterion: 'says the right thing',
            check: 'the confirm line plays verbatim, real and specific to the plan',
          },
          {
            criterion: 'advances correctly',
            check:
              'approval fires the common confirm_plan completion transaction, then enters the app',
          },
        ],
        enforcedBy: ['component-registry-check', 'render-link-integrity-check', 'eval:edge-walk'],
      },
      applicableDecisions: {
        rows: [
          {
            decision: '1-7 (profile gates, women-art, habit caps, reflection)',
            binds: false,
            how: 'the plan confirm reflects the choices already made; it is a confirm-into-app gate, not the render side of any single decision, so none binds here',
          },
        ],
        enforcedBy: ['decisions-coverage-check'],
      },
    },
    script: [
      {
        seq: 1,
        words:
          "Here's your plan. Your check-in, your reflection, and the habits you picked. Ready to start?",
        bindsTo: {
          kind: 'bubble',
          element: 'opener',
          screen: 'ONBOARD-COMPLETE',
        },
        voice: 'mp3',
        clip: 'onboard_complete_1',
        clipPath: '/voice/ob/onboard_complete_1.wav',
      },
    ],
    io: {
      dataIn: [
        { key: 'checkin.config', from: 'flow-state' },
        { key: 'reflection.config', from: 'flow-state' },
        { key: 'onboarding.habits', from: 'flow-state' },
      ],
      dataOut: [
        {
          key: 'plan.confirmed',
          from: 'flow-state',
          writtenBy: 'confirm_plan',
          persistsTo: 'onboarding_states.status + completed_at + current_step (atomic completion)',
        },
      ],
    },
  },
  {
    id: 'weekly-blank',
    name: 'Weekly projection (blank)',
    order: 57,
    path: 'both',
    type: 'weekly-projection',
    screenId: 'ONBOARD-WEEKLY-PROJECTION-BLANK',
    allowedTools: null,
    expectedResponse: 'Taps Next',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      state: 'blank',
    },
    // Archetype = non-conversational MP3 beat over a display animation: one recorded
    // line timed to a week-grid frame, then a Next tap. voice / scriptMeta owner-filled;
    // components is pending-app-reconcile (the animated 5-state week grid is not yet
    // built/reconciled in the app); conversation / allowedTools / persistence are { na }.
    bible: {
      sectionManifest: {
        identity: 'filled',
        scriptMeta: 'filled',
        components: 'pending-app-reconcile',
        voice: 'filled',
        rulesContext: 'filled',
        rulesCode: 'filled',
        conversation: { na: 'single-turn narration — the user only taps Next; no coach dialogue' },
        contextProse: 'filled',
        allowedTools: { na: 'no tools — the frame narrates and advances on a Next tap' },
        persistence: {
          na: 'writes nothing — the projection is display-only (io.dataOut is empty)',
        },
        flow: 'filled',
        edges: 'filled',
        acceptance: 'filled',
        applicableDecisions: 'filled',
      },
      identity: {
        rows: [
          { label: 'beatId (canonical)', value: 'weekly-blank' },
          { label: 'name', value: 'Weekly projection (blank)' },
          { label: 'order', value: '57' },
          { label: 'path', value: 'both' },
          { label: 'type', value: 'weekly-projection' },
        ],
        aliases: [
          { surface: 'screenId', value: 'ONBOARD-WEEKLY-PROJECTION-BLANK' },
          { surface: 'route', value: '/onboarding/weekly-projection-blank' },
          { surface: 'persisted current_step', value: 'weekly-blank' },
          { surface: 'session_log value', value: 'weekly-blank' },
          { surface: 'data-beat-id', value: 'weekly-blank' },
        ],
        enforcedBy: ['id-alias-check'],
      },
      scriptMeta: {
        rows: [
          {
            seq: 1,
            reveal: 'opener line as the week grid animates in blank; no gate (the one spoken line)',
            timing: 'karaoke per-word, timed to the frame animation',
          },
        ],
        enforcedBy: ['render-link-integrity-check', 'reveal-timing-check'],
      },
      components: {
        rows: [
          { label: 'component (registry key)', value: 'weekly-projection' },
          { label: 'state', value: 'blank (from source props.state)' },
          {
            label: 'on-screen',
            value: 'the week grid animating into its blank starting state; a Next affordance',
          },
          { label: 'selection mode', value: 'none — display-only; the user taps Next to proceed' },
        ],
        watchOut:
          'The animated 5-state week grid (blank -> full -> p78 -> p36 -> gaps) is not yet built/reconciled in the app; this component claim is pending-app-reconcile, not filled.',
        enforcedBy: ['component-registry-check'],
        status: 'app-reconcile-pending',
      },
      voice: {
        rows: [
          { label: 'engine', value: 'MP3 (Cartesia, Yair Pro Clone candidate)' },
          { label: 'mode', value: 'Verbatim (enum is Verbatim / Generative)' },
        ],
        perLine: [
          {
            seq: 1,
            resolvesTo: 'recorded clip onboard_weekly_projection_blank_1',
            liveAllowed: 'NO',
          },
        ],
        assertion:
          'The line carries no live slot like {name}, so it MUST resolve to the recorded clip onboard_weekly_projection_blank_1. No live Cartesia on this beat.',
        enforcedBy: ['audio-ownership-check'],
      },
      rulesContext: [
        {
          id: 'wblank-verbatim',
          rule: 'Speaks the frame line verbatim, timed to the animation; never improvises or adds',
          severity: 'must',
          enforcedBy: ['eval:verbatim-opener'],
        },
        {
          id: 'wblank-no-describe-grid',
          rule: 'Does not describe the grid; the visual carries itself while the line lands the point',
          severity: 'must',
          enforcedBy: ['eval:one-line-then-wait'],
        },
      ],
      rulesCode: [
        {
          id: 'wblank-audio-ownership',
          rule: 'The line resolves to a recorded clip; no live Cartesia (no {name} slot)',
          severity: 'must',
          enforcedBy: ['audio-ownership-check'],
        },
        {
          id: 'wblank-clip-resolves',
          rule: 'onboard_weekly_projection_blank_1 resolves to a real asset',
          severity: 'must',
          enforcedBy: ['render-link-integrity-check'],
        },
        {
          id: 'wblank-id-alias',
          rule: 'beatId maps to the screenId / route / step / session_log / data-beat-id in identity',
          severity: 'must',
          enforcedBy: ['id-alias-check'],
        },
      ],
      contextProse: {
        prose:
          'Weekly projection, frame 1 of 5. The week grid animates in blank, starting today. One verbatim line, timed to the frame. The five frames together carry the message: reporting itself is the win, weekly reassessment is the loop, a miss still counts, the one thing to avoid is the unreported gap.',
        enforcedBy: ['eval:parity-walk'],
      },
      flow: {
        rows: [
          { label: 'advance condition', value: 'the user taps Next after the line lands' },
          { label: 'upstream branch (into this beat)', value: 'plan confirm proceeds here' },
          {
            label: 'downstream branch (out of this beat)',
            value: 'proceeds to weekly-full (order 58)',
          },
          { label: 'gate', value: 'none — a single Next tap advances the frame' },
        ],
        enforcedBy: ['advance-gate-check'],
      },
      edges: {
        rows: [
          {
            edge: 'audio fails to play',
            behavior:
              'show the line as text and keep the Next affordance; never strand a silent frame',
          },
          {
            edge: 'grid animation not ready',
            behavior:
              'if the projection component is unavailable, still show the line and the Next affordance (pending-app-reconcile fallback)',
          },
        ],
        enforcedBy: ['eval:edge-walk'],
      },
      acceptance: {
        rows: [
          {
            criterion: 'shows the right thing',
            check:
              'the blank week grid animates and a Next affordance appears (pending the built component)',
          },
          {
            criterion: 'says the right thing',
            check: 'the frame line plays verbatim from onboard_weekly_projection_blank_1',
          },
          {
            criterion: 'advances correctly',
            check: 'a Next tap proceeds to weekly-full; nothing is captured',
          },
        ],
        enforcedBy: ['render-link-integrity-check', 'audio-ownership-check', 'eval:edge-walk'],
      },
      applicableDecisions: {
        rows: [
          {
            decision: '1-7 (profile gates, women-art, habit caps, reflection)',
            binds: false,
            how: 'the weekly projection is a closing narration; it captures nothing and gates nothing, so no decision binds here',
          },
        ],
        enforcedBy: ['decisions-coverage-check'],
      },
    },
    script: [
      {
        seq: 1,
        words: 'This is your week. Blank, starting today.',
        bindsTo: {
          kind: 'component',
          element: 'opener-line',
          screen: 'ONBOARD-WEEKLY-PROJECTION-BLANK',
        },
        voice: 'mp3',
        clip: 'onboard_weekly_projection_blank_1',
        clipPath: '/voice/ob/onboard_weekly_projection_blank_1.wav',
      },
    ],
    io: {
      dataIn: [{ key: 'onboarding.habits', from: 'flow-state', note: 'projection display input' }],
      dataOut: [],
    },
  },
  {
    id: 'weekly-full',
    name: 'Weekly projection (full)',
    order: 58,
    path: 'both',
    type: 'weekly-projection',
    screenId: 'ONBOARD-WEEKLY-PROJECTION-FULL',
    allowedTools: null,
    expectedResponse: 'Taps Next',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      state: 'full',
    },
    // Archetype = non-conversational MP3 beat over a display animation (weekly frame 2).
    bible: {
      sectionManifest: {
        identity: 'filled',
        scriptMeta: 'filled',
        components: 'pending-app-reconcile',
        voice: 'filled',
        rulesContext: 'filled',
        rulesCode: 'filled',
        conversation: { na: 'single-turn narration — the user only taps Next; no coach dialogue' },
        contextProse: 'filled',
        allowedTools: { na: 'no tools — the frame narrates and advances on a Next tap' },
        persistence: {
          na: 'writes nothing — the projection is display-only (io.dataOut is empty)',
        },
        flow: 'filled',
        edges: 'filled',
        acceptance: 'filled',
        applicableDecisions: 'filled',
      },
      identity: {
        rows: [
          { label: 'beatId (canonical)', value: 'weekly-full' },
          { label: 'name', value: 'Weekly projection (full)' },
          { label: 'order', value: '58' },
          { label: 'path', value: 'both' },
          { label: 'type', value: 'weekly-projection' },
        ],
        aliases: [
          { surface: 'screenId', value: 'ONBOARD-WEEKLY-PROJECTION-FULL' },
          { surface: 'route', value: '/onboarding/weekly-projection-full' },
          { surface: 'persisted current_step', value: 'weekly-full' },
          { surface: 'session_log value', value: 'weekly-full' },
          { surface: 'data-beat-id', value: 'weekly-full' },
        ],
        enforcedBy: ['id-alias-check'],
      },
      scriptMeta: {
        rows: [
          {
            seq: 1,
            reveal: 'opener line as the week grid fills green; no gate (the one spoken line)',
            timing: 'karaoke per-word, timed to the frame animation',
          },
        ],
        enforcedBy: ['render-link-integrity-check', 'reveal-timing-check'],
      },
      components: {
        rows: [
          { label: 'component (registry key)', value: 'weekly-projection' },
          { label: 'state', value: 'full (from source props.state)' },
          {
            label: 'on-screen',
            value: 'the week grid filling all-green; a Next affordance',
          },
          { label: 'selection mode', value: 'none — display-only; the user taps Next to proceed' },
        ],
        watchOut:
          'The animated 5-state week grid (blank -> full -> p78 -> p36 -> gaps) is not yet built/reconciled in the app; this component claim is pending-app-reconcile, not filled.',
        enforcedBy: ['component-registry-check'],
        status: 'app-reconcile-pending',
      },
      voice: {
        rows: [
          { label: 'engine', value: 'MP3 (Cartesia, Yair Pro Clone candidate)' },
          { label: 'mode', value: 'Verbatim (enum is Verbatim / Generative)' },
        ],
        perLine: [
          {
            seq: 1,
            resolvesTo: 'recorded clip onboard_weekly_projection_full_1',
            liveAllowed: 'NO',
          },
        ],
        assertion:
          'The line carries no live slot like {name}, so it MUST resolve to the recorded clip onboard_weekly_projection_full_1. No live Cartesia on this beat.',
        enforcedBy: ['audio-ownership-check'],
      },
      rulesContext: [
        {
          id: 'wfull-verbatim',
          rule: 'Speaks the frame line verbatim, timed to the animation; never improvises or adds',
          severity: 'must',
          enforcedBy: ['eval:verbatim-opener'],
        },
        {
          id: 'wfull-hold-lightly',
          rule: 'Holds the best-case frame lightly; never promises this is what will happen',
          severity: 'must',
          enforcedBy: ['eval:no-platitudes'],
        },
      ],
      rulesCode: [
        {
          id: 'wfull-audio-ownership',
          rule: 'The line resolves to a recorded clip; no live Cartesia (no {name} slot)',
          severity: 'must',
          enforcedBy: ['audio-ownership-check'],
        },
        {
          id: 'wfull-clip-resolves',
          rule: 'onboard_weekly_projection_full_1 resolves to a real asset',
          severity: 'must',
          enforcedBy: ['render-link-integrity-check'],
        },
        {
          id: 'wfull-id-alias',
          rule: 'beatId maps to the screenId / route / step / session_log / data-beat-id in identity',
          severity: 'must',
          enforcedBy: ['id-alias-check'],
        },
      ],
      contextProse: {
        prose:
          'Weekly projection, frame 2 of 5. The week grid fills all-green. One verbatim line, timed to the frame. This is the best-case frame, held lightly; the realistic frames come next.',
        enforcedBy: ['eval:parity-walk'],
      },
      flow: {
        rows: [
          { label: 'advance condition', value: 'the user taps Next after the line lands' },
          { label: 'upstream branch (into this beat)', value: 'weekly-blank proceeds here' },
          {
            label: 'downstream branch (out of this beat)',
            value: 'proceeds to weekly-p78 (order 59)',
          },
          { label: 'gate', value: 'none — a single Next tap advances the frame' },
        ],
        enforcedBy: ['advance-gate-check'],
      },
      edges: {
        rows: [
          {
            edge: 'audio fails to play',
            behavior:
              'show the line as text and keep the Next affordance; never strand a silent frame',
          },
          {
            edge: 'grid animation not ready',
            behavior:
              'if the projection component is unavailable, still show the line and the Next affordance (pending-app-reconcile fallback)',
          },
        ],
        enforcedBy: ['eval:edge-walk'],
      },
      acceptance: {
        rows: [
          {
            criterion: 'shows the right thing',
            check:
              'the week grid fills green and a Next affordance appears (pending the built component)',
          },
          {
            criterion: 'says the right thing',
            check: 'the frame line plays verbatim from onboard_weekly_projection_full_1',
          },
          {
            criterion: 'advances correctly',
            check: 'a Next tap proceeds to weekly-p78; nothing is captured',
          },
        ],
        enforcedBy: ['render-link-integrity-check', 'audio-ownership-check', 'eval:edge-walk'],
      },
      applicableDecisions: {
        rows: [
          {
            decision: '1-7 (profile gates, women-art, habit caps, reflection)',
            binds: false,
            how: 'the weekly projection is a closing narration; it captures nothing and gates nothing, so no decision binds here',
          },
        ],
        enforcedBy: ['decisions-coverage-check'],
      },
    },
    script: [
      {
        seq: 1,
        words: 'Best case, every day green. 100% success. That would be amazing.',
        bindsTo: {
          kind: 'component',
          element: 'opener-line',
          screen: 'ONBOARD-WEEKLY-PROJECTION-FULL',
        },
        voice: 'mp3',
        clip: 'onboard_weekly_projection_full_1',
        clipPath: '/voice/ob/onboard_weekly_projection_full_1.wav',
      },
    ],
    io: {
      dataIn: [{ key: 'onboarding.habits', from: 'flow-state', note: 'projection display input' }],
      dataOut: [],
    },
  },
  {
    id: 'weekly-p78',
    name: 'Weekly projection (78%)',
    order: 59,
    path: 'both',
    type: 'weekly-projection',
    screenId: 'ONBOARD-WEEKLY-PROJECTION-P78',
    allowedTools: null,
    expectedResponse: 'Taps Next',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      state: 'p78',
    },
    // Archetype = non-conversational MP3 beat over a display animation (weekly frame 3).
    bible: {
      sectionManifest: {
        identity: 'filled',
        scriptMeta: 'filled',
        components: 'pending-app-reconcile',
        voice: 'filled',
        rulesContext: 'filled',
        rulesCode: 'filled',
        conversation: { na: 'single-turn narration — the user only taps Next; no coach dialogue' },
        contextProse: 'filled',
        allowedTools: { na: 'no tools — the frame narrates and advances on a Next tap' },
        persistence: {
          na: 'writes nothing — the projection is display-only (io.dataOut is empty)',
        },
        flow: 'filled',
        edges: 'filled',
        acceptance: 'filled',
        applicableDecisions: 'filled',
      },
      identity: {
        rows: [
          { label: 'beatId (canonical)', value: 'weekly-p78' },
          { label: 'name', value: 'Weekly projection (78%)' },
          { label: 'order', value: '59' },
          { label: 'path', value: 'both' },
          { label: 'type', value: 'weekly-projection' },
        ],
        aliases: [
          { surface: 'screenId', value: 'ONBOARD-WEEKLY-PROJECTION-P78' },
          { surface: 'route', value: '/onboarding/weekly-projection-p78' },
          { surface: 'persisted current_step', value: 'weekly-p78' },
          { surface: 'session_log value', value: 'weekly-p78' },
          { surface: 'data-beat-id', value: 'weekly-p78' },
        ],
        enforcedBy: ['id-alias-check'],
      },
      scriptMeta: {
        rows: [
          {
            seq: 1,
            reveal:
              'opener line as the grid shows mostly-green with a few misses; no gate (the one spoken line)',
            timing: 'karaoke per-word, timed to the frame animation',
          },
        ],
        enforcedBy: ['render-link-integrity-check', 'reveal-timing-check'],
      },
      components: {
        rows: [
          { label: 'component (registry key)', value: 'weekly-projection' },
          { label: 'state', value: 'p78 (from source props.state)' },
          {
            label: 'on-screen',
            value: 'the week grid mostly green with a few misses; a Next affordance',
          },
          { label: 'selection mode', value: 'none — display-only; the user taps Next to proceed' },
        ],
        watchOut:
          'The animated 5-state week grid (blank -> full -> p78 -> p36 -> gaps) is not yet built/reconciled in the app; this component claim is pending-app-reconcile, not filled.',
        enforcedBy: ['component-registry-check'],
        status: 'app-reconcile-pending',
      },
      voice: {
        rows: [
          { label: 'engine', value: 'MP3 (Cartesia, Yair Pro Clone candidate)' },
          { label: 'mode', value: 'Verbatim (enum is Verbatim / Generative)' },
        ],
        perLine: [
          {
            seq: 1,
            resolvesTo: 'recorded clip onboard_weekly_projection_p78_1',
            liveAllowed: 'NO',
          },
        ],
        assertion:
          'The line carries no live slot like {name}, so it MUST resolve to the recorded clip onboard_weekly_projection_p78_1. No live Cartesia on this beat.',
        enforcedBy: ['audio-ownership-check'],
      },
      rulesContext: [
        {
          id: 'wp78-verbatim',
          rule: 'Speaks the frame line verbatim, timed to the animation; never improvises or adds',
          severity: 'must',
          enforcedBy: ['eval:verbatim-opener'],
        },
        {
          id: 'wp78-frame-as-win',
          rule: 'Frames the realistic mostly-green week as a real win; never as a shortfall from all-green',
          severity: 'must',
          enforcedBy: ['eval:no-platitudes'],
        },
      ],
      rulesCode: [
        {
          id: 'wp78-audio-ownership',
          rule: 'The line resolves to a recorded clip; no live Cartesia (no {name} slot)',
          severity: 'must',
          enforcedBy: ['audio-ownership-check'],
        },
        {
          id: 'wp78-clip-resolves',
          rule: 'onboard_weekly_projection_p78_1 resolves to a real asset',
          severity: 'must',
          enforcedBy: ['render-link-integrity-check'],
        },
        {
          id: 'wp78-id-alias',
          rule: 'beatId maps to the screenId / route / step / session_log / data-beat-id in identity',
          severity: 'must',
          enforcedBy: ['id-alias-check'],
        },
      ],
      contextProse: {
        prose:
          'Weekly projection, frame 3 of 5. The grid shows mostly green with a few misses. One verbatim line, timed to the frame. This is the realistic win frame, the one that matters most.',
        enforcedBy: ['eval:parity-walk'],
      },
      flow: {
        rows: [
          { label: 'advance condition', value: 'the user taps Next after the line lands' },
          { label: 'upstream branch (into this beat)', value: 'weekly-full proceeds here' },
          {
            label: 'downstream branch (out of this beat)',
            value: 'proceeds to weekly-p36 (order 60)',
          },
          { label: 'gate', value: 'none — a single Next tap advances the frame' },
        ],
        enforcedBy: ['advance-gate-check'],
      },
      edges: {
        rows: [
          {
            edge: 'audio fails to play',
            behavior:
              'show the line as text and keep the Next affordance; never strand a silent frame',
          },
          {
            edge: 'grid animation not ready',
            behavior:
              'if the projection component is unavailable, still show the line and the Next affordance (pending-app-reconcile fallback)',
          },
        ],
        enforcedBy: ['eval:edge-walk'],
      },
      acceptance: {
        rows: [
          {
            criterion: 'shows the right thing',
            check:
              'the grid shows mostly-green with a few misses and a Next affordance appears (pending the built component)',
          },
          {
            criterion: 'says the right thing',
            check: 'the frame line plays verbatim from onboard_weekly_projection_p78_1',
          },
          {
            criterion: 'advances correctly',
            check: 'a Next tap proceeds to weekly-p36; nothing is captured',
          },
        ],
        enforcedBy: ['render-link-integrity-check', 'audio-ownership-check', 'eval:edge-walk'],
      },
      applicableDecisions: {
        rows: [
          {
            decision: '1-7 (profile gates, women-art, habit caps, reflection)',
            binds: false,
            how: 'the weekly projection is a closing narration; it captures nothing and gates nothing, so no decision binds here',
          },
        ],
        enforcedBy: ['decisions-coverage-check'],
      },
    },
    script: [
      {
        seq: 1,
        words:
          'Most likely your week looks somewhere around here. Mostly green, a few misses. Still a real win.',
        bindsTo: {
          kind: 'component',
          element: 'opener-line',
          screen: 'ONBOARD-WEEKLY-PROJECTION-P78',
        },
        voice: 'mp3',
        clip: 'onboard_weekly_projection_p78_1',
        clipPath: '/voice/ob/onboard_weekly_projection_p78_1.wav',
      },
    ],
    io: {
      dataIn: [{ key: 'onboarding.habits', from: 'flow-state', note: 'projection display input' }],
      dataOut: [],
    },
  },
  {
    id: 'weekly-p36',
    name: 'Weekly projection (36%)',
    order: 60,
    path: 'both',
    type: 'weekly-projection',
    screenId: 'ONBOARD-WEEKLY-PROJECTION-P36',
    allowedTools: null,
    expectedResponse: 'Taps Next',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      state: 'p36',
    },
    // Archetype = non-conversational MP3 beat over a display animation (weekly frame 4).
    bible: {
      sectionManifest: {
        identity: 'filled',
        scriptMeta: 'filled',
        components: 'pending-app-reconcile',
        voice: 'filled',
        rulesContext: 'filled',
        rulesCode: 'filled',
        conversation: { na: 'single-turn narration — the user only taps Next; no coach dialogue' },
        contextProse: 'filled',
        allowedTools: { na: 'no tools — the frame narrates and advances on a Next tap' },
        persistence: {
          na: 'writes nothing — the projection is display-only (io.dataOut is empty)',
        },
        flow: 'filled',
        edges: 'filled',
        acceptance: 'filled',
        applicableDecisions: 'filled',
      },
      identity: {
        rows: [
          { label: 'beatId (canonical)', value: 'weekly-p36' },
          { label: 'name', value: 'Weekly projection (36%)' },
          { label: 'order', value: '60' },
          { label: 'path', value: 'both' },
          { label: 'type', value: 'weekly-projection' },
        ],
        aliases: [
          { surface: 'screenId', value: 'ONBOARD-WEEKLY-PROJECTION-P36' },
          { surface: 'route', value: '/onboarding/weekly-projection-p36' },
          { surface: 'persisted current_step', value: 'weekly-p36' },
          { surface: 'session_log value', value: 'weekly-p36' },
          { surface: 'data-beat-id', value: 'weekly-p36' },
        ],
        enforcedBy: ['id-alias-check'],
      },
      scriptMeta: {
        rows: [
          {
            seq: 1,
            reveal:
              'opener line as the grid shows a rough week with one streak surviving; no gate (the one spoken line)',
            timing: 'karaoke per-word, timed to the frame animation',
          },
        ],
        enforcedBy: ['render-link-integrity-check', 'reveal-timing-check'],
      },
      components: {
        rows: [
          { label: 'component (registry key)', value: 'weekly-projection' },
          { label: 'state', value: 'p36 (from source props.state)' },
          {
            label: 'on-screen',
            value: 'the week grid showing a rough week, one streak surviving; a Next affordance',
          },
          { label: 'selection mode', value: 'none — display-only; the user taps Next to proceed' },
        ],
        watchOut:
          'The animated 5-state week grid (blank -> full -> p78 -> p36 -> gaps) is not yet built/reconciled in the app; this component claim is pending-app-reconcile, not filled.',
        enforcedBy: ['component-registry-check'],
        status: 'app-reconcile-pending',
      },
      voice: {
        rows: [
          { label: 'engine', value: 'MP3 (Cartesia, Yair Pro Clone candidate)' },
          { label: 'mode', value: 'Verbatim (enum is Verbatim / Generative)' },
        ],
        perLine: [
          {
            seq: 1,
            resolvesTo: 'recorded clip onboard_weekly_projection_p36_1',
            liveAllowed: 'NO',
          },
        ],
        assertion:
          'The line carries no live slot like {name}, so it MUST resolve to the recorded clip onboard_weekly_projection_p36_1. No live Cartesia on this beat.',
        enforcedBy: ['audio-ownership-check'],
      },
      rulesContext: [
        {
          id: 'wp36-verbatim',
          rule: 'Speaks the frame line verbatim, timed to the animation; never improvises or adds',
          severity: 'must',
          enforcedBy: ['eval:verbatim-opener'],
        },
        {
          id: 'wp36-no-failure-framing',
          rule: 'Never makes a rough week sound like failure; a rough week is still building, we reassess, no guilt',
          severity: 'must',
          enforcedBy: ['eval:no-platitudes'],
        },
      ],
      rulesCode: [
        {
          id: 'wp36-audio-ownership',
          rule: 'The line resolves to a recorded clip; no live Cartesia (no {name} slot)',
          severity: 'must',
          enforcedBy: ['audio-ownership-check'],
        },
        {
          id: 'wp36-clip-resolves',
          rule: 'onboard_weekly_projection_p36_1 resolves to a real asset',
          severity: 'must',
          enforcedBy: ['render-link-integrity-check'],
        },
        {
          id: 'wp36-id-alias',
          rule: 'beatId maps to the screenId / route / step / session_log / data-beat-id in identity',
          severity: 'must',
          enforcedBy: ['id-alias-check'],
        },
      ],
      contextProse: {
        prose:
          'Weekly projection, frame 4 of 5. The grid shows a rough week, one streak surviving. One verbatim line, timed to the frame. The message: a rough week is still building, we reassess, no guilt.',
        enforcedBy: ['eval:parity-walk'],
      },
      flow: {
        rows: [
          { label: 'advance condition', value: 'the user taps Next after the line lands' },
          { label: 'upstream branch (into this beat)', value: 'weekly-p78 proceeds here' },
          {
            label: 'downstream branch (out of this beat)',
            value: 'proceeds to weekly-gaps (order 61)',
          },
          { label: 'gate', value: 'none — a single Next tap advances the frame' },
        ],
        enforcedBy: ['advance-gate-check'],
      },
      edges: {
        rows: [
          {
            edge: 'audio fails to play',
            behavior:
              'show the line as text and keep the Next affordance; never strand a silent frame',
          },
          {
            edge: 'grid animation not ready',
            behavior:
              'if the projection component is unavailable, still show the line and the Next affordance (pending-app-reconcile fallback)',
          },
        ],
        enforcedBy: ['eval:edge-walk'],
      },
      acceptance: {
        rows: [
          {
            criterion: 'shows the right thing',
            check:
              'the grid shows a rough week with one streak surviving and a Next affordance appears (pending the built component)',
          },
          {
            criterion: 'says the right thing',
            check: 'the frame line plays verbatim from onboard_weekly_projection_p36_1',
          },
          {
            criterion: 'advances correctly',
            check: 'a Next tap proceeds to weekly-gaps; nothing is captured',
          },
        ],
        enforcedBy: ['render-link-integrity-check', 'audio-ownership-check', 'eval:edge-walk'],
      },
      applicableDecisions: {
        rows: [
          {
            decision: '1-7 (profile gates, women-art, habit caps, reflection)',
            binds: false,
            how: 'the weekly projection is a closing narration; it captures nothing and gates nothing, so no decision binds here',
          },
        ],
        enforcedBy: ['decisions-coverage-check'],
      },
    },
    script: [
      {
        seq: 1,
        words:
          "Some weeks can look like this. And even that's okay, because you're in the process and you're consistent inside the process.",
        bindsTo: {
          kind: 'component',
          element: 'opener-line',
          screen: 'ONBOARD-WEEKLY-PROJECTION-P36',
        },
        voice: 'mp3',
        clip: 'onboard_weekly_projection_p36_1',
        clipPath: '/voice/ob/onboard_weekly_projection_p36_1.wav',
      },
    ],
    io: {
      dataIn: [{ key: 'onboarding.habits', from: 'flow-state', note: 'projection display input' }],
      dataOut: [],
    },
  },
  {
    id: 'weekly-gaps',
    name: 'Weekly projection (gaps)',
    order: 61,
    path: 'both',
    type: 'weekly-projection',
    screenId: 'ONBOARD-WEEKLY-PROJECTION-GAPS',
    allowedTools: null,
    expectedResponse: 'Taps Next',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      state: 'gaps',
    },
    // Archetype = non-conversational MP3 beat over a display animation (weekly frame 5, the close).
    bible: {
      sectionManifest: {
        identity: 'filled',
        scriptMeta: 'filled',
        components: 'pending-app-reconcile',
        voice: 'filled',
        rulesContext: 'filled',
        rulesCode: 'filled',
        conversation: { na: 'single-turn narration — the user only taps Next; no coach dialogue' },
        contextProse: 'filled',
        allowedTools: { na: 'no tools — the frame narrates and advances on a Next tap' },
        persistence: {
          na: 'writes nothing — the projection is display-only (io.dataOut is empty)',
        },
        flow: 'filled',
        edges: 'filled',
        acceptance: 'filled',
        applicableDecisions: 'filled',
      },
      identity: {
        rows: [
          { label: 'beatId (canonical)', value: 'weekly-gaps' },
          { label: 'name', value: 'Weekly projection (gaps)' },
          { label: 'order', value: '61' },
          { label: 'path', value: 'both' },
          { label: 'type', value: 'weekly-projection' },
        ],
        aliases: [
          { surface: 'screenId', value: 'ONBOARD-WEEKLY-PROJECTION-GAPS' },
          { surface: 'route', value: '/onboarding/weekly-projection-gaps' },
          { surface: 'persisted current_step', value: 'weekly-gaps' },
          { surface: 'session_log value', value: 'weekly-gaps' },
          { surface: 'data-beat-id', value: 'weekly-gaps' },
        ],
        enforcedBy: ['id-alias-check'],
      },
      scriptMeta: {
        rows: [
          {
            seq: 1,
            reveal:
              'opener line as the grid shows empty, unreported days; no gate (the one spoken line)',
            timing: 'karaoke per-word, timed to the frame animation',
          },
        ],
        enforcedBy: ['render-link-integrity-check', 'reveal-timing-check'],
      },
      components: {
        rows: [
          { label: 'component (registry key)', value: 'weekly-projection' },
          { label: 'state', value: 'gaps (from source props.state)' },
          {
            label: 'on-screen',
            value: 'the week grid showing empty, unreported days; a Next affordance',
          },
          { label: 'selection mode', value: 'none — display-only; the user taps Next to proceed' },
        ],
        watchOut:
          'The animated 5-state week grid (blank -> full -> p78 -> p36 -> gaps) is not yet built/reconciled in the app; this component claim is pending-app-reconcile, not filled.',
        enforcedBy: ['component-registry-check'],
        status: 'app-reconcile-pending',
      },
      voice: {
        rows: [
          { label: 'engine', value: 'MP3 (Cartesia, Yair Pro Clone candidate)' },
          { label: 'mode', value: 'Verbatim (enum is Verbatim / Generative)' },
        ],
        perLine: [
          {
            seq: 1,
            resolvesTo: 'recorded clip onboard_weekly_projection_gaps_1',
            liveAllowed: 'NO',
          },
        ],
        assertion:
          'The line carries no live slot like {name}, so it MUST resolve to the recorded clip onboard_weekly_projection_gaps_1. No live Cartesia on this beat.',
        enforcedBy: ['audio-ownership-check'],
      },
      rulesContext: [
        {
          id: 'wgaps-verbatim',
          rule: 'Speaks the frame line verbatim, timed to the animation; never improvises or adds',
          severity: 'must',
          enforcedBy: ['eval:verbatim-opener'],
        },
        {
          id: 'wgaps-no-shame',
          rule: 'Never shames the user; the point is reporting, not perfection, and even a miss counts when reported',
          severity: 'must',
          enforcedBy: ['eval:no-platitudes'],
        },
      ],
      rulesCode: [
        {
          id: 'wgaps-audio-ownership',
          rule: 'The line resolves to a recorded clip; no live Cartesia (no {name} slot)',
          severity: 'must',
          enforcedBy: ['audio-ownership-check'],
        },
        {
          id: 'wgaps-clip-resolves',
          rule: 'onboard_weekly_projection_gaps_1 resolves to a real asset',
          severity: 'must',
          enforcedBy: ['render-link-integrity-check'],
        },
        {
          id: 'wgaps-id-alias',
          rule: 'beatId maps to the screenId / route / step / session_log / data-beat-id in identity',
          severity: 'must',
          enforcedBy: ['id-alias-check'],
        },
      ],
      contextProse: {
        prose:
          'Weekly projection, frame 5 of 5, the close. The grid shows empty, unreported days. One verbatim line, timed to the frame. The message: the only thing to avoid is the unreported gap, even a miss counts when you report it.',
        enforcedBy: ['eval:parity-walk'],
      },
      flow: {
        rows: [
          { label: 'advance condition', value: 'the user taps Next after the line lands' },
          { label: 'upstream branch (into this beat)', value: 'weekly-p36 proceeds here' },
          {
            label: 'downstream branch (out of this beat)',
            value:
              'the onboarding flow completes and the user enters the app (final projection frame)',
          },
          { label: 'gate', value: 'none — a single Next tap closes the projection' },
        ],
        enforcedBy: ['advance-gate-check'],
      },
      edges: {
        rows: [
          {
            edge: 'audio fails to play',
            behavior:
              'show the line as text and keep the Next affordance; never strand a silent frame',
          },
          {
            edge: 'grid animation not ready',
            behavior:
              'if the projection component is unavailable, still show the line and the Next affordance (pending-app-reconcile fallback)',
          },
        ],
        enforcedBy: ['eval:edge-walk'],
      },
      acceptance: {
        rows: [
          {
            criterion: 'shows the right thing',
            check:
              'the grid shows empty unreported days and a Next affordance appears (pending the built component)',
          },
          {
            criterion: 'says the right thing',
            check: 'the frame line plays verbatim from onboard_weekly_projection_gaps_1',
          },
          {
            criterion: 'advances correctly',
            check: 'a Next tap closes the projection and enters the app; nothing is captured',
          },
        ],
        enforcedBy: ['render-link-integrity-check', 'audio-ownership-check', 'eval:edge-walk'],
      },
      applicableDecisions: {
        rows: [
          {
            decision: '1-7 (profile gates, women-art, habit caps, reflection)',
            binds: false,
            how: 'the weekly projection is a closing narration; it captures nothing and gates nothing, so no decision binds here',
          },
        ],
        enforcedBy: ['decisions-coverage-check'],
      },
    },
    script: [
      {
        seq: 1,
        words:
          'The one thing you want to avoid is this. The empty days you never reported. Stay consistent, just report it. Even a miss counts. That keeps the momentum going.',
        bindsTo: {
          kind: 'component',
          element: 'opener-line',
          screen: 'ONBOARD-WEEKLY-PROJECTION-GAPS',
        },
        voice: 'mp3',
        clip: 'onboard_weekly_projection_gaps_1',
        clipPath: '/voice/ob/onboard_weekly_projection_gaps_1.wav',
      },
    ],
    io: {
      dataIn: [{ key: 'onboarding.habits', from: 'flow-state', note: 'projection display input' }],
      dataOut: [],
    },
  },
] as const;

export const BEAT_BY_ID: Record<string, BeatEntry> = Object.fromEntries(
  BEATS_SOURCE.map((b) => [b.id, b]),
);
export const BEAT_BY_SCREEN_ID: Record<string, BeatEntry> = Object.fromEntries(
  BEATS_SOURCE.filter((b) => b.screenId).map((b) => [b.screenId as string, b]),
);

// Identity (section 1) is GENERATED from the beat's own fields, never copied
// from the head: beatId, order, path, type, screenId are per-beat facts, and
// copying them from a variantOf head would silently misreport them.
export function deriveVariantIdentity(beat: BeatEntry): NonNullable<BibleSections['identity']> {
  return {
    rows: [
      { label: 'beatId (canonical)', value: beat.id },
      { label: 'name', value: beat.name },
      { label: 'order', value: String(beat.order) },
      { label: 'path', value: beat.path },
      { label: 'type', value: beat.type },
    ],
    aliases: [
      { surface: 'screenId', value: beat.screenId ?? '(none)' },
      { surface: 'route', value: 'generated at app-reconcile (alias map)' },
      { surface: 'persisted current_step', value: beat.id },
      { surface: 'session_log value', value: beat.id },
      { surface: 'data-beat-id', value: beat.id },
    ],
    watchOut:
      'GENERATED from this beat entry (variants never inherit identity); the alias map is the app-reconcile source.',
    enforcedBy: ['id-alias-check'],
    status: 'verified',
  };
}

// The 14 uniform section keys, in canonical order (mirrors BibleSectionKey).
const BIBLE_SECTION_KEYS: readonly BibleSectionKey[] = [
  'identity',
  'scriptMeta',
  'components',
  'voice',
  'rulesContext',
  'rulesCode',
  'conversation',
  'contextProse',
  'allowedTools',
  'persistence',
  'flow',
  'edges',
  'acceptance',
  'applicableDecisions',
];

// A short, per-beat rule-id prefix. goals-sleep -> 'gsleep', goals-move -> 'gmove'.
// Head rules use the head's prefix; substituting head->variant prefix keeps every
// variant's rule ids unique (a per-rule scorecard requires unique ids).
export function rulePrefix(id: string): string {
  const parts = id.split('-');
  return parts[0].charAt(0) + parts.slice(1).join('');
}

// Ordered literal string substitutions that rewrite every head-owned token to the
// variant's own. Applied to inherited (non-fresh) sections so NO head category
// label, clip id, screenId, beatId, or rule-id prefix ever survives onto a variant.
export function variantSubstitutions(
  beat: BeatEntry,
  head: BeatEntry,
): readonly (readonly [string, string])[] {
  const subs: [string, string][] = [];
  const headCat = head.props?.category;
  const varCat = beat.props?.category;
  if (headCat && varCat && headCat !== varCat) subs.push([headCat, varCat]);
  // tile-count phrase ("4 tiles" -> "3 tiles"), anchored by the " tiles" suffix so
  // a bare digit is never globally rewritten; keeps substituted prose accurate to
  // the variant's own tile set even in sections that are not freshly derived.
  const headTiles = headCat ? goalsByCategory[headCat] : undefined;
  const varTiles = varCat ? goalsByCategory[varCat] : undefined;
  if (headTiles && varTiles && headTiles.length !== varTiles.length)
    subs.push([`${headTiles.length} tiles`, `${varTiles.length} tiles`]);
  // clip ids, pairwise by position (each head opener clip -> the variant's own clip)
  const n = Math.min(head.script.length, beat.script.length);
  for (let i = 0; i < n; i += 1) {
    const hc = head.script[i]?.clip;
    const vc = beat.script[i]?.clip;
    if (hc && vc && hc !== vc) subs.push([hc, vc]);
  }
  if (head.screenId && beat.screenId && head.screenId !== beat.screenId)
    subs.push([head.screenId, beat.screenId]);
  const hp = rulePrefix(head.id);
  const vp = rulePrefix(beat.id);
  // Skip a head rule-id prefix shorter than 3 chars: a 1-2 char prefix (e.g. the
  // habits head's 'h') is too generic to substring-replace safely — it would rewrite
  // every 'h' in the section. Families with such a short head prefix rebuild their
  // rule-bearing sections (rulesContext/rulesCode/flow/edges) from typed per-family
  // builders instead, so no prefix substitution is needed (mirrors leakTokens' >=3
  // guard in bible-registry-check).
  if (hp !== vp && hp.length >= 3) subs.push([hp, vp]);
  // Skip the beatId substitution when the variant id is a namespaced child of the
  // head id (variant.id starts with head.id, e.g. 'habits-fall-asleep-earlier' under
  // head 'habits'): a global replace of the bare head id would also rewrite the
  // English word it coincides with ('habits') and the variant's own id. For such
  // families the category-sensitive sections that reference the beatId are
  // typed-rebuilt, so no beatId substitution is needed.
  if (head.id !== beat.id && !beat.id.startsWith(head.id)) subs.push([head.id, beat.id]);
  return subs;
}

function applySubs(value: string, subs: readonly (readonly [string, string])[]): string {
  let out = value;
  for (const [from, to] of subs) out = out.split(from).join(to);
  return out;
}

// Deep literal-substitution over an arbitrary JSON-like section value.
function substituteDeep<T>(value: T, subs: readonly (readonly [string, string])[]): T {
  if (typeof value === 'string') return applySubs(value, subs) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => substituteDeep(v, subs)) as unknown as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = substituteDeep(v, subs);
    return out as unknown as T;
  }
  return value;
}

// components (section 3) is DERIVED fresh for a goals-list variant: the on-screen
// tiles come from goalsByCategory[props.category], never the head's tile set.
function deriveVariantComponents(
  beat: BeatEntry,
  head: BeatEntry,
  subs: readonly (readonly [string, string])[],
): NonNullable<BibleSections['components']> | undefined {
  const headSection = head.bible?.components;
  const category = beat.props?.category;
  if (beat.type === 'goals-list' && category && goalsByCategory[category]) {
    const tiles = goalsByCategory[category];
    return {
      rows: [
        { label: 'component (registry key)', value: 'goals-list' },
        {
          label: 'variant',
          value: `category = ${category} (from source props.category: '${category}')`,
        },
        {
          label: 'on-screen tiles',
          value: `${tiles.length} goal tiles for ${category}: ${tiles.join(', ')} (verbatim from GOAL OPTIONS BY CATEGORY), plus a "Create your own" custom-add affordance`,
        },
        { label: 'selection mode', value: 'multi-select, 1 to 2 max, nothing preselected' },
        {
          label: 'exact state',
          value:
            'nothing selected on entry; the "Goals" section label renders above the tiles; a running "n of 2 selected" reflects taps; the Continue affordance advances once 1 to 2 goals are picked',
        },
        {
          label: 'derived (debug, generated never authored)',
          value: `resolved props: { category: '${category}', tileCount: ${tiles.length}, min: 1, max: 2, allowsCustom: true }`,
        },
      ],
      watchOut: `DERIVED per-variant from goalsByCategory['${category}']. The ONLY structural difference across the goals-* beats is the category and its tile set; ${category} carries exactly these ${tiles.length} labels. The "n of 2 selected" counter and Continue affordance are ASSERTED SPEC the render component does not implement yet.`,
      enforcedBy: ['component-registry-check'],
      status: 'app-reconcile-pending',
    };
  }
  // fallback (non-goals-list variant): substitute the head section so no head
  // token leaks; still not a verbatim copy.
  return headSection ? substituteDeep(headSection, subs) : undefined;
}

// voice (section 4) is DERIVED fresh for a variant: perLine clip ids come from the
// beat's OWN script, never the head's clip.
function deriveVariantVoice(
  beat: BeatEntry,
  head: BeatEntry,
  subs: readonly (readonly [string, string])[],
): NonNullable<BibleSections['voice']> | undefined {
  const headSection = head.bible?.voice;
  if (!headSection) return undefined;
  const perLine = beat.script.map((line) => {
    const headLine = headSection.perLine.find((p) => p.seq === line.seq);
    const liveAllowed = headLine?.liveAllowed ?? (line.voice === 'cartesia' ? 'YES' : 'NO');
    const resolvesTo = line.clip
      ? `recorded clip ${line.clip}`
      : line.voice === 'cartesia'
        ? 'live Cartesia (has a {name} slot)'
        : 'silent reveal (no audio)';
    return { seq: line.seq, resolvesTo, liveAllowed };
  });
  return {
    rows: substituteDeep(headSection.rows, subs),
    perLine,
    enforcedBy: headSection.enforcedBy,
    ...(headSection.assertion !== undefined
      ? { assertion: applySubs(headSection.assertion, subs) }
      : {}),
    ...(headSection.status !== undefined ? { status: headSection.status } : {}),
  };
}

// Every-section pending-app-reconcile manifest: the honest "not yet contracted"
// fill for a beat with no bible (or a variant whose head has none). Same token the
// coverage gate treats as legally-pending, so runtime/render/check agree.
function pendingManifest(): Readonly<Record<BibleSectionKey, SectionFillStatus>> {
  const out = {} as Record<BibleSectionKey, SectionFillStatus>;
  for (const key of BIBLE_SECTION_KEYS) out[key] = 'pending-app-reconcile';
  return out;
}

// A variant's manifest is its OWN, never inherited as authorship: a section the
// variant AUTHORS keeps the child's declared status; a derived section is 'derived'
// — UNLESS the head marks it pending/na, which a derived section can't out-contract.
function deriveVariantManifest(
  beat: BeatEntry,
  head: BeatEntry | undefined,
): Readonly<Record<BibleSectionKey, SectionFillStatus>> {
  const childManifest = beat.bible?.sectionManifest;
  const headManifest = head?.bible?.sectionManifest;
  const out = {} as Record<BibleSectionKey, SectionFillStatus>;
  for (const key of BIBLE_SECTION_KEYS) {
    if (beat.bible && key in beat.bible) {
      out[key] = childManifest?.[key] ?? 'filled';
      continue;
    }
    const headStatus = headManifest?.[key];
    out[key] =
      headStatus === 'pending-app-reconcile' ||
      (headStatus !== undefined && typeof headStatus === 'object')
        ? headStatus
        : 'derived';
  }
  return out;
}

// Display resolver for variantOf inheritance (Yair 2026-07-09: beat + sub-beat,
// no copying). One level, no chains. A sub-beat's own AUTHORED section wins
// verbatim. Everything else is DERIVED per-variant, never shallow-copied from the
// head: identity from the beat's own fields, components tiles from
// goalsByCategory[props.category], voice clips from the beat's own script, and
// every remaining inherited section run through variantSubstitutions so no head
// category label / clip id / rule-id prefix / screenId / beatId survives. Only the
// reviewed safe sections (shared rules, tool schemas, generic edges, persistence,
// conversation, applicable decisions, scriptMeta) pass through as substituted
// inheritance. The manifest is per-variant (deriveVariantManifest), so a variant
// never claims authorship it does not have. Pure function, no side effects.
export function resolveBeatStructure(id: string): {
  readonly io?: BeatIO;
  readonly bible?: BibleSections;
  readonly inheritedFrom?: string;
  readonly inheritedSections?: readonly string[];
  readonly derivedSections?: readonly string[];
  // Complete 14-key manifest for EVERY beat (no-bible beats -> all pending-app-reconcile).
  readonly sectionManifest?: Readonly<Record<BibleSectionKey, SectionFillStatus>>;
} {
  const beat = BEAT_BY_ID[id];
  if (!beat) return {};
  if (!beat.variantOf)
    return {
      io: beat.io,
      bible: beat.bible,
      sectionManifest: beat.bible?.sectionManifest ?? pendingManifest(),
    };
  const head = BEAT_BY_ID[beat.variantOf];
  if (!head)
    return {
      io: beat.io,
      bible: beat.bible,
      sectionManifest: beat.bible?.sectionManifest ?? pendingManifest(),
    };

  const io = beat.io ?? head.io;
  const ioInherited = !beat.io && Boolean(head.io);

  let bible: BibleSections | undefined;
  const inheritedSections: string[] = [];
  const derivedSections: string[] = [];

  if (head.bible || beat.bible) {
    const subs = variantSubstitutions(beat, head);
    const headBible = head.bible as Record<string, unknown> | undefined;
    const childBible = beat.bible as Record<string, unknown> | undefined;
    const resolved: Record<string, unknown> = {};

    for (const key of BIBLE_SECTION_KEYS) {
      // 1. child-authored section wins verbatim
      if (childBible && key in childBible) {
        resolved[key] = childBible[key];
        continue;
      }
      // 2. identity is always generated from the beat's own fields
      if (key === 'identity') {
        resolved[key] = deriveVariantIdentity(beat);
        derivedSections.push(key);
        continue;
      }
      // 3. components + voice are derived fresh (tiles / clips are per-variant facts)
      if (key === 'components') {
        const c = deriveVariantComponents(beat, head, subs);
        if (c) {
          resolved[key] = c;
          derivedSections.push(key);
        }
        continue;
      }
      if (key === 'voice') {
        const v = deriveVariantVoice(beat, head, subs);
        if (v) {
          resolved[key] = v;
          derivedSections.push(key);
        }
        continue;
      }
      // 3b. category-sensitive sections (rules / conversation / flow / edges) are
      // BUILT fresh from typed per-category data (goalsCategoryData), never
      // free-text-substituted from the head. This is the B1-R fix: those sections
      // carried the head's lowercased category noun, clip-family roots, and example
      // labels that substitution could not reach. Only when the head actually
      // contracts the section and the variant has category data.
      if (
        beat.type === 'goals-list' &&
        (key === 'rulesContext' || key === 'conversation' || key === 'flow' || key === 'edges') &&
        headBible &&
        key in headBible
      ) {
        const catData = beat.props?.category ? goalsCategoryData[beat.props.category] : undefined;
        if (catData) {
          resolved[key] =
            key === 'rulesContext'
              ? buildGoalsRulesContext(catData)
              : key === 'conversation'
                ? buildGoalsConversation(catData)
                : key === 'flow'
                  ? buildGoalsFlow(catData)
                  : buildGoalsEdges(catData);
          derivedSections.push(key);
          continue;
        }
      }
      // 3b-habits: same typed-path rebuild for the habits family (type
      // 'habit-picker'), keyed by the goal picked upstream (props.goal). It rebuilds
      // the 4 category-sensitive sections PLUS rulesCode — rulesCode is included
      // because the habits head rule prefix ('h') is too short to substitute safely
      // (variantSubstitutions skips it), so building rulesCode per-goal gives each
      // variant unique rule ids without any substitution.
      if (
        beat.type === 'habit-picker' &&
        (key === 'rulesContext' ||
          key === 'conversation' ||
          key === 'flow' ||
          key === 'edges' ||
          key === 'rulesCode') &&
        headBible &&
        key in headBible
      ) {
        const goalData = beat.props?.goal ? habitsGoalData[beat.props.goal] : undefined;
        if (goalData) {
          resolved[key] =
            key === 'rulesContext'
              ? buildHabitsRulesContext(goalData)
              : key === 'conversation'
                ? buildHabitsConversation(goalData)
                : key === 'flow'
                  ? buildHabitsFlow(goalData)
                  : key === 'edges'
                    ? buildHabitsEdges(goalData)
                    : buildHabitsRulesCode(goalData);
          derivedSections.push(key);
          continue;
        }
      }
      // 4. every other inherited section: substitute head tokens out (safe allowlist)
      const headSection = headBible ? headBible[key] : undefined;
      if (headSection === undefined) continue;
      resolved[key] = substituteDeep(headSection, subs);
      derivedSections.push(key);
      inheritedSections.push(key);
    }

    // manifest is per-variant, never inherited
    resolved.sectionManifest = deriveVariantManifest(beat, head);
    bible = resolved as unknown as BibleSections;
  }

  const inheritedFrom = ioInherited || derivedSections.length > 0 ? beat.variantOf : undefined;
  const sectionManifest = bible?.sectionManifest ?? pendingManifest();

  return { io, bible, inheritedFrom, inheritedSections, derivedSections, sectionManifest };
}
