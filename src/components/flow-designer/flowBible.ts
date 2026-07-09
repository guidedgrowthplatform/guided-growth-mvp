// FLOW-LEVEL companion to beatsSource.ts (the per-beat one-source). This file is
// the GLOBAL layer that every beat inherits: laws, global rules, contracts, the
// enforcer registry, canonical enums, and the files/save/sync map. It is NOT a
// second per-beat metadata store; nothing per-beat lives here.
// Structure-only deliverable (structure-build-brief-2026-07-09): defines and
// presents contracts; implements no app behavior and no enforcers.

// ---------- shared shapes ----------

export type EnforcerKind = 'static' | 'qa-eval';
export type EnforcerStatus = 'built' | 'planned';
export type SourceStatus = 'verified' | 'copy-pending' | 'app-reconcile-pending' | 'needs-yair';

export interface GlobalRule {
  readonly id: string;
  readonly rule: string;
  readonly severity: 'must' | 'should';
  readonly enforcedBy: readonly string[];
  readonly status?: SourceStatus;
}

// ---------- 1. No-improvisation law + improvise windows ----------

export interface ImproviseWindow {
  readonly id: string;
  readonly where: string; // beat id, beat class, or 'any'
  readonly opens: string; // what opens the window
  readonly bounds: string; // what it may produce
  readonly mustNot: string; // hard limits inside the window
}

export interface ImprovisationLaw {
  readonly default: 'OFF';
  readonly law: string;
  readonly windows: readonly ImproviseWindow[];
  readonly enforcedBy: readonly string[];
}

export const IMPROVISATION: ImprovisationLaw = {
  default: 'OFF',
  law: 'Improvisation is OFF for onboarding (Yair 2026-07-09, LOCKED). The LLM never improvises: every spoken or shown coach line is a scripted verbatim line. No per-beat improvise windows exist and none may be authored. Not improvisation: the one live {name} line (live TTS of a scripted shape, governed by the voice/audio-ownership rule) and custom-entry fallbacks (the pre-authored generic line, copy-flow rule 14). The one real runtime case, user goes off topic, is handled by the GLOBAL off-topic rule (glob-out-of-scope), not a window. Tension RESOLVED (Yair 2026-07-09): the stay-open/help-them-land behavior (eval:brainstorm-then-yield, MUST) runs on SCRIPTED PROMPTS, a small pre-written help-you-decide line set the coach picks from (example: "What\'s been weighing on you most lately?"). Fully scripted, no generative window; the fill authors the bounded prompt set per picker beat, homed in that beat\'s section 13 branches.',
  windows: [],
  enforcedBy: ['eval:verbatim-opener', 'eval:one-line-then-wait'],
};

// ---------- 2. Global rules, on top (precedence above beat rules) ----------

export interface GlobalRulesLayer {
  readonly precedence: string;
  readonly rules: readonly GlobalRule[];
}

export const GLOBAL_RULES: GlobalRulesLayer = {
  precedence:
    'crisis/heavy-topic > global scope rules > beat rules (section 5/6) > script. A global rule answers before any beat rule; a beat rule may tighten a global rule, never loosen it.',
  rules: [
    {
      id: 'glob-crisis',
      rule: 'Heavy-topic and crisis handling per GLOBAL_CONTEXT overrides everything; the coach stops the flow-task and follows the safety boundary',
      severity: 'must',
      enforcedBy: ['eval:parity-walk'],
    },
    {
      id: 'glob-invalid-value',
      rule: 'Nonsense or invalid values ("my gender is yellow"): one light redirect, never argue, never store the invalid value, re-ask plainly once',
      severity: 'must',
      enforcedBy: ['eval:invalid-value-redirect'],
    },
    {
      id: 'glob-out-of-scope',
      rule: 'Off-topic input or world questions ("who won the game yesterday"): acknowledge briefly, steer back with the beat own question, do not chase the tangent, do not advance (Yair 2026-07-09, LOCKED). Applies at every beat where the user speaks; never answers out-of-scope content during onboarding',
      severity: 'must',
      enforcedBy: ['eval:out-of-scope-decline'],
    },
    {
      id: 'glob-no-machinery',
      rule: 'Never says beat, step, screen, page, card, tool, or system',
      severity: 'must',
      enforcedBy: ['eval:no-machinery-words'],
    },
    {
      id: 'glob-carry-forward',
      rule: 'Never re-asks a value already captured; downstream beats read it from flow state',
      severity: 'must',
      enforcedBy: ['eval:carry-forward'],
    },
    {
      id: 'glob-privacy-readback',
      rule: 'Never reads the user email, account, or stored values back unprompted',
      severity: 'must',
      enforcedBy: ['eval:parity-walk'],
    },
    {
      id: 'glob-no-preselection',
      rule: 'Every picker renders with NOTHING selected on entry; a preselected option is a render bug, not a default',
      severity: 'must',
      enforcedBy: ['component-registry-check'],
      status: 'app-reconcile-pending',
    },
    {
      id: 'glob-silent-after-pick',
      rule: 'After a pick is made the coach is silent except tool calls and the next scripted moment. No praise, no commentary, no response to the pick. (Resolves the "keep the response specific to their pick" contradiction: that prose applied to the pre-pick brainstorm window and is retired.)',
      severity: 'must',
      enforcedBy: ['eval:silent-after-pick'],
    },
    {
      id: 'glob-ack-where-declared',
      rule: 'Exception to silent-after-pick: beats whose bible declares an ack contract (habit picks per Yair 2026-07-09) speak the recorded acknowledgment line per picked item, verbatim, then return to silence',
      severity: 'must',
      enforcedBy: ['eval:ack-each-habit'],
      status: 'needs-yair',
    },
  ],
};

// ---------- 3. Global tool-failure surfacing contract ----------

export interface ToolFailureContract {
  readonly retry: string;
  readonly voice: string;
  readonly textOrTap: string;
  readonly never: readonly string[];
  readonly enforcedBy: readonly string[];
  readonly status: SourceStatus;
}

export const TOOL_FAILURE: ToolFailureContract = {
  retry:
    'First failure: one silent automatic retry. The user sees nothing. (Yair 2026-07-09: retry once quietly; if it still fails, surface it, never fail silently.)',
  voice:
    'Second failure on the voice path: one short coach line, APPROVED copy verbatim: "That didn\'t go through, let me try again." Then retry; if it still fails, keep it surfaced and offer the tap path. The beat never advances on a failed write.',
  textOrTap:
    'Second failure on the text/tap path: a toast (existing Toast system), APPROVED copy verbatim: "Couldn\'t save that, tap to retry." No coach line; the beat stays put.',
  never: [
    'advance past a beat whose write failed',
    'narrate technical detail (endpoint, error, tool name) in any modality',
    'fail silently with no user signal after the retry (closes the pass-1 edges gap)',
  ],
  enforcedBy: ['eval:edge-walk', 'tool-contract-check'],
  status: 'verified',
};

// ---------- 4. Multi-turn conversation model (DECIDED: own per-beat section 13, not a section-5 sub-block) ----------

export interface TurnBranch {
  readonly on: string; // user condition
  readonly reply: string; // bounded reply shape
  readonly then: string; // 'wait' | 'advance' | 'tool:<name>' | 'repeat'
}

export interface BeatConversation {
  readonly opens: string; // the scripted moment the loop starts from
  readonly branches: readonly TurnBranch[];
  readonly maxTurns: number;
  readonly onMaxTurns: string;
}

export interface ConversationModel {
  readonly placement: string;
  readonly loop: string;
  readonly defaults: { readonly maxTurns: number; readonly onMaxTurns: string };
}

export const CONVERSATION_MODEL: ConversationModel = {
  placement:
    'DECIDED (Yair 2026-07-09): multi-turn is its own SECTION 13 per beat. Section 5 stays tone/behavior rules; section 13 carries the conversational branches. A beat with no conversation block is single-turn by definition.',
  loop: 'listen -> match a branch -> one bounded reply -> wait or act. Every reply is a single line inside an improvise window or a scripted line. Unmatched input falls through to the global rules (off-topic, invalid value) before any free reply.',
  defaults: {
    maxTurns: 4,
    onMaxTurns:
      'plain one-line re-ask of the beat question and, on a picker, point to the tap path. Never loops silently.',
  },
};

// ---------- 5. Beat-to-beat data passing contract ----------

export interface DataPassingContract {
  readonly rule: string;
  readonly transport: readonly string[];
  readonly forbidden: string;
  readonly coldResume: string;
  readonly reference: string;
  readonly enforcedBy: readonly string[];
  readonly status: SourceStatus;
}

export const DATA_PASSING: DataPassingContract = {
  rule: 'A value a beat captures travels FORWARD to later beats in memory, not through the database. Submit persists it; the flow keeps using the in-memory copy.',
  transport: [
    'flow-state manager (the onboarding flow state), keyed by the canonical keys in each beat io block',
    'URL query parameter only where a page-era route boundary is crossed and state does not survive',
  ],
  forbidden:
    'Re-fetching a just-submitted value from the database/profile inside the same flow. The DB is the record, not the courier. (Rule from Yonas; concrete example referenced in the io blocks.)',
  coldResume:
    'Server read-back happens ONLY on cold resume/refresh hydration: the resume key (persistence section) proves position, the saved state rehydrates the flow-state manager once, then the in-memory rule applies again.',
  reference:
    'Concrete in-repo precedent (Yonas, feat/context-bundle-and-optimistic-session-log, merge 196e99ed): the optimistic write-ahead session_log store. logEvent writes src/stores/sessionLogStore.ts FIRST and getScreenContext reads the store (no /api/context/state round-trip); useLLM.ts forwards recent_events from the store so the backend uses the optimistic delta instead of querying session_log; server read-back only on SIGNED_IN/INITIAL_SESSION cold-resume hydration. Per-beat contract: beatsSource.ts BeatIO (dataIn key+from, dataOut key+persistsTo).',
  enforcedBy: ['persistence-contract-check', 'eval:carry-forward'],
  status: 'verified',
};

// ---------- 6. Coach = the LLM, made explicit ----------

export interface CoachIdentity {
  readonly is: string;
  readonly governedBy: string;
  readonly backendBoundary: string;
  readonly paths: readonly string[];
}

export const COACH_IDENTITY: CoachIdentity = {
  is: 'The coach IS the LLM. Every non-scripted coach turn is an LLM turn; the orb and bubbles are its face.',
  governedBy:
    'Section 5 (rules.context + the conversation block) governs every LLM turn on the beat; the global layer governs it above that. Section 7 contextProse is the brief the LLM reads; it never overrides a rule.',
  backendBoundary:
    'The tools in section 8 are the ONLY LLM-to-backend connection. Persistence, navigation, and state changes flow through tools; the LLM never writes state any other way.',
  paths: [
    'Onboarding voice: Vapi assistant (Path 1), same tool boundary via Vapi tool webhooks',
    'Onboarding chat / non-Vapi orb states: Direct LLM via /api/llm (Path 3)',
  ],
};

// ---------- Consumer contract (how the render/app must READ the bible) ----------

export interface ConsumerContractRow {
  readonly surface: string;
  readonly mustRead: string;
  readonly today: string; // honest wiring status
}

export const CONSUMER_CONTRACT: readonly ConsumerContractRow[] = [
  {
    surface: 'phone preview (component render)',
    mustRead:
      'bible.components rows (variant, exact on-screen state, no-preselection) as the render assertion source',
    today:
      'NOT WIRED: preview renders from component-internal values (categoryGrid CATS, fallback opener)',
  },
  {
    surface: 'script/audio playback',
    mustRead: 'script[] + bible.scriptMeta (reveal gating, timing) per line',
    today: 'PARTIAL: script[] drives playback; scriptMeta is display-only',
  },
  {
    surface: 'engine (advance/branch)',
    mustRead: 'bible.flow (advance condition, branches, gates) + BeatIO for state movement',
    today: 'NOT WIRED: engine logic lives in app code (preconditions.ts); bible.flow is prose',
  },
  {
    surface: 'coach (LLM context assembly)',
    mustRead: 'global layer + section 5 rules/conversation + section 7 prose + section 8 tools',
    today: 'NOT WIRED: coach reads beat_contexts.json lineage, not the bible',
  },
  {
    surface: 'guards (check:rules and successors)',
    mustRead:
      'every bible section enforcedBy against the ENFORCER_REGISTRY below; reject unknown ids',
    today: 'NOT WIRED: the only guard parses the retired annotation schema and cannot see bible.*',
  },
  {
    surface: 'QA fleet (walks)',
    mustRead:
      'bible.acceptance rows + bible.edges as the walk checklist; eval ids resolve via the registry',
    today: 'PARTIAL: parity harness walks exist; no id linkage',
  },
];

// ---------- Enforcer registry (one namespace; the staging proposal made concrete) ----------

export interface EnforcerEntry {
  readonly id: string;
  readonly kind: EnforcerKind;
  // status is the built-vs-planned truth (explicit, machine-read by the gate):
  //  - 'built': a static checker that runs today, OR a qa-eval that is configured
  //    and runnable on the fleet (see `runnable`).
  //  - 'planned': named but not yet enforceable.
  readonly status: EnforcerStatus;
  // For a qa-eval only: true once the fleet eval is configured and actually
  // runnable with an evidence artifact. A qa-eval counts as enforceable in
  // scale/release mode only when status === 'built' AND runnable === true.
  // A static check is enforceable in release mode when status === 'built'.
  readonly runnable?: boolean;
  readonly meaning: string;
  readonly owner: string;
}

// PROPOSAL for open decision 2: a rule may cite a PLANNED enforcer only because this
// registry lists it with an owner; check:rules rejects any id not in this registry,
// and a release gate requires every must-rule id to reach status built.
export const ENFORCER_REGISTRY: readonly EnforcerEntry[] = [
  // static checks that exist today
  {
    id: 'render-consistency-check',
    kind: 'static',
    status: 'built',
    meaning: 'beatsSource structural invariants',
    owner: 'render',
  },
  {
    id: 'render-link-integrity-check',
    kind: 'static',
    status: 'built',
    meaning: 'script bindsTo/clip ids resolve',
    owner: 'render',
  },
  { id: 'type-check', kind: 'static', status: 'built', meaning: 'tsc --noEmit', owner: 'repo' },
  {
    id: 'bible-registry-check',
    kind: 'static',
    status: 'built',
    meaning:
      'resolves every enforcedBy id against this registry, validates each bible sectionManifest (14 keys, legal statuses, filled => non-empty), enforces per-variant inheritance (no head category label / clip id / rule-id prefix leaks, no filled claim on a non-owned section), and total coverage across every onboarding beat; supports authoring vs release mode',
    owner: 'render guards lane',
  },
  // static checks named by the model, not yet built
  {
    id: 'render-rules-check',
    kind: 'static',
    status: 'planned',
    meaning: 'port of check:rules to the bible schema, resolves ids against THIS registry',
    owner: 'render guards lane',
  },
  {
    id: 'id-alias-check',
    kind: 'static',
    status: 'planned',
    meaning: 'beatId alias map generated + unique',
    owner: 'render guards lane',
  },
  {
    id: 'reveal-timing-check',
    kind: 'static',
    status: 'planned',
    meaning: 'reveals gate on clip end, never timers',
    owner: 'render guards lane',
  },
  {
    id: 'component-registry-check',
    kind: 'static',
    status: 'planned',
    meaning: 'declared component/variant/state matches registry; includes no-preselection',
    owner: 'render guards lane',
  },
  {
    id: 'audio-ownership-check',
    kind: 'static',
    status: 'planned',
    meaning: 'only {name} lines may be live; all else resolves to clips',
    owner: 'render guards lane',
  },
  {
    id: 'tool-contract-check',
    kind: 'static',
    status: 'planned',
    meaning: 'beat tools match the app tool registry + arg schemas',
    owner: 'app lane',
  },
  {
    id: 'advance-gate-check',
    kind: 'static',
    status: 'planned',
    meaning: 'bible.flow gates match preconditions.ts',
    owner: 'app lane',
  },
  {
    id: 'persistence-contract-check',
    kind: 'static',
    status: 'planned',
    meaning: 'bible persistence rows match handler writes',
    owner: 'app lane',
  },
  {
    id: 'decisions-coverage-check',
    kind: 'static',
    status: 'planned',
    meaning: 'every beat maps the 7 decisions (binds or explicit none)',
    owner: 'render guards lane',
  },
  // QA evals (fleet-run on a live walk) - canonical vocabulary
  {
    id: 'eval:verbatim-opener',
    kind: 'qa-eval',
    status: 'planned',
    meaning: 'recorded opener spoken verbatim, no improvised lead-in',
    owner: 'fleet',
  },
  {
    id: 'eval:no-read-options',
    kind: 'qa-eval',
    status: 'planned',
    meaning: 'never recites on-screen options',
    owner: 'fleet',
  },
  {
    id: 'eval:no-contrarian',
    kind: 'qa-eval',
    status: 'planned',
    meaning: 'no reframe undercutting the user pick',
    owner: 'fleet',
  },
  {
    id: 'eval:no-platitudes',
    kind: 'qa-eval',
    status: 'planned',
    meaning: 'no filler, no performative words',
    owner: 'fleet',
  },
  {
    id: 'eval:warm-opener',
    kind: 'qa-eval',
    status: 'planned',
    meaning: 'category opener glad + one specific reason',
    owner: 'fleet',
  },
  {
    id: 'eval:name-the-goal',
    kind: 'qa-eval',
    status: 'planned',
    meaning: 'habit-pick opener names the goal every time',
    owner: 'fleet',
  },
  {
    id: 'eval:count-agnostic',
    kind: 'qa-eval',
    status: 'planned',
    meaning: 'wording works for one or two goals',
    owner: 'fleet',
  },
  {
    id: 'eval:keep-the-gem',
    kind: 'qa-eval',
    status: 'planned',
    meaning: 'the habit-moment coaching point survives',
    owner: 'fleet',
  },
  {
    id: 'eval:first-person-reflection',
    kind: 'qa-eval',
    status: 'planned',
    meaning: 'reflection prompts first-person, mirror daily set',
    owner: 'fleet',
  },
  {
    id: 'eval:one-line-then-wait',
    kind: 'qa-eval',
    status: 'planned',
    meaning: 'one line, then wait; no chaining',
    owner: 'fleet',
  },
  {
    id: 'eval:no-machinery-words',
    kind: 'qa-eval',
    status: 'planned',
    meaning: 'no beat/step/screen/tool words',
    owner: 'fleet',
  },
  {
    id: 'eval:carry-forward',
    kind: 'qa-eval',
    status: 'planned',
    meaning: 'never re-asks a captured value',
    owner: 'fleet',
  },
  {
    id: 'eval:brainstorm-then-yield',
    kind: 'qa-eval',
    status: 'planned',
    meaning:
      'helps an unsure user decide using the beat scripted help-you-decide prompt set only (no generation, Yair 2026-07-09), yields when sure (replaces eval:stay-open-unsure)',
    owner: 'fleet',
  },
  {
    id: 'eval:single-select',
    kind: 'qa-eval',
    status: 'planned',
    meaning: 'more than one named: asks which matters most, takes exactly one (widened per pass-1)',
    owner: 'fleet',
  },
  {
    id: 'eval:silent-after-pick',
    kind: 'qa-eval',
    status: 'planned',
    meaning:
      'post-pick silence except tools + next scripted moment (replaces/widens eval:no-praise-pick)',
    owner: 'fleet',
  },
  {
    id: 'eval:ack-each-habit',
    kind: 'qa-eval',
    status: 'planned',
    meaning: 'declared ack beats speak the per-item recorded ack verbatim',
    owner: 'fleet',
  },
  {
    id: 'eval:invalid-value-redirect',
    kind: 'qa-eval',
    status: 'planned',
    meaning: 'nonsense value: one light redirect, no storage, one plain re-ask',
    owner: 'fleet',
  },
  {
    id: 'eval:out-of-scope-decline',
    kind: 'qa-eval',
    status: 'planned',
    meaning: 'world question: brief decline + back to the beat in one line',
    owner: 'fleet',
  },
  {
    id: 'eval:parity-walk',
    kind: 'qa-eval',
    status: 'planned',
    meaning:
      'full-flow walk vs the render expectations (mechanism exists in gg-spec parity-harness; id linkage pending)',
    owner: 'fleet',
  },
  {
    id: 'eval:edge-walk',
    kind: 'qa-eval',
    status: 'planned',
    meaning: 'per-beat edge behaviors on a live walk',
    owner: 'fleet',
  },
  {
    id: 'eval:selection-cap',
    kind: 'qa-eval',
    status: 'planned',
    meaning:
      'enforces the beat declared selection min/max (e.g. 1-2 goals); on overflow the coach asks which matter most',
    owner: 'fleet',
  },
];

// RETIRED ids (unification; do not use): eval:no-contrarian-turn -> eval:no-contrarian,
// eval:stay-open-unsure -> eval:brainstorm-then-yield, eval:no-praise-pick -> eval:silent-after-pick,
// bare parity-walk -> eval:parity-walk, compound strings -> arrays.
export const RETIRED_ENFORCER_IDS: Readonly<Record<string, string>> = {
  'eval:no-contrarian-turn': 'eval:no-contrarian',
  'eval:stay-open-unsure': 'eval:brainstorm-then-yield',
  'eval:no-praise-pick': 'eval:silent-after-pick',
  'parity-walk': 'eval:parity-walk',
};

// ---------- Canonical enums (bug-spec: one gender truth; category labels pending lock) ----------

export interface CanonicalEnums {
  readonly gender: {
    readonly values: readonly string[];
    readonly womenArtSelector: string;
    readonly status: SourceStatus;
    readonly note: string;
  };
  readonly categories: {
    readonly values: readonly string[];
    readonly status: SourceStatus;
    readonly note: string;
  };
}

export const CANONICAL_ENUMS: CanonicalEnums = {
  gender: {
    values: ['Female', 'Male', 'Other'],
    womenArtSelector:
      "gender === 'Female' is the ONLY selector for the women's art variant. Male AND Other get the default art. No alternating, no index tricks.",
    status: 'verified',
    note: "DECIDED (Yair 2026-07-09): profile capture stores Male / Female / Other; 'Other' never propagates past capture. Every downstream surface (art, variants, coach) sees Male/Female only, with Other treated as default/non-women. Decisions-doc language (non-binary/undisclosed) maps onto Other at capture.",
  },
  categories: {
    values: [
      'Sleep better',
      'Move more',
      'Eat better',
      'Feel more energized',
      'Reduce stress',
      'Improve focus',
      'Break bad habits',
      'Get more organized',
    ],
    status: 'verified',
    note: 'LOCKED (Yair 2026-07-09, as-is): these 8 values in this order are the submit_category canonical enum, plus the Create-your-own tile at the end (custom string).',
  },
};

// ---------- Open decisions (propose + flag, non-blocking; rendered on the card) ----------

export interface OpenDecision {
  readonly id: string;
  readonly question: string;
  readonly proposal: string;
  readonly decider: 'Yair';
  readonly decided?: string; // Yair's ruling once given; render as a green DECIDED chip
}

export const OPEN_DECISIONS: readonly OpenDecision[] = [
  {
    id: 'multi-turn-placement',
    question: 'Multi-turn model: new section 13 or expand section 5?',
    proposal:
      'Expand section 5 with the optional conversation block. One home for coach behavior; a 13th section would restate the same rules.',
    decider: 'Yair',
    decided:
      'Section 13, its own section (Yair 2026-07-09). Section 5 stays tone/behavior; the conversation block renders as section 13.',
  },
  {
    id: 'registry-staging',
    question:
      'The enforceability law bans sentinel-for-later, but 20 of 25 enforcers are unbuilt. How does the fill comply?',
    proposal:
      'Amend the law: a rule may cite a PLANNED id only if it is in ENFORCER_REGISTRY with an owner; check:rules rejects unknown ids; release gate requires must-rule ids to be built. Registry is in this file.',
    decider: 'Yair',
    decided:
      'APPROVED as proposed (Yair 2026-07-09): registry-listed status=planned ids are legal during build-out.',
  },
  {
    id: 'variant-as-beat',
    question:
      'category-women: separate variant beat (as shipped) or fold into category per flow rule 10?',
    proposal:
      'Fold at migration; until then bless variant-as-beat ONLY with a group/inheritance mechanism before the 37 goals/habits variants fill.',
    decider: 'Yair',
    decided:
      'Beat + SUB-BEAT inheritance (Yair 2026-07-09): a parent beat carries the shared parts, sub-beats inherit and override only what differs. No copying across the ~37 variants. Implemented as variantOf + resolveBeatStructure in beatsSource.ts.',
  },
  {
    id: 'category-labels',
    question: 'Lock the 8 canonical category labels (blocks submit_category enum).',
    proposal: 'Lock the 8 as rendered today (CANONICAL_ENUMS.categories).',
    decider: 'Yair',
    decided:
      'LOCKED as-is (Yair 2026-07-09): the 8 labels in their current order are the submit_category enum; Create-your-own stays the custom escape.',
  },
  {
    id: 'gender-enum',
    question: 'One canonical gender enum across decisions doc, chips, render props, app code.',
    proposal:
      "Female / Male / Other as stored values; women's art on Female only; decision 3 language updated to match.",
    decider: 'Yair',
    decided:
      "Male and Female ONLY everywhere downstream (Yair 2026-07-09). 'Other' exists solely at profile capture and never propagates: art, variants, and coach all see Male/Female; women's art on Female only; Male and Other get the default art, never alternating.",
  },
  {
    id: 'tool-failure-copy',
    question: 'Tool-failure surfacing: approve the retry-then-surface contract and its copy.',
    proposal:
      'One silent retry; voice = one short coach line then tap-path offer; text/tap = toast; never advance on a failed write.',
    decider: 'Yair',
    decided:
      'APPROVED (Yair 2026-07-09) with exact copy: toast "Couldn\'t save that, tap to retry"; voice line "That didn\'t go through, let me try again". Retry once quietly; if it still fails, surface it, never fail silently.',
  },
  {
    id: 'improvise-boundaries',
    question:
      'Improvise-window boundaries: which windows exist and how tight are they (esp. MP3 beats)?',
    proposal:
      'Four minimal windows (name slot, pre-pick brainstorm, custom-entry fallback, edge one-liner), pending a dedicated Yair discussion.',
    decider: 'Yair',
    decided:
      'OFF for onboarding (Yair 2026-07-09, LOCKED). No per-beat improvise windows at all; off-topic input is handled by the GLOBAL off-topic rule (acknowledge briefly, steer back with the beat own question, never chase, never advance). Windows removed from IMPROVISATION. Follow-up resolved: stay-open runs on SCRIPTED PROMPTS (pre-written help-you-decide lines per picker beat), no generative exception.',
  },
  {
    id: 'uniform-sections',
    question: 'Can a beat type drop non-applicable sections?',
    proposal: 'Optional sections per beat',
    decider: 'Yair',
    decided:
      'NO - uniform shape (conductor decided under Yair delegation, 2026-07-09): every beat declares ALL sections; each is filled / N-A-for-this-type (with reason) / pending-app-reconcile; guard validates.',
  },
];

// ---------- Part B: files + save + sync map (rendered collapsible; Sheet-exportable rows) ----------

export interface FileMapRow {
  readonly area: string; // grouping for the collapsible section
  readonly file: string;
  readonly role: string;
  readonly authored: 'hand' | 'generated' | 'mixed';
  readonly savesTo: string; // table.column, localStorage key, file, or 'none'
  readonly syncEdge: string; // source -> mechanism -> destination, or 'none'
  readonly staleRisk: string; // one line, or 'low'
}

// Transcribed from the ground-truth inventory (files-sync-inventory sweep,
// 2026-07-09): render files (Table 1), app runtime (Table 2), supabase writes
// (Table 3), sync edges (Table 4), plus the gg-spec parity-harness tooling
// referenced by edge 15. Grouped where the source table already grouped
// (tests, mirror sets, small helper clusters) so the map stays one screen per
// area rather than one row per file on disk.
export const FILES_SYNC_MAP: readonly FileMapRow[] = [
  // ---------- render (Table 1, ref annotate/sample-category-women, 55 files) ----------
  {
    area: 'render',
    file: 'src/components/flow-designer/FlowBuilder.tsx',
    role: 'drag-drop flow builder canvas (presets, beat palette, Export JSON, orb-builder mode)',
    authored: 'hand',
    savesTo: 'none',
    syncEdge: 'none',
    staleRisk: 'low',
  },
  {
    area: 'render',
    file: 'src/components/flow-designer/FlowDesigner.tsx',
    role: 'the annotated render view: every beat as a phone tile with the Bible card',
    authored: 'hand',
    savesTo: 'none',
    syncEdge: 'none',
    staleRisk:
      'AST-parsed by render-consistency-check.mjs and gg-spec extract-spec.mjs; shape drift breaks both',
  },
  {
    area: 'render',
    file: 'src/components/flow-designer/FlowPlay.tsx',
    role: '#play mode: runs beats in order in one phone, narration drives reveals',
    authored: 'hand',
    savesTo: 'none',
    syncEdge: 'none',
    staleRisk: 'low',
  },
  {
    area: 'render',
    file: 'src/components/flow-designer/FlowDesigner.stories.tsx',
    role: 'Storybook wrapper for FlowDesigner',
    authored: 'hand',
    savesTo: 'none',
    syncEdge: 'none',
    staleRisk: 'low',
  },
  {
    area: 'render',
    file: 'src/components/flow-designer/beatsSource.ts',
    role: 'THE ONE SOURCE for the render: per-beat fields + script[]',
    authored: 'hand',
    savesTo: 'none',
    syncEdge: 'none',
    staleRisk:
      'consolidated from now-retired stores; a second hand-authored store must not reappear',
  },
  {
    area: 'render',
    file: 'src/components/flow-designer/beatKit.tsx',
    role: 'shared beat-play contexts + BeatPlayer/Karaoke primitives',
    authored: 'hand',
    savesTo: 'none',
    syncEdge: 'none',
    staleRisk: 'low',
  },
  {
    area: 'render',
    file: 'src/components/flow-designer/beatNarration.ts',
    role: 'speak+reveal driver (SpeechSynthesis or real clip); classifies beat kinds',
    authored: 'hand',
    savesTo: 'none',
    syncEdge: 'none',
    staleRisk: 'low',
  },
  {
    area: 'render',
    file: 'src/components/flow-designer/beatAudio.ts',
    role: "resolves a beat's pre-rendered clip rotation by Voice Scripts stage",
    authored: 'hand',
    savesTo: 'none',
    syncEdge: 'none',
    staleRisk: 'low',
  },
  {
    area: 'render',
    file: 'src/components/flow-designer/beatMetadata.ts',
    role: "per-beat FlowBuilder authoring copy (opener seed text, per-element micro-lines, opener flags) merged onto beats; voiceEngine/voiceMode/allowedTools/expectedResponse are retired from this file (2026-07-10) and now read live from beatsSource.ts via BEAT_BY_SCREEN_ID (FlowBuilder.tsx withRenderFacts), so they can't diverge from the render",
    authored: 'generated',
    savesTo: 'none',
    syncEdge: 'edge 9 (Sheet -> gen_beat_metadata.py)',
    staleRisk: 'scripts/beat-metadata-reconcile-check.mjs fails the build if a retired field reappears or a screen_id no longer resolves in beatsSource.ts; wording marked provisional',
  },
  {
    area: 'render',
    file: 'src/components/flow-designer/voiceScriptsAudio.ts',
    role: 'Voice Scripts stage rotation of pre-rendered check-in MP3 clips',
    authored: 'generated',
    savesTo: 'none',
    syncEdge: 'edge 10 (Sheet -> gen_voice_scripts_audio.py)',
    staleRisk: 'stale until re-run on Sheet rotation change',
  },
  {
    area: 'render',
    file: 'src/components/flow-designer/voiceClips.ts',
    role: 'text -> clip path map, derived at import time from beatsSource script lines',
    authored: 'generated',
    savesTo: 'none',
    syncEdge: 'none',
    staleRisk: 'low (derived at load, no committed generation step)',
  },
  {
    area: 'render',
    file: 'src/components/flow-designer/clipCaptions.ts',
    role: 'per-word caption timings for public/voice/ob/*.wav clips',
    authored: 'generated',
    savesTo: 'none',
    syncEdge: 'edge 14 (-> engine openerCaptions.ts)',
    staleRisk: 'no importer on this branch; unclear if intentionally ingest-only',
  },
  {
    area: 'render',
    file: 'src/components/flow-designer/flowStateCtx.ts',
    role: 'Live-Play shared selection state (category/goals/habits/plan chain)',
    authored: 'hand',
    savesTo: 'none',
    syncEdge: 'none',
    staleRisk: 'low',
  },
  {
    area: 'render',
    file: 'src/components/flow-designer/paletteExtras.tsx',
    role: 'extra palette registry: real app components as builder tiles',
    authored: 'hand',
    savesTo: 'none',
    syncEdge: 'none',
    staleRisk: 'low',
  },
  {
    area: 'render',
    file: 'src/components/flow-designer/BeatOrb.tsx',
    role: 'shared canvas orb (interactive DualButton halves, ring pulse)',
    authored: 'hand',
    savesTo: 'none',
    syncEdge: 'none',
    staleRisk: 'low',
  },
  {
    area: 'render',
    file: 'src/components/flow-designer/orb/Orb.tsx',
    role: 'reusable canvas-2D Siri-style orb driven entirely by props',
    authored: 'hand',
    savesTo: 'none',
    syncEdge: 'none',
    staleRisk: 'low',
  },
  {
    area: 'render',
    file: 'src/components/flow-designer/orb/OrbTuner.tsx',
    role: 'orb-builder workspace: live tuner for look/pulse params',
    authored: 'hand',
    savesTo: 'localStorage (orb tuner params)',
    syncEdge: 'none',
    staleRisk: 'low',
  },
  {
    area: 'render',
    file: 'src/components/flow-designer/orb/HomeBarPreview.tsx',
    role: 'bottom-nav mockup mirroring the tuner orb live',
    authored: 'hand',
    savesTo: 'none',
    syncEdge: 'none',
    staleRisk: 'low',
  },
  {
    area: 'render',
    file: 'src/components/flow-designer/orb/orbPresets.ts',
    role: 'version-controlled orb presets + locked idle/talk looks',
    authored: 'hand',
    savesTo: 'none',
    syncEdge: 'none',
    staleRisk: 'low',
  },
  {
    area: 'render',
    file: 'src/components/flow-designer/orb/orbLook.ts',
    role: 'the one shared orb look for Play + annotated phones',
    authored: 'hand',
    savesTo: 'none',
    syncEdge: 'none',
    staleRisk: 'low',
  },
  {
    area: 'render',
    file: 'src/components/flow-designer/orb/ORB-BUILDER.md',
    role: 'docs for the orb-builder mode',
    authored: 'hand',
    savesTo: 'none',
    syncEdge: 'none',
    staleRisk: 'low',
  },
  {
    area: 'render',
    file: 'src/components/flow-designer/beats/index.ts',
    role: 'auto-collects every beat file via import.meta.glob -> BEAT_DEFS',
    authored: 'hand',
    savesTo: 'none',
    syncEdge: 'none',
    staleRisk: 'low',
  },
  {
    area: 'render',
    file: 'src/components/flow-designer/beats/README.md',
    role: 'beats folder convention (one file per beat)',
    authored: 'hand',
    savesTo: 'none',
    syncEdge: 'none',
    staleRisk: 'low',
  },
  {
    area: 'render',
    file: 'src/components/flow-designer/beats/_TEMPLATE.tsx',
    role: 'copy-me template for a new beat',
    authored: 'hand',
    savesTo: 'none',
    syncEdge: 'none',
    staleRisk: 'low',
  },
  {
    area: 'render',
    file: 'src/components/flow-designer/beats/_beatStyle.ts',
    role: 'shared visual tokens mapped to src/index.css custom props',
    authored: 'hand',
    savesTo: 'none',
    syncEdge: 'none',
    staleRisk: 'low',
  },
  {
    area: 'render',
    file: 'src/components/flow-designer/beats/_startGate.ts',
    role: 'flag store gating the coach greeting MP3 until Get Started is pressed',
    authored: 'hand',
    savesTo: 'none',
    syncEdge: 'none',
    staleRisk: 'low',
  },
  {
    area: 'render',
    file: 'src/components/flow-designer/beats/*.tsx (26 beat component files)',
    role: 'one presentational component per beat type (splash, categoryGrid, habitPicker, weeklyProjection, etc.), registered via beats/index.ts glob',
    authored: 'hand',
    savesTo: 'none',
    syncEdge: 'none',
    staleRisk:
      'weeklyProjection.tsx and homeTour.tsx behavior was ported to main; qaControl.tsx has a separate functional twin on main',
  },
  {
    area: 'render',
    file: 'scripts/export-render-parity.mjs',
    role: 'AST-parses beatsSource.ts into dist-flow/parity.json for the deployed render',
    authored: 'hand',
    savesTo: 'dist-flow/parity.json + _headers (no-store)',
    syncEdge: 'edge 11',
    staleRisk: 'parity.json only as fresh as the last render deploy',
  },
  {
    area: 'render',
    file: 'scripts/render-consistency-check.mjs',
    role: 'guard 1/2: beatsSource.ts is the only authored store + required fields present',
    authored: 'hand',
    savesTo: 'none',
    syncEdge: 'edge 12',
    staleRisk: "doesn't know beatMetadata.ts is a second Sheet-generated store feeding the builder",
  },
  {
    area: 'render',
    file: 'scripts/render-link-integrity-check.mjs',
    role: 'guard 2/2: every script bindsTo/clip id resolves to a real element/file',
    authored: 'hand',
    savesTo: 'none',
    syncEdge: 'edge 12',
    staleRisk: 'low',
  },

  // ---------- app runtime (Table 2, ref origin/main) — engine (src/onboarding-flow/**) ----------
  {
    area: 'app runtime',
    file: 'src/onboarding-flow/flowMachine.ts',
    role: 'pure flow state machine (answers accumulate, never reset per screen)',
    authored: 'hand',
    savesTo: 'none',
    syncEdge: 'none',
    staleRisk: 'low',
  },
  {
    area: 'app runtime',
    file: 'src/onboarding-flow/useFlow.ts',
    role: 'flow loader + registry + version pinning; falls back to hand-authored fixture',
    authored: 'hand',
    savesTo: 'none',
    syncEdge: 'reads flows/*.generated.json (edge 7)',
    staleRisk: 'low',
  },
  {
    area: 'app runtime',
    file: 'src/onboarding-flow/useFlowOrchestrator.ts',
    role: 'React orchestrator: persistence + coach wiring + leading-edge advance',
    authored: 'hand',
    savesTo: 'onboarding_states via injected FlowPersistence',
    syncEdge: 'none',
    staleRisk: 'low',
  },
  {
    area: 'app runtime',
    file: 'src/onboarding-flow/persistence.ts',
    role: 'FlowPersistence adapters: real save/complete or local no-op for previews',
    authored: 'hand',
    savesTo: 'onboarding_states (real) / in-memory (local)',
    syncEdge: 'none',
    staleRisk: 'low',
  },
  {
    area: 'app runtime',
    file: 'src/onboarding-flow/checkinPersistence.ts',
    role: 'routes check-in beat tools to the check-in save path',
    authored: 'hand',
    savesTo: 'daily_checkins (+ habit/reflection rows)',
    syncEdge: 'none',
    staleRisk: 'low',
  },
  {
    area: 'app runtime',
    file: 'src/onboarding-flow/FlowOnboarding.tsx',
    role: 'real chat-native onboarding entry; wires orchestrator to Supabase + Realtime',
    authored: 'hand',
    savesTo: 'onboarding_states (seeds nickname via saveStep(1))',
    syncEdge: 'none',
    staleRisk: 'low',
  },
  {
    area: 'app runtime',
    file: 'src/onboarding-flow/FlowOnboardingPreview.tsx + FlowCheckinPreview.tsx + FlowPreviewRoute.tsx',
    role: 'auth-free QA preview entry points (in-memory or opt-in real check-in persistence)',
    authored: 'hand',
    savesTo: 'none / optional daily_checkins',
    syncEdge: 'none',
    staleRisk: 'low',
  },
  {
    area: 'app runtime',
    file: 'src/onboarding-flow/IntroGate.tsx',
    role: 'two-phase gate: Get Started starts the coach MP3 in-gesture, SplashIntro adopts it',
    authored: 'hand',
    savesTo: 'none',
    syncEdge: 'none',
    staleRisk: 'low',
  },
  {
    area: 'app runtime',
    file: 'src/onboarding-flow/BrainDumpCapture.tsx + parseBrainDumpRegex.ts',
    role: 'brain-dump capture UI + instant local regex first pass',
    authored: 'hand',
    savesTo: 'via orchestrator capture; AI parse via /api',
    syncEdge: 'none',
    staleRisk: 'low',
  },
  {
    area: 'app runtime',
    file: 'src/onboarding-flow/generalContext.ts',
    role: 'system-level coach context above every beat (composeBeatContext seam)',
    authored: 'hand',
    savesTo: 'none (carries context into LLM request payload)',
    syncEdge: 'none',
    staleRisk: 'low',
  },
  {
    area: 'app runtime',
    file: 'src/onboarding-flow/beatEngineMeta.ts',
    role: 'the one accessor for "what engine runs this beat"',
    authored: 'hand',
    savesTo: 'none',
    syncEdge: 'none',
    staleRisk: 'low',
  },
  {
    area: 'app runtime',
    file: 'src/onboarding-flow/derivedStepMaps.ts',
    role: 'derived step maps for the live flow, computed at module load',
    authored: 'generated',
    savesTo: 'none',
    syncEdge: 'none',
    staleRisk: 'low (derived at load from generated flow)',
  },
  {
    area: 'app runtime',
    file: 'src/onboarding-flow/flowData.ts',
    role: 'option data re-exports (goalsByCategory/habitsByGoal) shared with live Step pages',
    authored: 'hand',
    savesTo: 'none',
    syncEdge: 'none',
    staleRisk: 'low',
  },
  {
    area: 'app runtime',
    file: 'src/onboarding-flow/types.ts',
    role: 'flow document schema (mirrors gg-spec flow-builder-export-spec.md)',
    authored: 'hand',
    savesTo: 'none',
    syncEdge: 'none',
    staleRisk: 'schema mirrors an external spec doc; can drift silently',
  },
  {
    area: 'app runtime',
    file: 'src/onboarding-flow/QAControlScreen.tsx + QAFab.tsx + qaSound.ts/QASoundToggle.tsx + qaVapi.ts/QAVapiToggle.tsx + qaConvoHarness.ts',
    role: 'QA-only launcher, floating controls, mute/Vapi toggles, convo-harness seam',
    authored: 'hand',
    savesTo: 'clears auth session; localStorage gg_qa_sound_muted / gg_vapi_enabled',
    syncEdge: 'none',
    staleRisk:
      'QAControlScreen is the functional twin of the render qa-control beat; two implementations to keep in sync',
  },
  {
    area: 'app runtime',
    file: 'src/onboarding-flow/flows/designer-source*.json (6 Builder Exports)',
    role: 'the designer source of truth per flow (onboarding + 5 check-in/tour/demo flows)',
    authored: 'hand',
    savesTo: 'input to flow:sync',
    syncEdge: 'edge 7 + edge 13 (one-time seed-from-render)',
    staleRisk:
      'render commits after the pinned seed sha are not reflected unless re-seeded or hand-ported',
  },
  {
    area: 'app runtime',
    file: 'src/onboarding-flow/flows/__fixtures__/*.ts',
    role: 'hand-authored TS flows kept only as safe fallback if generated JSON fails validation',
    authored: 'hand',
    savesTo: 'none',
    syncEdge: 'none',
    staleRisk: 'low (tests-only equivalence fixtures)',
  },
  {
    area: 'app runtime',
    file: 'src/onboarding-flow/flows/README-flow-sync.md',
    role: 'the designer -> engine sync doc (pieces table, run steps, field mapping)',
    authored: 'hand',
    savesTo: 'none',
    syncEdge: 'none',
    staleRisk: 'low',
  },
  {
    area: 'app runtime',
    file: 'src/onboarding-flow/transform/designerSource.ts + designerSourceJson.ts + designerToFlow.ts + deriveStepMaps.ts',
    role: 'Export JSON -> DesignerBeat[] -> engine FlowDocument transform + step-map derivation',
    authored: 'hand',
    savesTo: 'none',
    syncEdge: 'edge 7',
    staleRisk: 'guarded by designerToFlow.test.ts + stepMapParity.test.ts (fails on drift)',
  },
  {
    area: 'app runtime',
    file: 'src/onboarding-flow/renderer/FlowRenderer.tsx + BeatView.tsx + BeatPlayer.tsx + componentRegistry.tsx',
    role: 'continuous-chat renderer: scrolling beat history + componentType adapters',
    authored: 'hand',
    savesTo: 'onboarding_states (via orchestrator, through componentRegistry)',
    syncEdge: 'none',
    staleRisk: 'low',
  },
  {
    area: 'app runtime',
    file: 'src/onboarding-flow/renderer/FlowVoiceControls.tsx',
    role: 'in-page voice orb for the flow routes',
    authored: 'hand',
    savesTo: 'none',
    syncEdge: 'none',
    staleRisk: 'low',
  },
  {
    area: 'app runtime',
    file: 'src/onboarding-flow/renderer/applyName.ts + resolveBeatOpener.ts + openerTurns.ts',
    role: '{name} templating, locked-opener-first resolution, newline turn-break split',
    authored: 'hand',
    savesTo: 'none',
    syncEdge: 'none',
    staleRisk: 'low',
  },
  {
    area: 'app runtime',
    file: 'src/onboarding-flow/renderer/openerCaptions.ts',
    role: 'precomputed word-onset captions for MP3 openers',
    authored: 'generated',
    savesTo: 'none',
    syncEdge: 'edge 14 (render clipCaptions.ts -> ingest-captions.ts)',
    staleRisk:
      '6 long clips carry raw whisper tokenization (word-count off-by-one, safe by design)',
  },
  {
    area: 'app runtime',
    file: 'src/onboarding-flow/renderer/openerGestureStart.ts + openerPreloadPool.ts + openerActivation.ts + openerReveal.ts + useBeatOpenerMp3.ts + useBeatOpenerCartesia.ts + useBeatAudioHold.ts + beatAudioOwner.ts + useCoachSpeechReveal.ts + coachThinking.ts',
    role: 'opener audio playback + karaoke reveal pacing + audio-claim ownership cluster',
    authored: 'hand',
    savesTo: 'none',
    syncEdge: 'none',
    staleRisk: 'low (bug-numbered races already closed: B4/B14, B15, B28/B29, B40, B58)',
  },
  {
    area: 'app runtime',
    file: 'src/onboarding-flow/renderer/habitSelectionRules.ts',
    role: 'goals -> habits branch rule (2 goals = 1 habit each, replace semantics)',
    authored: 'hand',
    savesTo: 'none',
    syncEdge: 'none',
    staleRisk: 'low',
  },
  {
    area: 'app runtime',
    file: 'src/onboarding-flow/renderer/weeklyProjectionData.ts',
    role: "5 projection frames' grid math, ported from render beats/weeklyProjection.tsx",
    authored: 'hand',
    savesTo: 'none',
    syncEdge: 'none',
    staleRisk: 'a port, not a shared module; render-side changes need a manual re-port',
  },
  {
    area: 'app runtime',
    file: 'src/onboarding-flow/renderer/narration/NarrationBeatView.tsx + narrationSchedule.ts + narrationClips.ts + NarrationRevealContext.tsx',
    role: 'Lane A narration driver: bubble/reveal/close segments off real audio',
    authored: 'hand',
    savesTo: 'none',
    syncEdge: 'none',
    staleRisk: 'low',
  },
  {
    area: 'app runtime',
    file: 'src/onboarding-flow/renderer/tour/HomeTourAdapter.tsx + homeTourPieces.tsx',
    role: 'home-tour engine adapter + presentational pieces, ported from render homeTour.tsx',
    authored: 'hand',
    savesTo: 'none',
    syncEdge: 'none',
    staleRisk: 'a port; render-side changes need a manual re-port',
  },
  {
    area: 'app runtime',
    file: 'src/onboarding-flow tests (__tests__/, renderer/__tests__/, flows/__tests__/ + inline *.test.* — 56 files)',
    role: 'regression net: cascade bugs, resume matrix, step-map parity, opener races, resync, narration contract',
    authored: 'hand',
    savesTo: 'none',
    syncEdge: 'none',
    staleRisk: 'low',
  },

  // ---------- app runtime — Direct-LLM lane (api/_lib/llm/onboarding/**) ----------
  {
    area: 'app runtime',
    file: 'api/_lib/llm/onboarding/beatContexts.ts',
    role: 'beat-context store the Direct-LLM coach sees per beat; merges generated overrides at load',
    authored: 'mixed',
    savesTo: 'none (read into /api/llm system prompt)',
    syncEdge: 'edge 4',
    staleRisk: 'depends on beatContexts.generated.json freshness',
  },
  {
    area: 'app runtime',
    file: 'api/_lib/llm/onboarding/schemas.ts',
    role: '16 onboarding tool JSON schemas for the OpenAI Responses API',
    authored: 'hand',
    savesTo: 'none',
    syncEdge: 'none',
    staleRisk: 'low',
  },
  {
    area: 'app runtime',
    file: 'api/_lib/llm/onboarding/registry.ts',
    role: 'isOnboardingScreen + per-beat allowedTools gate over the tool list',
    authored: 'hand',
    savesTo: 'none',
    syncEdge: 'none',
    staleRisk: 'low',
  },
  {
    area: 'app runtime',
    file: 'api/_lib/llm/onboarding/dispatch.ts',
    role: 'tool-name -> handler dispatch',
    authored: 'hand',
    savesTo: 'none',
    syncEdge: 'none',
    staleRisk: 'low',
  },
  {
    area: 'app runtime',
    file: 'api/_lib/llm/onboarding/preconditions.ts',
    role: 'advance/finalize data gates (checkAdvanceData shared with Vapi navigate_next)',
    authored: 'hand',
    savesTo: 'none (reads onboarding_states.data)',
    syncEdge: 'none',
    staleRisk: 'low',
  },
  {
    area: 'app runtime',
    file: 'api/_lib/llm/onboarding/systemPromptAddendum.ts',
    role: 'onboarding tool-use rules block appended to the system prompt',
    authored: 'hand',
    savesTo: 'none',
    syncEdge: 'none',
    staleRisk: 'low',
  },
  {
    area: 'app runtime',
    file: 'api/_lib/llm/onboarding/canonicalOptions.ts',
    role: 'injects canonical category/goal/habit labels from @gg/shared taxonomy',
    authored: 'hand',
    savesTo: 'none',
    syncEdge: 'none',
    staleRisk: 'anti-drift guard vs the DB context; only as good as @gg/shared staying current',
  },
  {
    area: 'app runtime',
    file: 'api/_lib/llm/onboarding/fillBeatName.ts',
    role: 'server {name} substitution/drop mirror of applyName',
    authored: 'hand',
    savesTo: 'none',
    syncEdge: 'none',
    staleRisk:
      'two implementations of the same rule (client applyName + server fillBeatName) to keep in sync',
  },
  {
    area: 'app runtime',
    file: 'api/_lib/llm/onboarding/brainDumpTurnMerge.ts + sameTurnToolDedupe.ts',
    role: 'same-turn brain-dump chunk accumulation (W2-D) + duplicate tool-call skip (W2-E)',
    authored: 'hand',
    savesTo: 'affects what submitBrainDump writes',
    syncEdge: 'none',
    staleRisk: 'low',
  },
  {
    area: 'app runtime',
    file: 'api/_lib/llm/onboarding/handlers/shared.ts + setupConfigGuard.ts',
    role: 'arg getters + ok/invalid/handlerError ctx; B58 refusal/grounding guard for setup-config tools',
    authored: 'hand',
    savesTo: 'none (guard blocks writes)',
    syncEdge: 'none',
    staleRisk: 'low',
  },
  {
    area: 'app runtime',
    file: 'api/_lib/llm/onboarding/handlers/*.ts (14 tool handlers)',
    role: 'the actual write handlers per tool (see supabase writes area for exact columns)',
    authored: 'hand',
    savesTo: 'onboarding_states (mostly)',
    syncEdge: 'none',
    staleRisk: 'low',
  },
  {
    area: 'app runtime',
    file: 'api/_lib/llm/onboarding tests (__tests__/ + handlers/__tests__/ — 13 files)',
    role: 'registry/tool-gate/dispatch/preconditions/guard regression locks',
    authored: 'hand',
    savesTo: 'none',
    syncEdge: 'none',
    staleRisk: 'low',
  },

  // ---------- generated bundles ----------
  {
    area: 'generated bundles',
    file: 'src/generated/beat_contexts.json',
    role: 'frontend-bundled per-beat context/opener/allowedTools/step/target_step',
    authored: 'generated',
    savesTo: 'none (read by onboardingBeatBundle.ts)',
    syncEdge: 'edge 6',
    staleRisk:
      'two-hop chain: forgetting sync_beat_contexts.py before beats:bundle splits backend vs frontend context',
  },
  {
    area: 'generated bundles',
    file: 'src/generated/screen_contexts.json',
    role: '22 onboarding-priority screen context_blocks, byte-identical to Supabase screen_contexts',
    authored: 'mixed',
    savesTo: 'none (read by screenContextsBundle.ts / getScreenContext.ts)',
    syncEdge: 'edge 2',
    staleRisk:
      'HIGH fork risk: two writers (Master Sheet mirror + a second beats-Sheet apply_beats.py) into one file, no equality checker',
  },
  {
    area: 'generated bundles',
    file: 'src/generated/onboarding_combined.json',
    role: 'unified per-beat view: engine metadata + coach context/opener + global',
    authored: 'generated',
    savesTo: 'none (read by beatContexts.ts allowedTools overlay)',
    syncEdge: 'edge 8',
    staleRisk: 'stale combined = stale tool gating (locked by beatContextsExport.test.ts)',
  },
  {
    area: 'generated bundles',
    file: 'api/_lib/llm/onboarding/beatContexts.generated.json',
    role: 'synced beat copy from Supabase (context+opener only)',
    authored: 'generated',
    savesTo: 'none',
    syncEdge: 'edge 4',
    staleRisk:
      'HIGH: not wired to any CI cron despite README suggesting it could be; committed file was 10 days stale at inventory time',
  },
  {
    area: 'generated bundles',
    file: 'api/_lib/llm/onboarding/stepMaps.generated.ts',
    role: 'STEP_OWNERS / ADVANCE_GATE_OWNERS / ADVANCE_LADDER derived from the flow document',
    authored: 'generated',
    savesTo: 'none (read by preconditions + systemPromptAddendum)',
    syncEdge: 'edge 7',
    staleRisk: 'guarded by deriveStepMaps.test.ts + stepMapParity.test.ts',
  },
  {
    area: 'generated bundles',
    file: 'src/onboarding-flow/flows/*-v1.generated.json (6 files)',
    role: 'the flow documents the engine actually loads at runtime',
    authored: 'generated',
    savesTo: 'none (read by useFlow)',
    syncEdge: 'edge 7',
    staleRisk: 'guarded by designerToFlow.test.ts (fails if committed JSON != transform output)',
  },
  {
    area: 'generated bundles',
    file: 'scripts/build-beat-bundle.ts + build-onboarding-combined.ts',
    role: 'generators for beat_contexts.json and onboarding_combined.json',
    authored: 'hand',
    savesTo: 'writes the two src/generated/*.json files',
    syncEdge: 'edge 6 + edge 8',
    staleRisk: 'manual npm run beats:bundle / flow:combined; no cron',
  },
  {
    area: 'generated bundles',
    file: 'scripts/flow-sync/generate-flow.ts',
    role: 'regenerates all *.generated.json flows + stepMaps.generated.ts from designer-source JSONs',
    authored: 'hand',
    savesTo: 'flows/*.generated.json + api stepMaps.generated.ts',
    syncEdge: 'edge 7',
    staleRisk: 'low (test-guarded)',
  },
  {
    area: 'generated bundles',
    file: 'scripts/flow-sync/ingest-captions.ts',
    role: 'Lane B: render clipCaptions.ts -> engine openerCaptions.ts',
    authored: 'hand',
    savesTo: 'renderer/openerCaptions.ts',
    syncEdge: 'edge 14',
    staleRisk:
      'clip changes require re-whisper + re-ingest; greeting clip NOT ingested (separate splashCaptions.ts)',
  },
  {
    area: 'generated bundles',
    file: 'scripts/flow-sync/seed-from-render.ts',
    role: 'ONE-TIME migration: render machine truth at a pinned sha merged over designer-source.json',
    authored: 'hand',
    savesTo: 'designer-source.seeded.json + seed-report.md',
    syncEdge: 'edge 13',
    staleRisk: 'already applied; render commits after the pinned sha are not reflected',
  },
  {
    area: 'generated bundles',
    file: 'scripts/voice-sync/seed_contexts.py',
    role: 'Master Sheet Screens tab -> Supabase screen_contexts upsert',
    authored: 'hand',
    savesTo: 'Supabase screen_contexts',
    syncEdge: 'edge 1 (GitHub Actions cron hourly; GitLab job disabled)',
    staleRisk:
      'DB side low; the frontend bundle (screen_contexts.json) does not follow automatically',
  },
  {
    area: 'generated bundles',
    file: 'scripts/voice-sync/sync_beats_context.py',
    role: 'Master Sheet Beats Context tab -> Supabase beat_contexts + onboarding_globals',
    authored: 'hand',
    savesTo: 'Supabase beat_contexts, onboarding_globals',
    syncEdge: 'edge 3',
    staleRisk:
      'manual only; nothing schedules it, direct Supabase edits get overwritten on next run',
  },
  {
    area: 'generated bundles',
    file: 'scripts/voice-sync/sync_beat_contexts.py',
    role: 'Supabase beat_contexts/onboarding_globals -> beatContexts.generated.json',
    authored: 'hand',
    savesTo: 'api/_lib/llm/onboarding/beatContexts.generated.json',
    syncEdge: 'edge 4',
    staleRisk: 'HIGH (see edge 4 row above)',
  },
  {
    area: 'generated bundles',
    file: 'scripts/voice-sync/seed_beat_contexts.py',
    role: 'bootstrap: hand-authored beatContexts.ts -> Supabase beat_contexts (run once/on promote)',
    authored: 'hand',
    savesTo: 'Supabase beat_contexts',
    syncEdge: 'edge 5',
    staleRisk:
      'reverse edge of #4: running it after Supabase-side edits clobbers them back to the TS copy',
  },
  {
    area: 'generated bundles',
    file: 'scripts/voice-sync/gen_voice_scripts_audio.py + gen_checkin_scripts.py + gen_notifications.py',
    role: 'Sheet tabs -> committed repo files (voiceScriptsAudio.ts, checkin_scripts.ts/.json, notification_copy.ts/.json)',
    authored: 'hand',
    savesTo: 'repo files (render branch / @gg/shared)',
    syncEdge: 'edge 10 + edge 16',
    staleRisk: 'stale until manually re-run + committed on a Sheet change',
  },
  {
    area: 'generated bundles',
    file: 'scripts/voice-sync/sync.py',
    role: 'LEGACY: Voice System tab -> Cartesia TTS -> public/voice/*.mp3 + voice-manifest.json',
    authored: 'hand',
    savesTo: 'public/voice/*.mp3, voice-manifest.json',
    syncEdge: 'edge 16',
    staleRisk: 'predates the Vapi pivot; header says "will likely retire"',
  },
  {
    area: 'generated bundles',
    file: 'scripts/voice-sync/beats_context.snapshot.json + lib/* + tests/ + READMEs + requirements.txt + test-sheet.py',
    role: 'captured Sheet snapshot, shared sheets/supabase/transform/hashing helpers, unit tests, docs',
    authored: 'mixed',
    savesTo: 'none (input/support only)',
    syncEdge: 'none',
    staleRisk: 'low',
  },
  {
    area: 'generated bundles',
    file: 'scripts/onboarding-beats/apply_beats.py',
    role: 'reads a SEPARATE beats Sheet and rewrites context_block in screen_contexts.json on a branch',
    authored: 'hand',
    savesTo: 'src/generated/screen_contexts.json',
    syncEdge: 'edge 2',
    staleRisk: 'HIGH fork risk: a second Sheet writing the same file as the Master Sheet mirror',
  },

  // ---------- audio ----------
  {
    area: 'audio',
    file: 'src/data/voice-manifest.json',
    role: 'phase-1 canonical manifest of 7 pre-recorded MP3s (Supabase Storage voice-assets)',
    authored: 'hand',
    savesTo: 'none (read by useVoicePlayer.ts)',
    syncEdge: 'edge 16 (legacy sync.py can update it)',
    staleRisk: 'legacy; warns not to hardcode project URLs',
  },
  {
    area: 'audio',
    file: 'src/data/voice-lines.csv',
    role: 'Sheet snapshot of the legacy Voice System tab',
    authored: 'generated',
    savesTo: 'none',
    syncEdge: 'edge 16 (legacy sync.py input)',
    staleRisk: 'legacy path only',
  },
  {
    area: 'audio',
    file: 'public/voice/** (88 files: loose MP3s, ob/ Yair-clone WAV clips, onboarding/ SCREEN-ID MP3s)',
    role: 'the served voice assets, referenced by useBeatOpenerMp3, narrationClips, openerCaptions',
    authored: 'mixed',
    savesTo: 'served statically',
    syncEdge: 'render-link-integrity-check.mjs link-checks them on the render branch',
    staleRisk: 'recorded takes are committed by hand; some legacy MP3s are producible by sync.py',
  },

  // ---------- supabase writes (Table 3, ref origin/main) ----------
  {
    area: 'supabase writes',
    file: 'submitProfile.ts (submit_profile)',
    role: 'upserts nickname/age/gender/referral into onboarding_states.data',
    authored: 'hand',
    savesTo: 'onboarding_states.data (jsonb merge)',
    syncEdge: 'none',
    staleRisk: 'low',
  },
  {
    area: 'supabase writes',
    file: 'submitPathChoice.ts (submit_path_choice)',
    role: 'writes the beginner/advanced path column',
    authored: 'hand',
    savesTo: 'onboarding_states.path',
    syncEdge: 'none',
    staleRisk: 'low',
  },
  {
    area: 'supabase writes',
    file: 'submitCategory.ts (submit_category)',
    role: 'writes the chosen category into onboarding_states.data',
    authored: 'hand',
    savesTo: 'onboarding_states.data.category',
    syncEdge: 'none',
    staleRisk: 'low',
  },
  {
    area: 'supabase writes',
    file: 'submitBrainDump.ts (submit_brain_dump)',
    role: 'writes raw brain-dump text (route pre-merges same-turn chunks)',
    authored: 'hand',
    savesTo: 'onboarding_states.data.brainDumpText + brain_dump_raw',
    syncEdge: 'none',
    staleRisk: 'low',
  },
  {
    area: 'supabase writes',
    file: 'submitGoals.ts (submit_goals)',
    role: 'writes canonicalized goals; explicitly no current_step bump',
    authored: 'hand',
    savesTo: 'onboarding_states.data.goals',
    syncEdge: 'none',
    staleRisk: 'test-locked no-bump behavior; easy to "fix" by accident',
  },
  {
    area: 'supabase writes',
    file: 'addHabit.ts (add_habit)',
    role: 'transactional jsonb_set merge of a new habit config',
    authored: 'hand',
    savesTo: 'onboarding_states.data.habitConfigs',
    syncEdge: 'none',
    staleRisk: 'low',
  },
  {
    area: 'supabase writes',
    file: 'updateHabit.ts (update_habit) + removeHabit.ts (remove_habit)',
    role: 'patch or delete a habit config entry',
    authored: 'hand',
    savesTo: 'onboarding_states.data.habitConfigs',
    syncEdge: 'none',
    staleRisk: 'low',
  },
  {
    area: 'supabase writes',
    file: 'recordCheckin.ts (record_checkin)',
    role: 'writes the state-check dimensions, bumps current_step',
    authored: 'hand',
    savesTo: 'onboarding_states.data.stateCheck',
    syncEdge: 'none',
    staleRisk:
      'file has a TODO to also map into daily_checkins at onboarding-complete; not done yet',
  },
  {
    area: 'supabase writes',
    file: 'submitMorningCheckin.ts (submit_morning_checkin)',
    role: 'writes the morning check-in config or a skip flag',
    authored: 'hand',
    savesTo: 'onboarding_states.data.morningCheckin',
    syncEdge: 'none',
    staleRisk: 'low',
  },
  {
    area: 'supabase writes',
    file: 'submitReflectionConfig.ts (submit_reflection_config)',
    role: 'writes the reflection style/time config',
    authored: 'hand',
    savesTo: 'onboarding_states.data.reflectionConfig',
    syncEdge: 'at completion, copied into reflection_settings',
    staleRisk: 'low',
  },
  {
    area: 'supabase writes',
    file: 'submitCustomPrompts.ts (submit_custom_prompts)',
    role: 'writes the user-authored reflection prompts',
    authored: 'hand',
    savesTo: 'onboarding_states.data.customPrompts',
    syncEdge: 'none',
    staleRisk: 'low',
  },
  {
    area: 'supabase writes',
    file: 'submitWeeklyConfig.ts (submit_weekly_config)',
    role: 'writes the weekly-projection day config',
    authored: 'hand',
    savesTo: 'onboarding_states.data.weeklyConfig',
    syncEdge: 'none',
    staleRisk: 'low',
  },
  {
    area: 'supabase writes',
    file: 'advanceStep.ts (advance_step)',
    role: 'the only handler that bare-sets current_step (so back-nav forward re-fires navigation)',
    authored: 'hand',
    savesTo: 'onboarding_states.current_step, status',
    syncEdge: 'none',
    staleRisk: 'low',
  },
  {
    area: 'supabase writes',
    file: 'confirmPlan.ts (confirm_plan, Direct-LLM) + ask_clarification',
    role: 'no-write reads/echoes; completion side effect is client-side POST /api/onboarding/complete',
    authored: 'hand',
    savesTo: 'none',
    syncEdge: 'none',
    staleRisk: 'asymmetric vs the Vapi confirmPlan variant below, which DOES write',
  },
  {
    area: 'supabase writes',
    file: 'Vapi mirror set: submitProfile/submitPathChoice/submitCategory/submitBrainDump/submitGoals/submitCustomPrompts/submitMorningCheckin/submitReflectionConfig/submitWeeklyConfig/addHabit/updateHabit/removeHabit (api/_lib/vapi/handlers/)',
    role: 'same UPSERT/UPDATE shapes as the Direct-LLM lane, plus Realtime broadcast for path-1 sync',
    authored: 'hand',
    savesTo: 'onboarding_states (mirrors Direct-LLM shapes)',
    syncEdge: 'Supabase Realtime -> frontend form auto-fill / step bump',
    staleRisk: 'two independent tool implementations (Direct-LLM + Vapi) to keep in sync',
  },
  {
    area: 'supabase writes',
    file: 'navigateNext.ts (Vapi navigate_next)',
    role: 'server-gated advance using the shared checkAdvanceData',
    authored: 'hand',
    savesTo: 'onboarding_states.current_step, status',
    syncEdge: 'Realtime -> useAgentNavigation',
    staleRisk: 'low',
  },
  {
    area: 'supabase writes',
    file: 'confirmPlan.ts (Vapi variant)',
    role: 'unlike the Direct-LLM confirm_plan, this one DOES write on completion',
    authored: 'hand',
    savesTo: 'onboarding_states.current_step, status',
    syncEdge: 'none',
    staleRisk: 'low',
  },
  {
    area: 'supabase writes',
    file: 'weeklyAddHabit.ts / weeklyUpdateHabit.ts / weeklyArchiveHabit.ts (Vapi Weekly)',
    role: 'add/update/soft-delete a user habit from a Weekly voice session',
    authored: 'hand',
    savesTo: 'user_habits',
    syncEdge: 'none',
    staleRisk: 'low',
  },
  {
    area: 'supabase writes',
    file: 'weeklyComplete.ts (Vapi Weekly)',
    role: 'upserts the completed weekly session',
    authored: 'hand',
    savesTo: 'weekly_sessions (ON CONFLICT anon_id, week_end)',
    syncEdge: 'none',
    staleRisk: 'low',
  },
  {
    area: 'supabase writes',
    file: 'weeklyAdvance.ts',
    role: 'acknowledged no-op; beat sequencing is client-side in the flow engine',
    authored: 'hand',
    savesTo: 'none',
    syncEdge: 'none',
    staleRisk: 'low',
  },
  {
    area: 'supabase writes',
    file: 'reflectionSettings.ts (upsertReflectionSettings)',
    role: 'shared upsert called from onboarding-complete, the settings endpoint, and update_reflection',
    authored: 'hand',
    savesTo: 'reflection_settings',
    syncEdge: 'none',
    staleRisk: 'read by buildSystemPrompt.ts (daily-reflection LLM context) and /api/weekly',
  },

  // ---------- sync edges (Table 4, 16 edges) ----------
  {
    area: 'sync edges',
    file: 'edge 1: Master Sheet Screens tab -> seed_contexts.py -> Supabase screen_contexts',
    role: 'GitHub Actions cron hourly + workflow_dispatch; GitLab job disabled (rules: when: never)',
    authored: 'generated',
    savesTo: 'Supabase screen_contexts',
    syncEdge: 'cron hourly',
    staleRisk:
      'DB side low; the frontend bundle (edge 2) does not follow automatically; sha256 idempotent, never auto-deletes',
  },
  {
    area: 'sync edges',
    file: 'edge 2: Master Sheet Screens tab -> hand transcription -> src/generated/screen_contexts.json',
    role: 'manual edit, ALSO per-screen rewritten by apply_beats.py from a different Sheet',
    authored: 'mixed',
    savesTo: 'src/generated/screen_contexts.json',
    syncEdge: 'manual',
    staleRisk:
      'HIGH fork risk: two writers into one file, no checker asserts bundle == Supabase table',
  },
  {
    area: 'sync edges',
    file: 'edge 3: Master Sheet Beats Context tab -> sync_beats_context.py -> Supabase beat_contexts + onboarding_globals',
    role: 'manual (or --from-json snapshot)',
    authored: 'hand',
    savesTo: 'Supabase beat_contexts, onboarding_globals',
    syncEdge: 'manual',
    staleRisk: 'nothing schedules this; direct Supabase edits get overwritten on next run',
  },
  {
    area: 'sync edges',
    file: 'edge 4: Supabase beat_contexts/onboarding_globals -> sync_beat_contexts.py -> beatContexts.generated.json',
    role: 'README says cron-safe but not wired to any CI',
    authored: 'generated',
    savesTo: 'api/_lib/llm/onboarding/beatContexts.generated.json',
    syncEdge: 'manual (not automated)',
    staleRisk:
      'HIGH: committed file was 10 days stale at inventory time; Supabase edits invisible to the coach until re-run',
  },
  {
    area: 'sync edges',
    file: 'edge 5: beatContexts.ts -> seed_beat_contexts.py -> Supabase beat_contexts (bootstrap)',
    role: 'reverse of edge 4, run once/on promote',
    authored: 'hand',
    savesTo: 'Supabase beat_contexts',
    syncEdge: 'manual, one-time',
    staleRisk:
      'running it after Supabase-side edits clobbers them back to the TS copy (hash guard only skips unchanged rows)',
  },
  {
    area: 'sync edges',
    file: 'edge 6: beatContexts.ts + flow builder step/target_step -> build-beat-bundle.ts -> src/generated/beat_contexts.json',
    role: 'manual npm run beats:bundle',
    authored: 'generated',
    savesTo: 'src/generated/beat_contexts.json',
    syncEdge: 'manual',
    staleRisk: 'two-hop chain; forgetting hop 2 splits backend vs frontend context',
  },
  {
    area: 'sync edges',
    file: 'edge 7: flows/designer-source*.json -> generate-flow.ts -> flows/*.generated.json + stepMaps.generated.ts',
    role: 'manual npm run flow:sync (also runs build-onboarding-combined)',
    authored: 'generated',
    savesTo: 'flows/*.generated.json, api stepMaps.generated.ts',
    syncEdge: 'manual',
    staleRisk:
      'low: test-guarded (designerToFlow.test.ts, deriveStepMaps.test.ts, stepMapParity.test.ts); safe fallback to hand fixture',
  },
  {
    area: 'sync edges',
    file: 'edge 8: flow JSONs + beatContexts + global -> build-onboarding-combined.ts -> src/generated/onboarding_combined.json',
    role: 'npm run flow:combined (also inside flow:sync / beats:bundle)',
    authored: 'generated',
    savesTo: 'src/generated/onboarding_combined.json',
    syncEdge: 'manual',
    staleRisk:
      'feeds beatContexts.ts tool gate (beatContextsExport.test.ts locks it); stale combined = stale tool gating',
  },
  {
    area: 'sync edges',
    file: 'edge 9: Master Sheet Beats Context + Beat Elements tabs -> gen_beat_metadata.py -> beatMetadata.ts',
    role: 'manual, render branch only (script absent on main); as of 2026-07-10 emits only spokenContent/variable/openerMode/openerShowsAsBubble/perElement -- voiceEngine/voiceMode/allowedTools/expectedResponse are retired from this edge and read live from beatsSource.ts instead (see edge 12)',
    authored: 'generated',
    savesTo: 'src/components/flow-designer/beatMetadata.ts',
    syncEdge: 'manual',
    staleRisk:
      'wording marked provisional; Sheet edits after last run silently diverge from what the builder shows for the fields this edge still owns (behavioral fields can no longer diverge, they are no longer authored here)',
  },
  {
    area: 'sync edges',
    file: 'edge 10: Master Sheet Voice Scripts tab -> gen_voice_scripts_audio.py -> voiceScriptsAudio.ts',
    role: 'manual, "re-run to refresh"',
    authored: 'generated',
    savesTo: 'src/components/flow-designer/voiceScriptsAudio.ts',
    syncEdge: 'manual',
    staleRisk: 'sheet rotation changes need a re-run + commit on the render branch',
  },
  {
    area: 'sync edges',
    file: 'edge 11: beatsSource.ts -> export-render-parity.mjs -> dist-flow/parity.json',
    role: 'manual, part of the render deploy (Cloudflare Pages)',
    authored: 'generated',
    savesTo: 'dist-flow/parity.json + _headers',
    syncEdge: 'render deploy step',
    staleRisk: 'no-store headers; parity only as fresh as the last render deploy',
  },
  {
    area: 'sync edges',
    file: 'edge 12: beatsSource.ts (single-store invariant) -> render-consistency-check.mjs + render-link-integrity-check.mjs + beat-metadata-reconcile-check.mjs',
    role: 'manual/CI guard on the render branch',
    authored: 'hand',
    savesTo: 'none',
    syncEdge: 'manual/CI',
    staleRisk:
      'beat-metadata-reconcile-check.mjs (added 2026-07-10) now also fails the build if beatMetadata.ts (edge 9) reintroduces a retired behavioral field or carries a screen_id beatsSource.ts no longer has, and if FlowBuilder.tsx stops reading those fields from beatsSource.ts; still does not check every other onboarding consumer (e.g. a future one) for the same class of drift',
  },
  {
    area: 'sync edges',
    file: 'edge 13: render branch (pinned sha de67b298) -> seed-from-render.ts -> designer-source.seeded.json + seed-report.md',
    role: 'ONE-TIME migration 2026-07-06',
    authored: 'generated',
    savesTo: 'designer-source.seeded.json (already applied)',
    syncEdge: 'one-time',
    staleRisk:
      'render wins copy, base wins wiring; render commits after de67b298 (6 on this branch) are not in the engine unless re-seeded',
  },
  {
    area: 'sync edges',
    file: 'edge 14: render clipCaptions.ts (+ clips manifest) -> ingest-captions.ts -> renderer/openerCaptions.ts',
    role: 'manual npx tsx invocation',
    authored: 'generated',
    savesTo: 'src/onboarding-flow/renderer/openerCaptions.ts',
    syncEdge: 'manual',
    staleRisk:
      '6 long clips carry raw whisper tokenization (safe by design); greeting NOT ingested (separate splashCaptions.ts); clip changes need re-whisper + re-ingest',
  },
  {
    area: 'sync edges',
    file: 'edge 15: render branch (pinned de67b298) -> gg-spec parity-harness (extract-spec.mjs / walk.mjs / compare.mjs) -> baseline/expectations.json + walk.json + PASS/DIFF report',
    role: 'manual; baseline 2026-07-06 committed: 1 PASS / 23 DIFF / 1 NOT-WALKED of 25 beats',
    authored: 'mixed',
    savesTo: 'gg-spec baseline/expectations.json, walk.json',
    syncEdge: 'manual',
    staleRisk:
      'README self-documents drift: staging carried old copy + old MP3 registry vs the render /voice/ob/*.wav set; expectations frozen at de67b298 while the render branch moved on 6 commits',
  },
  {
    area: 'sync edges',
    file: 'edge 16: Master Sheet check-in/notification tabs -> gen_checkin_scripts.py / gen_notifications.py -> checkin_scripts.ts/.json, notification_copy.ts/.json; legacy Voice System tab -> sync.py -> public/voice/*.mp3 + voice-manifest.json',
    role: 'manual npm run checkin:bundle / notifications:bundle; sync.py legacy',
    authored: 'generated',
    savesTo: '@gg/shared repo files; public/voice/*.mp3',
    syncEdge: 'manual',
    staleRisk: 'committed-artifact model: stale until re-run; sync.py "will likely retire"',
  },

  // ---------- gg-spec tooling ----------
  {
    area: 'gg-spec tooling',
    file: 'gg-spec/tools/parity-harness/extract-spec.mjs',
    role: 'reads the render branch at a pinned sha via git show, builds baseline/expectations.json',
    authored: 'hand',
    savesTo: 'gg-spec baseline/expectations.json',
    syncEdge: 'edge 15',
    staleRisk: 'expectations frozen at the pinned sha; render branch has since moved 6 commits',
  },
  {
    area: 'gg-spec tooling',
    file: 'gg-spec/tools/parity-harness/walk.mjs',
    role: 'walks the deployed preview render and records what it finds',
    authored: 'hand',
    savesTo: 'gg-spec walk.json',
    syncEdge: 'edge 15',
    staleRisk: 'only as fresh as the deployed preview it walks',
  },
  {
    area: 'gg-spec tooling',
    file: 'gg-spec/tools/parity-harness/compare.mjs',
    role: 'diffs expectations.json against walk.json, emits PASS/DIFF report',
    authored: 'hand',
    savesTo: 'none (report only)',
    syncEdge: 'edge 15',
    staleRisk: 'baseline run recorded 1 PASS / 23 DIFF / 1 NOT-WALKED of 25 beats',
  },
];
