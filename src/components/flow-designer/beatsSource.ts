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
  readonly context: string | null;
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

## Brainstorming (when they're not sure)
- Some users know exactly what they want, others don't. When a beat asks them to choose and they're unsure, stuck, or torn between options, offer to think it through together. Ask one short grounding question, weigh it with them, help them land on one. A real back-and-forth, not a lecture, and not life advice. You're helping them decide, not telling them what to do.
- This shines out loud, on the full-voice path. In text, keep it to a question or two.
- The second they know what they want, take it and move on. Never slow a decisive user down, and never push someone who's ready into a debate they didn't ask for.

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
    {
      id: `${p}-stay-open`,
      rule: 'If the user is unsure, stays open and helps them land, no lecture',
      severity: 'must',
      enforcedBy: ['eval:brainstorm-then-yield'],
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
        on: 'unsure / cannot decide',
        reply:
          'scripted help-you-decide prompt set (e.g. "What\'s been weighing on you most lately?"); yields the instant they lean toward one',
        then: 'wait',
        voice: `clip-family:${root}_4 (pending recording)`,
      },
      {
        on: 'off-topic or world question',
        reply:
          'global rule glob-out-of-scope: one brief acknowledgement, steer back with the goal question',
        then: 'wait',
        voice: 'clip-family:onboard_offtopic_steerback (pending recording)',
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
        behavior: `user will not choose: stay open, help them think it through (${goalsRulePrefix(
          data,
        )}-stay-open), never force a pick`,
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
        on: 'vague or unsure which habit',
        reply:
          'scripted help-you-decide prompt (e.g. "What is one small thing you could actually keep?"); yields the instant they lean toward one',
        then: 'wait',
        voice: `clip-family:${root}_4 (pending recording)`,
      },
      {
        on: 'off-topic or world question',
        reply:
          'global rule glob-out-of-scope: one brief acknowledgement, steer back with the habit question',
        then: 'wait',
        voice: 'clip-family:onboard_offtopic_steerback (pending recording)',
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
    context:
      'BEAT: First hello.\n\nSPEAK MODE: VERBATIM_OPENER\n\nThe orb blooms and you speak for the first time. One warm line that lands the surprise of a real voice and invites them in. Then the flow moves on.',
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
    context:
      'BEAT: Auth.\n\nThe user signs up or logs in by tapping (Apple, Google, or email). This is also where their name is captured. Stay silent. Do not greet, narrate, or call any tool. The flow advances on its own once the user is authenticated.',
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
    context:
      "BEAT: Mic permission.\n\nSPEAK MODE: VERBATIM_OPENER\n\nAsk for the mic so the user can talk to you. Keep it light, optional, no pressure. If they skip it, they can still type, and that's completely fine.",
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
    context:
      "BEAT: Profile greeting.\n\nSPEAK MODE: VERBATIM_OPENER\n\nYou already know the user's name from sign-in. Greet them by name, warmly, and set up the two quick things you're about to collect (age and gender). This beat is only the greeting, spoken live in their name. The asks come next.",
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
    context:
      "BEAT: Profile.\n\nSPEAK MODE: VERBATIM_OPENER\n\nCollect two things: their age and their gender. Ask gender plainly, and never let them skip or decline it. Accept voice or taps. If they give one, ask for the other. Both are required before moving on, gender included. Don't ask for anything else.",
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
        persistence: 'pending-app-reconcile',
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
            voice: 'clip-family:onboard_offtopic_steerback (pending recording)',
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
            pending: true,
          },
          { tool: 'advance_step', args: '{}', when: 'immediately after submit_profile returns' },
        ],
        note: 'No category, goal, or habit tools on this beat; profile capture uses submit_profile only.',
        enforcedBy: ['tool-contract-check'],
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
          persistsTo: 'onboarding_states.data (verify key at app-reconcile)',
        },
        {
          key: 'profile.gender',
          from: 'flow-state',
          writtenBy: 'submit_profile',
          persistsTo: 'onboarding_states.data (verify key at app-reconcile)',
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
    context:
      "BEAT: Check-in (opener for the whole process, plus the first state check).\n\nSPEAK MODE: VERBATIM_OPENER\n\nThe opener frames the whole coaching process: it is built on a few small pieces we go through together on the way in, it is built light for everyone (never done this, or tracks a lot), and each part gets explained as we reach it. Then this first piece: a quick state check-in, done right now. The four questions at the end (how's your sleep, mood, energy, and your stress) are the sync points, each blooms its card as it is asked, said once. Then the same cards are the check-in the user fills.\n\nDO NOT:\n- Say the four twice. They are asked once, as the four questions at the end.\n- Render a second set of cards. These cards ARE the check-in.\n- Give advice on what they report. One warm line, then move on.",
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
        allowedTools: 'pending-app-reconcile',
        persistence: 'pending-app-reconcile',
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
            reveal: 'second framing bubble, GATED on seq 1 clip end',
            timing: 'karaoke per-word on the bubble',
          },
          {
            seq: 3,
            reveal: 'the sleep card blooms, GATED on seq 2 clip end',
            timing: 'karaoke per-word on the sleep question',
          },
          {
            seq: 4,
            reveal: 'the mood card blooms, GATED on seq 3 clip end',
            timing: 'karaoke per-word on the mood question',
          },
          {
            seq: 5,
            reveal: 'the energy card blooms, GATED on seq 4 clip end',
            timing: 'karaoke per-word on the energy question',
          },
          {
            seq: 6,
            reveal: 'the stress card blooms, GATED on seq 5 clip end',
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
          { seq: 2, resolvesTo: 'recorded clip onboard_state_check_2', liveAllowed: 'NO' },
          { seq: 3, resolvesTo: 'recorded clip state_sleep', liveAllowed: 'NO' },
          { seq: 4, resolvesTo: 'recorded clip state_mood', liveAllowed: 'NO' },
          { seq: 5, resolvesTo: 'recorded clip state_energy', liveAllowed: 'NO' },
          { seq: 6, resolvesTo: 'recorded clip state_stress', liveAllowed: 'NO' },
        ],
        assertion:
          'No line here carries a live slot like {name}, so all six spoken lines MUST resolve to recorded clips. No live Cartesia on this beat.',
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
          "I'd like to invite you into a coaching process together. And it's built on a few components we'll go through on the way in. It's built light. I believe less is more, especially in the beginning of a process.",
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
        words:
          "Whether you've never done something like this before or you already track a lot, it is built for you. I'll explain each part as we go. This is the first part, a quick state check-in. And I'd like you to do it right now.",
        bindsTo: {
          kind: 'bubble',
          element: 'bubble-2',
          screen: 'ONBOARD-STATE-CHECK',
        },
        voice: 'mp3',
        clip: 'onboard_state_check_2',
        clipPath: '/voice/ob/onboard_state_check_2.wav',
      },
      {
        seq: 3,
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
        seq: 4,
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
        seq: 5,
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
        seq: 6,
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
          persistsTo: 'app-reconcile-pending',
          note: 'tool binding forked: no beat_contexts entry; record_checkin exists in the API (deep-QA B6)',
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
    context:
      "BEAT: Check-in time.\n\nSPEAK MODE: VERBATIM_OPENER\n\nThe user just did their first check-in. Now set the daily time for it, reminder ON by default. Quick. The point isn't that it's morning, it's that this is their first habit and it's simple.",
    allowedTools: 'submit_morning_checkin, advance_step',
    expectedResponse: 'Sets a time and days',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: null,
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
          "Every day is great, but weekdays consistently beats every day occasionally. That's what I recommend to start.",
        bindsTo: {
          kind: 'bubble',
          element: 'bubble-2',
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
          persistsTo: 'per submit_morning_checkin handler',
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
    context:
      "BEAT: Evening reflection setup.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nSet it up, don't perform it now. The user picks one style and a time, reminder on by default. The three styles are on the screen: suggested template, your template, freeform. Don't read them out. Ask which feels right and let them pick. If they resist, keep it light, it's two minutes a day.\n\nPERSISTS: whatever they pick IS saved as their reflection template, and the daily evening reflection asks based on it, exactly: suggested template -> the three questions (what am I proud of, what do I forgive myself for, what am I grateful for); your template -> their own saved prompts, in order; freeform -> no questions, just talk. If they choose your template, capture their prompts here so the daily reflection can ask them verbatim.\n\nDO NOT:\n- Read the three styles out loud. They're on the screen.\n- Add coaching per style.\n- Make it feel like homework.",
    allowedTools: 'submit_reflection_config, submit_custom_prompts, advance_step',
    expectedResponse: 'Picks a style and time',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: null,
    script: [
      {
        seq: 1,
        words:
          'One more. An evening reflection, a couple of minutes to close out your day. Use these three questions.',
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
          persistsTo: 'reflection_settings',
        },
        {
          key: 'reflection.customPrompts',
          from: 'flow-state',
          writtenBy: 'submit_custom_prompts',
          persistsTo: 'reflection_settings (verbatim under the 280-char cap)',
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
    context:
      'BEAT: Experience fork.\n\nSPEAK MODE: VERBATIM_OPENER + VERBAL_QUESTION\n\nThe framing "For the next part of the process, I\'d like to know:" shows as one coach bubble. Then, as the two path cards appear, the question "Do you already track habits or is this new to you?" is spoken VERBAL ONLY (not a bubble). New, tried and dropped off, or wants guidance, route to beginner. Has a list or a system already, route to advanced. If unclear, ask one short question.\n\nDO NOT:\n- Read the two choices out loud as a list. The cards show them. Ask the question, then wait.\n- Add "both are totally fine" or any filler tail.',
    allowedTools: 'submit_path_choice, ask_clarification, advance_step',
    expectedResponse: 'New, or I already track habits',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: null,
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
          persistsTo: 'onboarding_states.data',
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
    context:
      'BEAT: Focus area.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nCollect one category. The opener "Let\'s choose one area of your life that you\'d like to improve on. Here are our recommended categories." shows as a coach bubble, then the category tiles appear. When the "Create your own" option appears at the end, "Or you can create your own" is spoken VERBAL ONLY (not a bubble). Ask what they most want to work on, then wait. If they\'re unsure, you can talk it through with them and help them land on one, you stay open here. If they name several, ask which feels most urgent. Keep the response specific to their pick.\n\nDO NOT:\n- Read the categories out loud. They\'re on the screen.\n- Add commentary per category ("sleep is the foundation", and the like).\n- Praise the pick ("great choice", "love that").\n- Allow more than one. If they name two, ask which feels most urgent.\n- Say anything after they pick except calling submit_category and advance_step.',
    allowedTools: 'submit_category, advance_step',
    expectedResponse: 'Names or picks one category',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: null,
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
    context:
      'BEAT: Focus area.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nCollect one category. The opener "Let\'s choose one area of your life that you\'d like to improve on. Here are our recommended categories." shows as a coach bubble, then the category tiles appear. When the "Create your own" option appears at the end, "Or you can create your own" is spoken VERBAL ONLY (not a bubble). Ask what they most want to work on, then wait. If they\'re unsure, you can talk it through with them and help them land on one, you stay open here. If they name several, ask which feels most urgent. Keep the response specific to their pick.\n\nDO NOT:\n- Read the categories out loud. They\'re on the screen.\n- Add commentary per category ("sleep is the foundation", and the like).\n- Praise the pick ("great choice", "love that").\n- Allow more than one. If they name two, ask which feels most urgent.\n- Say anything after they pick except calling submit_category and advance_step.',
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
        {
          id: 'catw-stay-open',
          rule: 'If the user is unsure, stays open and helps them land on one, no lecture',
          severity: 'must',
          enforcedBy: ['eval:brainstorm-then-yield'],
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
            on: 'unsure / cannot decide',
            reply:
              'scripted help-you-decide prompt set (e.g. "What\'s been weighing on you most lately?"); yields the instant they lean toward one',
            then: 'wait',
            voice: 'clip-family:onboard_category_women_4 (pending recording)',
          },
          {
            on: 'off-topic or world question',
            reply:
              'global rule glob-out-of-scope: one brief acknowledgement, steer back with the category question',
            then: 'wait',
            voice: 'clip-family:onboard_offtopic_steerback (pending recording)',
          },
        ],
        maxTurns: 4,
        onMaxTurns: 'plain one-line re-ask of the category question and point to the tap path',
      },
      contextProse: {
        prose:
          'Focus area. Collect one category. The opener shows as a coach bubble, then the category tiles appear (women-art illustration set). When the create-your-own option appears at the end, "Or you can create your own" is spoken verbal only. Ask what they most want to work on, then wait. If they are unsure, you can talk it through with them and help them land on one. If they name several, ask which feels most urgent. Keep the response specific to their pick.',
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
              'user will not choose: stay open, help them think it through (catw-stay-open), never force',
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
    context:
      'BEAT: Goals.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nInside the chosen category, collect one or two goals (the screen labels them "Goals"). The valid goals for their category are on the screen and in your reference list. Map what they say to the exact label. If they speak generally, map to the closest one or ask one short question. One or two, no more.\n\nBRANCH THIS SETS UP: two goals means the next beat gives one habit per goal (one each). One goal means the next beat allows one or two habits. Save the count so the habit beat can branch.\n\nDO NOT:\n- Read the goals out loud. They\'re on the screen.\n- Invent, rename, or shorten a label. Use the exact strings from the reference list.\n- Allow more than two. If they name three, ask which two matter most.\n- Coach or explain per goal.',
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
        {
          id: 'gsleep-stay-open',
          rule: 'If the user is unsure, stays open and helps them land, no lecture',
          severity: 'must',
          enforcedBy: ['eval:brainstorm-then-yield'],
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
            on: 'unsure / cannot decide',
            reply:
              'scripted help-you-decide prompt set (e.g. "What\'s been weighing on you most lately?"); yields the instant they lean toward one',
            then: 'wait',
            voice: 'clip-family:onboard_goals_sleep_4 (pending recording)',
          },
          {
            on: 'off-topic or world question',
            reply:
              'global rule glob-out-of-scope: one brief acknowledgement, steer back with the goal question',
            then: 'wait',
            voice: 'clip-family:onboard_offtopic_steerback (pending recording)',
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
              'user will not choose: stay open, help them think it through (gsleep-stay-open), never force a pick',
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
    context:
      'BEAT: Goals.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nInside the chosen category, collect one or two goals (the screen labels them "Goals"). The valid goals for their category are on the screen and in your reference list. Map what they say to the exact label. If they speak generally, map to the closest one or ask one short question. One or two, no more.\n\nBRANCH THIS SETS UP: two goals means the next beat gives one habit per goal (one each). One goal means the next beat allows one or two habits. Save the count so the habit beat can branch.\n\nDO NOT:\n- Read the goals out loud. They\'re on the screen.\n- Invent, rename, or shorten a label. Use the exact strings from the reference list.\n- Allow more than two. If they name three, ask which two matter most.\n- Coach or explain per goal.',
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
    context:
      'BEAT: Goals.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nInside the chosen category, collect one or two goals (the screen labels them "Goals"). The valid goals for their category are on the screen and in your reference list. Map what they say to the exact label. If they speak generally, map to the closest one or ask one short question. One or two, no more.\n\nBRANCH THIS SETS UP: two goals means the next beat gives one habit per goal (one each). One goal means the next beat allows one or two habits. Save the count so the habit beat can branch.\n\nDO NOT:\n- Read the goals out loud. They\'re on the screen.\n- Invent, rename, or shorten a label. Use the exact strings from the reference list.\n- Allow more than two. If they name three, ask which two matter most.\n- Coach or explain per goal.',
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
    context:
      'BEAT: Goals.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nInside the chosen category, collect one or two goals (the screen labels them "Goals"). The valid goals for their category are on the screen and in your reference list. Map what they say to the exact label. If they speak generally, map to the closest one or ask one short question. One or two, no more.\n\nBRANCH THIS SETS UP: two goals means the next beat gives one habit per goal (one each). One goal means the next beat allows one or two habits. Save the count so the habit beat can branch.\n\nDO NOT:\n- Read the goals out loud. They\'re on the screen.\n- Invent, rename, or shorten a label. Use the exact strings from the reference list.\n- Allow more than two. If they name three, ask which two matter most.\n- Coach or explain per goal.',
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
    context:
      'BEAT: Goals.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nInside the chosen category, collect one or two goals (the screen labels them "Goals"). The valid goals for their category are on the screen and in your reference list. Map what they say to the exact label. If they speak generally, map to the closest one or ask one short question. One or two, no more.\n\nBRANCH THIS SETS UP: two goals means the next beat gives one habit per goal (one each). One goal means the next beat allows one or two habits. Save the count so the habit beat can branch.\n\nDO NOT:\n- Read the goals out loud. They\'re on the screen.\n- Invent, rename, or shorten a label. Use the exact strings from the reference list.\n- Allow more than two. If they name three, ask which two matter most.\n- Coach or explain per goal.',
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
    context:
      'BEAT: Goals.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nInside the chosen category, collect one or two goals (the screen labels them "Goals"). The valid goals for their category are on the screen and in your reference list. Map what they say to the exact label. If they speak generally, map to the closest one or ask one short question. One or two, no more.\n\nBRANCH THIS SETS UP: two goals means the next beat gives one habit per goal (one each). One goal means the next beat allows one or two habits. Save the count so the habit beat can branch.\n\nDO NOT:\n- Read the goals out loud. They\'re on the screen.\n- Invent, rename, or shorten a label. Use the exact strings from the reference list.\n- Allow more than two. If they name three, ask which two matter most.\n- Coach or explain per goal.',
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
    context:
      'BEAT: Goals.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nInside the chosen category, collect one or two goals (the screen labels them "Goals"). The valid goals for their category are on the screen and in your reference list. Map what they say to the exact label. If they speak generally, map to the closest one or ask one short question. One or two, no more.\n\nBRANCH THIS SETS UP: two goals means the next beat gives one habit per goal (one each). One goal means the next beat allows one or two habits. Save the count so the habit beat can branch.\n\nDO NOT:\n- Read the goals out loud. They\'re on the screen.\n- Invent, rename, or shorten a label. Use the exact strings from the reference list.\n- Allow more than two. If they name three, ask which two matter most.\n- Coach or explain per goal.',
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
    context:
      'BEAT: Goals.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nInside the chosen category, collect one or two goals (the screen labels them "Goals"). The valid goals for their category are on the screen and in your reference list. Map what they say to the exact label. If they speak generally, map to the closest one or ask one short question. One or two, no more.\n\nBRANCH THIS SETS UP: two goals means the next beat gives one habit per goal (one each). One goal means the next beat allows one or two habits. Save the count so the habit beat can branch.\n\nDO NOT:\n- Read the goals out loud. They\'re on the screen.\n- Invent, rename, or shorten a label. Use the exact strings from the reference list.\n- Allow more than two. If they name three, ask which two matter most.\n- Coach or explain per goal.',
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
    allowedTools: null,
    expectedResponse: 'Names their own goal',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      kind: 'goal',
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
          persistsTo: 'onboarding_states.data (verify key)',
          note: 'save tool unresolved (app-reconcile-pending)',
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
    context:
      "BEAT: Habit selection.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nBRANCHES ON THE GOALS PICKED:\n- Two goals chosen: one habit per goal (two total, one each). Show one panel per goal and collect exactly one habit from each.\n- One goal chosen: one or two habits for that goal.\n\nThe habit options for the user's goals are on the screen and in your reference list. That list is for matching the user's words to a canonical habit name only. It is not a list to read aloud, not in full, not in part, not the sub-lists either. Match what they say to the closest canonical name. Accept a custom habit only if they offer something not on the list (\"Create your own\"). At least one to continue. Less is more: the check-in is already a habit, so one or two more is plenty, and one is totally fine. Keep it small on purpose, they can build on it later.\n\nDO NOT:\n- Read the habit list out loud, in full or in part, not even one as an example. The screen shows them.\n- Read sub-lists or anything the screen isn't currently showing.\n- Name or describe habits beyond what the user has picked.\n- Invent habit names not on the list.\n- With two goals, take more than one habit for a single goal. One per goal.\n- Add commentary or motivation after each pick.",
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
            on: 'vague or unsure which habit',
            reply:
              'scripted help-you-decide prompt (e.g. "What is one small thing you could actually keep?"); yields the instant they lean toward one',
            then: 'wait',
            voice: 'clip-family:onboard_beginner_03_4 (pending recording)',
          },
          {
            on: 'off-topic or world question',
            reply:
              'global rule glob-out-of-scope: one brief acknowledgement, steer back with the habit question',
            then: 'wait',
            voice: 'clip-family:onboard_offtopic_steerback (pending recording)',
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
            args: '{ habit: string } - one canonical habit name from the on-screen list for the picked goal, or a custom name the user offered (confirm canonical arg name/shape)',
            when: 'as each habit is picked, within the cap',
            pending: true,
          },
          {
            tool: 'remove_habit',
            args: '{ habit: string } - the canonical habit name to remove',
            when: 'when the user unpicks a habit before advancing',
            pending: true,
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
              'the chosen habits (1 or 2, capped at 2; one per goal when two goals were picked)',
          },
          {
            label: 'never re-ask',
            value:
              'the habits, once captured, carry forward; downstream beats read them, never re-prompt',
          },
          {
            label: 'resume key',
            value: 'current_step advanced past this beat proves the habit pick is done on refresh',
          },
        ],
        watchOut:
          'The exact table + column for the habits write is NOT confirmed in the render source (io.dataOut notes the addHabit handler, cap 2 per decision 4/5). Flagged for app-reconcile; do not invent a table name. The carry-forward contract (never re-ask habits) is from GLOBAL_CONTEXT and is real.',
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
          persistsTo: 'per addHabit handler, cap 2 (decision 4/5)',
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
    context:
      "BEAT: Habit selection.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nBRANCHES ON THE GOALS PICKED:\n- Two goals chosen: one habit per goal (two total, one each). Show one panel per goal and collect exactly one habit from each.\n- One goal chosen: one or two habits for that goal.\n\nThe habit options for the user's goals are on the screen and in your reference list. That list is for matching the user's words to a canonical habit name only. It is not a list to read aloud, not in full, not in part, not the sub-lists either. Match what they say to the closest canonical name. Accept a custom habit only if they offer something not on the list (\"Create your own\"). At least one to continue. Less is more: the check-in is already a habit, so one or two more is plenty, and one is totally fine. Keep it small on purpose, they can build on it later.\n\nDO NOT:\n- Read the habit list out loud, in full or in part, not even one as an example. The screen shows them.\n- Read sub-lists or anything the screen isn't currently showing.\n- Name or describe habits beyond what the user has picked.\n- Invent habit names not on the list.\n- With two goals, take more than one habit for a single goal. One per goal.\n- Add commentary or motivation after each pick.",
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
    context:
      "BEAT: Habit selection.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nBRANCHES ON THE GOALS PICKED:\n- Two goals chosen: one habit per goal (two total, one each). Show one panel per goal and collect exactly one habit from each.\n- One goal chosen: one or two habits for that goal.\n\nThe habit options for the user's goals are on the screen and in your reference list. That list is for matching the user's words to a canonical habit name only. It is not a list to read aloud, not in full, not in part, not the sub-lists either. Match what they say to the closest canonical name. Accept a custom habit only if they offer something not on the list (\"Create your own\"). At least one to continue. Less is more: the check-in is already a habit, so one or two more is plenty, and one is totally fine. Keep it small on purpose, they can build on it later.\n\nDO NOT:\n- Read the habit list out loud, in full or in part, not even one as an example. The screen shows them.\n- Read sub-lists or anything the screen isn't currently showing.\n- Name or describe habits beyond what the user has picked.\n- Invent habit names not on the list.\n- With two goals, take more than one habit for a single goal. One per goal.\n- Add commentary or motivation after each pick.",
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
    context:
      "BEAT: Habit selection.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nBRANCHES ON THE GOALS PICKED:\n- Two goals chosen: one habit per goal (two total, one each). Show one panel per goal and collect exactly one habit from each.\n- One goal chosen: one or two habits for that goal.\n\nThe habit options for the user's goals are on the screen and in your reference list. That list is for matching the user's words to a canonical habit name only. It is not a list to read aloud, not in full, not in part, not the sub-lists either. Match what they say to the closest canonical name. Accept a custom habit only if they offer something not on the list (\"Create your own\"). At least one to continue. Less is more: the check-in is already a habit, so one or two more is plenty, and one is totally fine. Keep it small on purpose, they can build on it later.\n\nDO NOT:\n- Read the habit list out loud, in full or in part, not even one as an example. The screen shows them.\n- Read sub-lists or anything the screen isn't currently showing.\n- Name or describe habits beyond what the user has picked.\n- Invent habit names not on the list.\n- With two goals, take more than one habit for a single goal. One per goal.\n- Add commentary or motivation after each pick.",
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
    context:
      "BEAT: Habit selection.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nBRANCHES ON THE GOALS PICKED:\n- Two goals chosen: one habit per goal (two total, one each). Show one panel per goal and collect exactly one habit from each.\n- One goal chosen: one or two habits for that goal.\n\nThe habit options for the user's goals are on the screen and in your reference list. That list is for matching the user's words to a canonical habit name only. It is not a list to read aloud, not in full, not in part, not the sub-lists either. Match what they say to the closest canonical name. Accept a custom habit only if they offer something not on the list (\"Create your own\"). At least one to continue. Less is more: the check-in is already a habit, so one or two more is plenty, and one is totally fine. Keep it small on purpose, they can build on it later.\n\nDO NOT:\n- Read the habit list out loud, in full or in part, not even one as an example. The screen shows them.\n- Read sub-lists or anything the screen isn't currently showing.\n- Name or describe habits beyond what the user has picked.\n- Invent habit names not on the list.\n- With two goals, take more than one habit for a single goal. One per goal.\n- Add commentary or motivation after each pick.",
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
    context:
      "BEAT: Habit selection.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nBRANCHES ON THE GOALS PICKED:\n- Two goals chosen: one habit per goal (two total, one each). Show one panel per goal and collect exactly one habit from each.\n- One goal chosen: one or two habits for that goal.\n\nThe habit options for the user's goals are on the screen and in your reference list. That list is for matching the user's words to a canonical habit name only. It is not a list to read aloud, not in full, not in part, not the sub-lists either. Match what they say to the closest canonical name. Accept a custom habit only if they offer something not on the list (\"Create your own\"). At least one to continue. Less is more: the check-in is already a habit, so one or two more is plenty, and one is totally fine. Keep it small on purpose, they can build on it later.\n\nDO NOT:\n- Read the habit list out loud, in full or in part, not even one as an example. The screen shows them.\n- Read sub-lists or anything the screen isn't currently showing.\n- Name or describe habits beyond what the user has picked.\n- Invent habit names not on the list.\n- With two goals, take more than one habit for a single goal. One per goal.\n- Add commentary or motivation after each pick.",
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
    context:
      "BEAT: Habit selection.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nBRANCHES ON THE GOALS PICKED:\n- Two goals chosen: one habit per goal (two total, one each). Show one panel per goal and collect exactly one habit from each.\n- One goal chosen: one or two habits for that goal.\n\nThe habit options for the user's goals are on the screen and in your reference list. That list is for matching the user's words to a canonical habit name only. It is not a list to read aloud, not in full, not in part, not the sub-lists either. Match what they say to the closest canonical name. Accept a custom habit only if they offer something not on the list (\"Create your own\"). At least one to continue. Less is more: the check-in is already a habit, so one or two more is plenty, and one is totally fine. Keep it small on purpose, they can build on it later.\n\nDO NOT:\n- Read the habit list out loud, in full or in part, not even one as an example. The screen shows them.\n- Read sub-lists or anything the screen isn't currently showing.\n- Name or describe habits beyond what the user has picked.\n- Invent habit names not on the list.\n- With two goals, take more than one habit for a single goal. One per goal.\n- Add commentary or motivation after each pick.",
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
    context:
      "BEAT: Habit selection.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nBRANCHES ON THE GOALS PICKED:\n- Two goals chosen: one habit per goal (two total, one each). Show one panel per goal and collect exactly one habit from each.\n- One goal chosen: one or two habits for that goal.\n\nThe habit options for the user's goals are on the screen and in your reference list. That list is for matching the user's words to a canonical habit name only. It is not a list to read aloud, not in full, not in part, not the sub-lists either. Match what they say to the closest canonical name. Accept a custom habit only if they offer something not on the list (\"Create your own\"). At least one to continue. Less is more: the check-in is already a habit, so one or two more is plenty, and one is totally fine. Keep it small on purpose, they can build on it later.\n\nDO NOT:\n- Read the habit list out loud, in full or in part, not even one as an example. The screen shows them.\n- Read sub-lists or anything the screen isn't currently showing.\n- Name or describe habits beyond what the user has picked.\n- Invent habit names not on the list.\n- With two goals, take more than one habit for a single goal. One per goal.\n- Add commentary or motivation after each pick.",
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
    context:
      "BEAT: Habit selection.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nBRANCHES ON THE GOALS PICKED:\n- Two goals chosen: one habit per goal (two total, one each). Show one panel per goal and collect exactly one habit from each.\n- One goal chosen: one or two habits for that goal.\n\nThe habit options for the user's goals are on the screen and in your reference list. That list is for matching the user's words to a canonical habit name only. It is not a list to read aloud, not in full, not in part, not the sub-lists either. Match what they say to the closest canonical name. Accept a custom habit only if they offer something not on the list (\"Create your own\"). At least one to continue. Less is more: the check-in is already a habit, so one or two more is plenty, and one is totally fine. Keep it small on purpose, they can build on it later.\n\nDO NOT:\n- Read the habit list out loud, in full or in part, not even one as an example. The screen shows them.\n- Read sub-lists or anything the screen isn't currently showing.\n- Name or describe habits beyond what the user has picked.\n- Invent habit names not on the list.\n- With two goals, take more than one habit for a single goal. One per goal.\n- Add commentary or motivation after each pick.",
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
    context:
      "BEAT: Habit selection.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nBRANCHES ON THE GOALS PICKED:\n- Two goals chosen: one habit per goal (two total, one each). Show one panel per goal and collect exactly one habit from each.\n- One goal chosen: one or two habits for that goal.\n\nThe habit options for the user's goals are on the screen and in your reference list. That list is for matching the user's words to a canonical habit name only. It is not a list to read aloud, not in full, not in part, not the sub-lists either. Match what they say to the closest canonical name. Accept a custom habit only if they offer something not on the list (\"Create your own\"). At least one to continue. Less is more: the check-in is already a habit, so one or two more is plenty, and one is totally fine. Keep it small on purpose, they can build on it later.\n\nDO NOT:\n- Read the habit list out loud, in full or in part, not even one as an example. The screen shows them.\n- Read sub-lists or anything the screen isn't currently showing.\n- Name or describe habits beyond what the user has picked.\n- Invent habit names not on the list.\n- With two goals, take more than one habit for a single goal. One per goal.\n- Add commentary or motivation after each pick.",
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
    context:
      "BEAT: Habit selection.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nBRANCHES ON THE GOALS PICKED:\n- Two goals chosen: one habit per goal (two total, one each). Show one panel per goal and collect exactly one habit from each.\n- One goal chosen: one or two habits for that goal.\n\nThe habit options for the user's goals are on the screen and in your reference list. That list is for matching the user's words to a canonical habit name only. It is not a list to read aloud, not in full, not in part, not the sub-lists either. Match what they say to the closest canonical name. Accept a custom habit only if they offer something not on the list (\"Create your own\"). At least one to continue. Less is more: the check-in is already a habit, so one or two more is plenty, and one is totally fine. Keep it small on purpose, they can build on it later.\n\nDO NOT:\n- Read the habit list out loud, in full or in part, not even one as an example. The screen shows them.\n- Read sub-lists or anything the screen isn't currently showing.\n- Name or describe habits beyond what the user has picked.\n- Invent habit names not on the list.\n- With two goals, take more than one habit for a single goal. One per goal.\n- Add commentary or motivation after each pick.",
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
    context:
      "BEAT: Habit selection.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nBRANCHES ON THE GOALS PICKED:\n- Two goals chosen: one habit per goal (two total, one each). Show one panel per goal and collect exactly one habit from each.\n- One goal chosen: one or two habits for that goal.\n\nThe habit options for the user's goals are on the screen and in your reference list. That list is for matching the user's words to a canonical habit name only. It is not a list to read aloud, not in full, not in part, not the sub-lists either. Match what they say to the closest canonical name. Accept a custom habit only if they offer something not on the list (\"Create your own\"). At least one to continue. Less is more: the check-in is already a habit, so one or two more is plenty, and one is totally fine. Keep it small on purpose, they can build on it later.\n\nDO NOT:\n- Read the habit list out loud, in full or in part, not even one as an example. The screen shows them.\n- Read sub-lists or anything the screen isn't currently showing.\n- Name or describe habits beyond what the user has picked.\n- Invent habit names not on the list.\n- With two goals, take more than one habit for a single goal. One per goal.\n- Add commentary or motivation after each pick.",
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
    context:
      "BEAT: Habit selection.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nBRANCHES ON THE GOALS PICKED:\n- Two goals chosen: one habit per goal (two total, one each). Show one panel per goal and collect exactly one habit from each.\n- One goal chosen: one or two habits for that goal.\n\nThe habit options for the user's goals are on the screen and in your reference list. That list is for matching the user's words to a canonical habit name only. It is not a list to read aloud, not in full, not in part, not the sub-lists either. Match what they say to the closest canonical name. Accept a custom habit only if they offer something not on the list (\"Create your own\"). At least one to continue. Less is more: the check-in is already a habit, so one or two more is plenty, and one is totally fine. Keep it small on purpose, they can build on it later.\n\nDO NOT:\n- Read the habit list out loud, in full or in part, not even one as an example. The screen shows them.\n- Read sub-lists or anything the screen isn't currently showing.\n- Name or describe habits beyond what the user has picked.\n- Invent habit names not on the list.\n- With two goals, take more than one habit for a single goal. One per goal.\n- Add commentary or motivation after each pick.",
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
    context:
      "BEAT: Habit selection.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nBRANCHES ON THE GOALS PICKED:\n- Two goals chosen: one habit per goal (two total, one each). Show one panel per goal and collect exactly one habit from each.\n- One goal chosen: one or two habits for that goal.\n\nThe habit options for the user's goals are on the screen and in your reference list. That list is for matching the user's words to a canonical habit name only. It is not a list to read aloud, not in full, not in part, not the sub-lists either. Match what they say to the closest canonical name. Accept a custom habit only if they offer something not on the list (\"Create your own\"). At least one to continue. Less is more: the check-in is already a habit, so one or two more is plenty, and one is totally fine. Keep it small on purpose, they can build on it later.\n\nDO NOT:\n- Read the habit list out loud, in full or in part, not even one as an example. The screen shows them.\n- Read sub-lists or anything the screen isn't currently showing.\n- Name or describe habits beyond what the user has picked.\n- Invent habit names not on the list.\n- With two goals, take more than one habit for a single goal. One per goal.\n- Add commentary or motivation after each pick.",
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
    context:
      "BEAT: Habit selection.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nBRANCHES ON THE GOALS PICKED:\n- Two goals chosen: one habit per goal (two total, one each). Show one panel per goal and collect exactly one habit from each.\n- One goal chosen: one or two habits for that goal.\n\nThe habit options for the user's goals are on the screen and in your reference list. That list is for matching the user's words to a canonical habit name only. It is not a list to read aloud, not in full, not in part, not the sub-lists either. Match what they say to the closest canonical name. Accept a custom habit only if they offer something not on the list (\"Create your own\"). At least one to continue. Less is more: the check-in is already a habit, so one or two more is plenty, and one is totally fine. Keep it small on purpose, they can build on it later.\n\nDO NOT:\n- Read the habit list out loud, in full or in part, not even one as an example. The screen shows them.\n- Read sub-lists or anything the screen isn't currently showing.\n- Name or describe habits beyond what the user has picked.\n- Invent habit names not on the list.\n- With two goals, take more than one habit for a single goal. One per goal.\n- Add commentary or motivation after each pick.",
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
    context:
      "BEAT: Habit selection.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nBRANCHES ON THE GOALS PICKED:\n- Two goals chosen: one habit per goal (two total, one each). Show one panel per goal and collect exactly one habit from each.\n- One goal chosen: one or two habits for that goal.\n\nThe habit options for the user's goals are on the screen and in your reference list. That list is for matching the user's words to a canonical habit name only. It is not a list to read aloud, not in full, not in part, not the sub-lists either. Match what they say to the closest canonical name. Accept a custom habit only if they offer something not on the list (\"Create your own\"). At least one to continue. Less is more: the check-in is already a habit, so one or two more is plenty, and one is totally fine. Keep it small on purpose, they can build on it later.\n\nDO NOT:\n- Read the habit list out loud, in full or in part, not even one as an example. The screen shows them.\n- Read sub-lists or anything the screen isn't currently showing.\n- Name or describe habits beyond what the user has picked.\n- Invent habit names not on the list.\n- With two goals, take more than one habit for a single goal. One per goal.\n- Add commentary or motivation after each pick.",
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
    context:
      "BEAT: Habit selection.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nBRANCHES ON THE GOALS PICKED:\n- Two goals chosen: one habit per goal (two total, one each). Show one panel per goal and collect exactly one habit from each.\n- One goal chosen: one or two habits for that goal.\n\nThe habit options for the user's goals are on the screen and in your reference list. That list is for matching the user's words to a canonical habit name only. It is not a list to read aloud, not in full, not in part, not the sub-lists either. Match what they say to the closest canonical name. Accept a custom habit only if they offer something not on the list (\"Create your own\"). At least one to continue. Less is more: the check-in is already a habit, so one or two more is plenty, and one is totally fine. Keep it small on purpose, they can build on it later.\n\nDO NOT:\n- Read the habit list out loud, in full or in part, not even one as an example. The screen shows them.\n- Read sub-lists or anything the screen isn't currently showing.\n- Name or describe habits beyond what the user has picked.\n- Invent habit names not on the list.\n- With two goals, take more than one habit for a single goal. One per goal.\n- Add commentary or motivation after each pick.",
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
    context:
      "BEAT: Habit selection.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nBRANCHES ON THE GOALS PICKED:\n- Two goals chosen: one habit per goal (two total, one each). Show one panel per goal and collect exactly one habit from each.\n- One goal chosen: one or two habits for that goal.\n\nThe habit options for the user's goals are on the screen and in your reference list. That list is for matching the user's words to a canonical habit name only. It is not a list to read aloud, not in full, not in part, not the sub-lists either. Match what they say to the closest canonical name. Accept a custom habit only if they offer something not on the list (\"Create your own\"). At least one to continue. Less is more: the check-in is already a habit, so one or two more is plenty, and one is totally fine. Keep it small on purpose, they can build on it later.\n\nDO NOT:\n- Read the habit list out loud, in full or in part, not even one as an example. The screen shows them.\n- Read sub-lists or anything the screen isn't currently showing.\n- Name or describe habits beyond what the user has picked.\n- Invent habit names not on the list.\n- With two goals, take more than one habit for a single goal. One per goal.\n- Add commentary or motivation after each pick.",
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
    context:
      "BEAT: Habit selection.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nBRANCHES ON THE GOALS PICKED:\n- Two goals chosen: one habit per goal (two total, one each). Show one panel per goal and collect exactly one habit from each.\n- One goal chosen: one or two habits for that goal.\n\nThe habit options for the user's goals are on the screen and in your reference list. That list is for matching the user's words to a canonical habit name only. It is not a list to read aloud, not in full, not in part, not the sub-lists either. Match what they say to the closest canonical name. Accept a custom habit only if they offer something not on the list (\"Create your own\"). At least one to continue. Less is more: the check-in is already a habit, so one or two more is plenty, and one is totally fine. Keep it small on purpose, they can build on it later.\n\nDO NOT:\n- Read the habit list out loud, in full or in part, not even one as an example. The screen shows them.\n- Read sub-lists or anything the screen isn't currently showing.\n- Name or describe habits beyond what the user has picked.\n- Invent habit names not on the list.\n- With two goals, take more than one habit for a single goal. One per goal.\n- Add commentary or motivation after each pick.",
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
    context:
      "BEAT: Habit selection.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nBRANCHES ON THE GOALS PICKED:\n- Two goals chosen: one habit per goal (two total, one each). Show one panel per goal and collect exactly one habit from each.\n- One goal chosen: one or two habits for that goal.\n\nThe habit options for the user's goals are on the screen and in your reference list. That list is for matching the user's words to a canonical habit name only. It is not a list to read aloud, not in full, not in part, not the sub-lists either. Match what they say to the closest canonical name. Accept a custom habit only if they offer something not on the list (\"Create your own\"). At least one to continue. Less is more: the check-in is already a habit, so one or two more is plenty, and one is totally fine. Keep it small on purpose, they can build on it later.\n\nDO NOT:\n- Read the habit list out loud, in full or in part, not even one as an example. The screen shows them.\n- Read sub-lists or anything the screen isn't currently showing.\n- Name or describe habits beyond what the user has picked.\n- Invent habit names not on the list.\n- With two goals, take more than one habit for a single goal. One per goal.\n- Add commentary or motivation after each pick.",
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
    context:
      "BEAT: Habit selection.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nBRANCHES ON THE GOALS PICKED:\n- Two goals chosen: one habit per goal (two total, one each). Show one panel per goal and collect exactly one habit from each.\n- One goal chosen: one or two habits for that goal.\n\nThe habit options for the user's goals are on the screen and in your reference list. That list is for matching the user's words to a canonical habit name only. It is not a list to read aloud, not in full, not in part, not the sub-lists either. Match what they say to the closest canonical name. Accept a custom habit only if they offer something not on the list (\"Create your own\"). At least one to continue. Less is more: the check-in is already a habit, so one or two more is plenty, and one is totally fine. Keep it small on purpose, they can build on it later.\n\nDO NOT:\n- Read the habit list out loud, in full or in part, not even one as an example. The screen shows them.\n- Read sub-lists or anything the screen isn't currently showing.\n- Name or describe habits beyond what the user has picked.\n- Invent habit names not on the list.\n- With two goals, take more than one habit for a single goal. One per goal.\n- Add commentary or motivation after each pick.",
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
    context:
      "BEAT: Habit selection.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nBRANCHES ON THE GOALS PICKED:\n- Two goals chosen: one habit per goal (two total, one each). Show one panel per goal and collect exactly one habit from each.\n- One goal chosen: one or two habits for that goal.\n\nThe habit options for the user's goals are on the screen and in your reference list. That list is for matching the user's words to a canonical habit name only. It is not a list to read aloud, not in full, not in part, not the sub-lists either. Match what they say to the closest canonical name. Accept a custom habit only if they offer something not on the list (\"Create your own\"). At least one to continue. Less is more: the check-in is already a habit, so one or two more is plenty, and one is totally fine. Keep it small on purpose, they can build on it later.\n\nDO NOT:\n- Read the habit list out loud, in full or in part, not even one as an example. The screen shows them.\n- Read sub-lists or anything the screen isn't currently showing.\n- Name or describe habits beyond what the user has picked.\n- Invent habit names not on the list.\n- With two goals, take more than one habit for a single goal. One per goal.\n- Add commentary or motivation after each pick.",
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
    context:
      "BEAT: Habit selection.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nBRANCHES ON THE GOALS PICKED:\n- Two goals chosen: one habit per goal (two total, one each). Show one panel per goal and collect exactly one habit from each.\n- One goal chosen: one or two habits for that goal.\n\nThe habit options for the user's goals are on the screen and in your reference list. That list is for matching the user's words to a canonical habit name only. It is not a list to read aloud, not in full, not in part, not the sub-lists either. Match what they say to the closest canonical name. Accept a custom habit only if they offer something not on the list (\"Create your own\"). At least one to continue. Less is more: the check-in is already a habit, so one or two more is plenty, and one is totally fine. Keep it small on purpose, they can build on it later.\n\nDO NOT:\n- Read the habit list out loud, in full or in part, not even one as an example. The screen shows them.\n- Read sub-lists or anything the screen isn't currently showing.\n- Name or describe habits beyond what the user has picked.\n- Invent habit names not on the list.\n- With two goals, take more than one habit for a single goal. One per goal.\n- Add commentary or motivation after each pick.",
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
    context:
      "BEAT: Habit selection.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nBRANCHES ON THE GOALS PICKED:\n- Two goals chosen: one habit per goal (two total, one each). Show one panel per goal and collect exactly one habit from each.\n- One goal chosen: one or two habits for that goal.\n\nThe habit options for the user's goals are on the screen and in your reference list. That list is for matching the user's words to a canonical habit name only. It is not a list to read aloud, not in full, not in part, not the sub-lists either. Match what they say to the closest canonical name. Accept a custom habit only if they offer something not on the list (\"Create your own\"). At least one to continue. Less is more: the check-in is already a habit, so one or two more is plenty, and one is totally fine. Keep it small on purpose, they can build on it later.\n\nDO NOT:\n- Read the habit list out loud, in full or in part, not even one as an example. The screen shows them.\n- Read sub-lists or anything the screen isn't currently showing.\n- Name or describe habits beyond what the user has picked.\n- Invent habit names not on the list.\n- With two goals, take more than one habit for a single goal. One per goal.\n- Add commentary or motivation after each pick.",
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
    context:
      "BEAT: Habit selection.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nBRANCHES ON THE GOALS PICKED:\n- Two goals chosen: one habit per goal (two total, one each). Show one panel per goal and collect exactly one habit from each.\n- One goal chosen: one or two habits for that goal.\n\nThe habit options for the user's goals are on the screen and in your reference list. That list is for matching the user's words to a canonical habit name only. It is not a list to read aloud, not in full, not in part, not the sub-lists either. Match what they say to the closest canonical name. Accept a custom habit only if they offer something not on the list (\"Create your own\"). At least one to continue. Less is more: the check-in is already a habit, so one or two more is plenty, and one is totally fine. Keep it small on purpose, they can build on it later.\n\nDO NOT:\n- Read the habit list out loud, in full or in part, not even one as an example. The screen shows them.\n- Read sub-lists or anything the screen isn't currently showing.\n- Name or describe habits beyond what the user has picked.\n- Invent habit names not on the list.\n- With two goals, take more than one habit for a single goal. One per goal.\n- Add commentary or motivation after each pick.",
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
    context:
      "BEAT: Habit selection.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nBRANCHES ON THE GOALS PICKED:\n- Two goals chosen: one habit per goal (two total, one each). Show one panel per goal and collect exactly one habit from each.\n- One goal chosen: one or two habits for that goal.\n\nThe habit options for the user's goals are on the screen and in your reference list. That list is for matching the user's words to a canonical habit name only. It is not a list to read aloud, not in full, not in part, not the sub-lists either. Match what they say to the closest canonical name. Accept a custom habit only if they offer something not on the list (\"Create your own\"). At least one to continue. Less is more: the check-in is already a habit, so one or two more is plenty, and one is totally fine. Keep it small on purpose, they can build on it later.\n\nDO NOT:\n- Read the habit list out loud, in full or in part, not even one as an example. The screen shows them.\n- Read sub-lists or anything the screen isn't currently showing.\n- Name or describe habits beyond what the user has picked.\n- Invent habit names not on the list.\n- With two goals, take more than one habit for a single goal. One per goal.\n- Add commentary or motivation after each pick.",
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
    context:
      "BEAT: Habit selection.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nBRANCHES ON THE GOALS PICKED:\n- Two goals chosen: one habit per goal (two total, one each). Show one panel per goal and collect exactly one habit from each.\n- One goal chosen: one or two habits for that goal.\n\nThe habit options for the user's goals are on the screen and in your reference list. That list is for matching the user's words to a canonical habit name only. It is not a list to read aloud, not in full, not in part, not the sub-lists either. Match what they say to the closest canonical name. Accept a custom habit only if they offer something not on the list (\"Create your own\"). At least one to continue. Less is more: the check-in is already a habit, so one or two more is plenty, and one is totally fine. Keep it small on purpose, they can build on it later.\n\nDO NOT:\n- Read the habit list out loud, in full or in part, not even one as an example. The screen shows them.\n- Read sub-lists or anything the screen isn't currently showing.\n- Name or describe habits beyond what the user has picked.\n- Invent habit names not on the list.\n- With two goals, take more than one habit for a single goal. One per goal.\n- Add commentary or motivation after each pick.",
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
    context:
      "BEAT: Habit selection.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nBRANCHES ON THE GOALS PICKED:\n- Two goals chosen: one habit per goal (two total, one each). Show one panel per goal and collect exactly one habit from each.\n- One goal chosen: one or two habits for that goal.\n\nThe habit options for the user's goals are on the screen and in your reference list. That list is for matching the user's words to a canonical habit name only. It is not a list to read aloud, not in full, not in part, not the sub-lists either. Match what they say to the closest canonical name. Accept a custom habit only if they offer something not on the list (\"Create your own\"). At least one to continue. Less is more: the check-in is already a habit, so one or two more is plenty, and one is totally fine. Keep it small on purpose, they can build on it later.\n\nDO NOT:\n- Read the habit list out loud, in full or in part, not even one as an example. The screen shows them.\n- Read sub-lists or anything the screen isn't currently showing.\n- Name or describe habits beyond what the user has picked.\n- Invent habit names not on the list.\n- With two goals, take more than one habit for a single goal. One per goal.\n- Add commentary or motivation after each pick.",
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
    context:
      "BEAT: Habit selection.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nBRANCHES ON THE GOALS PICKED:\n- Two goals chosen: one habit per goal (two total, one each). Show one panel per goal and collect exactly one habit from each.\n- One goal chosen: one or two habits for that goal.\n\nThe habit options for the user's goals are on the screen and in your reference list. That list is for matching the user's words to a canonical habit name only. It is not a list to read aloud, not in full, not in part, not the sub-lists either. Match what they say to the closest canonical name. Accept a custom habit only if they offer something not on the list (\"Create your own\"). At least one to continue. Less is more: the check-in is already a habit, so one or two more is plenty, and one is totally fine. Keep it small on purpose, they can build on it later.\n\nDO NOT:\n- Read the habit list out loud, in full or in part, not even one as an example. The screen shows them.\n- Read sub-lists or anything the screen isn't currently showing.\n- Name or describe habits beyond what the user has picked.\n- Invent habit names not on the list.\n- With two goals, take more than one habit for a single goal. One per goal.\n- Add commentary or motivation after each pick.",
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
    context:
      "BEAT: Habit selection.\n\nSPEAK MODE: VERBATIM_OPENER + SILENT_OPTIONS\n\nBRANCHES ON THE GOALS PICKED:\n- Two goals chosen: one habit per goal (two total, one each). Show one panel per goal and collect exactly one habit from each.\n- One goal chosen: one or two habits for that goal.\n\nThe habit options for the user's goals are on the screen and in your reference list. That list is for matching the user's words to a canonical habit name only. It is not a list to read aloud, not in full, not in part, not the sub-lists either. Match what they say to the closest canonical name. Accept a custom habit only if they offer something not on the list (\"Create your own\"). At least one to continue. Less is more: the check-in is already a habit, so one or two more is plenty, and one is totally fine. Keep it small on purpose, they can build on it later.\n\nDO NOT:\n- Read the habit list out loud, in full or in part, not even one as an example. The screen shows them.\n- Read sub-lists or anything the screen isn't currently showing.\n- Name or describe habits beyond what the user has picked.\n- Invent habit names not on the list.\n- With two goals, take more than one habit for a single goal. One per goal.\n- Add commentary or motivation after each pick.",
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
    allowedTools: null,
    expectedResponse: 'Names their own habit',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: {
      kind: 'habit',
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
          persistsTo: 'per addHabit handler, cap 2 (decision 4/5)',
          note: 'save tool unresolved (app-reconcile-pending)',
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
    context:
      'BEAT: Habit schedule.\n\nSPEAK MODE: VERBATIM_OPENER\n\nShows ALL the habits the user just picked, each as its own card with the habit name and its day picker (the frequency). The daily check-in and the evening reflection are NOT here, they are rituals, not habits. For each habit, set which days. Recommend weekdays to start. Days default to the weekday preset by locale. Per-habit reminders are OFF by default, on only if the user asks.\n\nDO NOT:\n- Turn a per-habit reminder on unless they ask.\n- Re-ask a piece they already gave.\n- Include the check-in or the reflection as habits here.',
    allowedTools: 'add_habit, update_habit, advance_step',
    expectedResponse: 'Sets the days per habit',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: null,
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
          persistsTo: 'per handler',
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
    context:
      "BEAT: Advanced capture.\n\nSPEAK MODE: VERBATIM_OPENER\n\nThe user already has habits. Let them read or type them all, in their own words. Each one forms on screen as a card, and each card is auto marked build or break (avoidance wording reads as break, everything else as build). You do NOT ask build or break per habit. Capture verbatim, don't reorganize as they talk. Less is more, especially at the start, they can build on it later. When they finish, name the build and break read once over the whole set and ask for a single yes. If they flag one as wrong, fix that one. Then the days get set on the next beat.\n\nDO NOT:\n- Ask build or break for each habit. The cards already mark it.\n- Reword or reorganize what they said.\n- Push for more. Less is more.",
    allowedTools: 'submit_brain_dump, advance_step',
    expectedResponse: 'Reads or types their habits',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: null,
    script: [
      {
        seq: 1,
        words:
          "Read me the list of the habits that you already track. In the next step we'll talk about which days. For now just give me the list of your habits. I recommend to start small. You could always build on it.",
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
          persistsTo: 'per handler',
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
    context:
      "BEAT: Habit days, advanced.\n\nSPEAK MODE: VERBATIM_OPENER\n\nThe habits are already captured as cards. Now set how often each one runs. The day circles grow out of the same cards. Parse a full answer when they give one, ask only for what's missing. Per-habit reminders OFF by default. Go through them, then the plan is ready.\n\nDO NOT:\n- Re-ask anything already captured.\n- Turn a reminder on unless they ask.",
    allowedTools: 'add_habit, update_habit, advance_step',
    expectedResponse: 'Says the days per habit',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: null,
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
          'Not every habit needs to be done every day. Specific days in the week is great as well. Once a week for a certain habit, also great.',
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
          persistsTo: 'per handler',
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
    context:
      'BEAT: Full plan.\n\nSPEAK MODE: VERBATIM_OPENER\n\nOne confirm. Show the whole plan: the check-in time, the evening reflection time, and all the habits under them. Ask if it looks right or if they want to change anything. On approval, they enter the app. This is a high-investment moment, make the line real and specific, not generic.\n\nBUTTONS (L7): tap path only. If the user is in voice, no buttons, they just say what they want. On the tap path, show two buttons, "Approve and start" and "I want to change something." Editing is voice-driven, the add / edit / delete component surfaces. Instrument users who never tap a button.',
    allowedTools: 'update_habit, confirm_plan',
    expectedResponse: 'Looks good, or an edit',
    voiceEngine: 'MP3',
    voiceMode: 'Verbatim',
    hideOrb: false,
    props: { buttonLabel: 'Approve and start', buttonEditLabel: 'I want to change something' },
    script: [
      {
        seq: 1,
        words:
          "Here's your plan. Your check-in, your reflection, and the habits you picked. Want to start here, or change anything first?",
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
          persistsTo: 'onboarding complete (per handler)',
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
    context:
      "BEAT: Weekly projection, frame 1 of 5.\n\nSPEAK MODE: VERBATIM_OPENER\n\nThe week grid animates on screen. This single line is verbatim and timed to the frame, an MP3 candidate (Cartesia, Yair Pro Clone). Say it as written, don't improvise or add. The five frames together carry the message: reporting itself is the win, weekly reassessment is the loop, a miss still counts, the one thing to avoid is the unreported gap.\n\nDO NOT:\n- Improvise or add to the line.\n- Describe the grid.",
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
    context:
      "BEAT: Weekly projection, frame 2 of 5.\n\nSPEAK MODE: VERBATIM_OPENER\n\nThe week grid fills green on screen. Verbatim, timed to the frame, an MP3 candidate. Say it as written, don't improvise. This is the best-case frame, hold it lightly, the realistic frames come next.\n\nDO NOT:\n- Improvise or add.\n- Promise this is what will happen.",
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
    context:
      'BEAT: Weekly projection, frame 3 of 5.\n\nSPEAK MODE: VERBATIM_OPENER\n\nThe grid shows mostly green with a few misses. Verbatim, timed to the frame, an MP3 candidate. Say it as written. This is the realistic win frame, the one that matters most.\n\nDO NOT:\n- Improvise or add.',
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
    context:
      'BEAT: Weekly projection, frame 4 of 5.\n\nSPEAK MODE: VERBATIM_OPENER\n\nThe grid shows a rough week, one streak surviving. Verbatim, timed to the frame, an MP3 candidate. Say it as written. The message: a rough week is still building, we reassess, no guilt.\n\nDO NOT:\n- Improvise or add.\n- Make a rough week sound like failure.',
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
    context:
      'BEAT: Weekly projection, frame 5 of 5.\n\nSPEAK MODE: VERBATIM_OPENER\n\nThe grid shows empty, unreported days. Verbatim, timed to the frame, an MP3 candidate. Say it as written. This is the close: the only thing to avoid is the unreported gap, even a miss counts when you report it.\n\nDO NOT:\n- Improvise or add.\n- Shame the user. The point is reporting, not perfection.',
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
