export type EnforcementStatus = 'REAL' | 'PARTIAL' | 'NOT-IMPLEMENTED';

export interface GlobalEnforcer {
  readonly id: string;
  readonly status: EnforcementStatus;
}

export interface GlobalRule {
  readonly id: string;
  readonly severity: 'MUST' | 'SHOULD';
  readonly title: string;
  readonly text: string;
  readonly example?: string;
  readonly enforcedBy: readonly GlobalEnforcer[];
}

export interface ReactiveSlot {
  readonly id: string;
  readonly responseRows: readonly {
    readonly label: string;
    readonly value: string;
  }[];
}

export interface GlobalContract {
  readonly id: string;
  readonly responsibility: string;
}

const partial = (id: string): GlobalEnforcer => ({ id, status: 'PARTIAL' });
const notImplemented = (id: string): GlobalEnforcer => ({ id, status: 'NOT-IMPLEMENTED' });
const real = (id: string): GlobalEnforcer => ({ id, status: 'REAL' });

export const GLOBAL_LAYER_PROVENANCE =
  'PROPOSED FULL SET, pending the blessing; behavior unverified; activation blocked';

export const GLOBAL_LAYER_RULES: readonly GlobalRule[] = [
  { id: 'GR-01', severity: 'MUST', title: 'Precedence', text: 'Self-harm/crisis handling overrides all onboarding behavior. Other global rules override beat rules; beat rules override script detail. A lower layer may tighten, never loosen, a higher layer.', enforcedBy: [partial('eval:parity-walk')] },
  { id: 'GR-02', severity: 'MUST', title: 'No improvisation', text: 'Coach output is locked script or one of the eight locked reactive rotations. No beat may open free improvisation. The sole Cartesia exception is the profile greeting `Awesome {name}, two quick things so I can tailor this to you.`; all other coach output uses the approved recorded/text path.', example: 'Cartesia exception: Awesome {name}, two quick things so I can tailor this to you.', enforcedBy: [notImplemented('eval:verbatim-opener'), partial('audio-ownership-check')] },
  { id: 'GR-03', severity: 'MUST', title: 'Heavy disclosure and crisis', text: 'For an ordinary hard disclosure, stop the onboarding task, acknowledge briefly, and do not push back to setup. For self-harm, suicidal intent, or crisis, stop onboarding, use the canonical crisis instruction/resource that must be wired in implementation step 1, do not continue the flow in that response, and resume only after a later user message clearly chooses to return to setup.', enforcedBy: [partial('eval:parity-walk')] },
  { id: 'GR-04', severity: 'MUST', title: 'Current-beat scope', text: 'Handle only the current beat. Never narrate or begin the next beat before navigation occurs.', enforcedBy: [notImplemented('eval:edge-walk')] },
  { id: 'GR-05', severity: 'MUST', title: 'No skip', text: 'No response, redirect, turn-cap branch, UI edge, or tool call may offer or execute a skip. A stuck or declining user receives the locked nudge and remains on the beat until required data is valid.', enforcedBy: [notImplemented('eval:edge-walk'), partial('advance-gate-check')] },
  { id: 'GR-06', severity: 'MUST', title: 'Invalid input', text: 'Do not store invalid or unparsed input. Use the re-ask slot once and wait.', enforcedBy: [notImplemented('eval:invalid-value-redirect'), partial('persistence-contract-check')] },
  { id: 'GR-07', severity: 'MUST', title: 'Carry forward', text: 'Never re-ask a captured value. Downstream beats read canonical state.', enforcedBy: [notImplemented('eval:carry-forward'), partial('persistence-contract-check')] },
  { id: 'GR-08', severity: 'MUST', title: 'Privacy and invisible machinery', text: 'Do not read account details or stored values back unprompted. Do not narrate beats, screens, tools, saving, loading, or system actions.', enforcedBy: [notImplemented('eval:no-machinery-words')] },
  { id: 'GR-09', severity: 'MUST', title: 'Silent options and empty entry', text: 'Do not read option labels before selection. Pickers enter with nothing selected and do not advance while empty.', enforcedBy: [notImplemented('eval:no-read-options'), notImplemented('eval:single-select')] },
  { id: 'GR-10', severity: 'MUST', title: 'Post-pick silence', text: 'After a pick, emit no praise or commentary; perform required tool work and wait for the next scripted moment. There is no habit-acknowledgment exception unless Yair separately re-locks one.', enforcedBy: [notImplemented('eval:silent-after-pick')] },
  { id: 'GR-11', severity: 'MUST', title: 'Slot 1: off-topic', text: '`onboard_offtopic`: briefly acknowledge, restate the current beat question, do not answer the tangent, and do not advance.', enforcedBy: [notImplemented('eval:out-of-scope-decline'), partial('audio-ownership-check')] },
  { id: 'GR-12', severity: 'MUST', title: 'Slot 2: tool failure', text: '`onboard_toolfail_voice`: retry once silently. On the voice path, if that retry fails, remain on the beat, play the locked failure line, retry once more, and if it still fails keep the failure surfaced and offer the tap path. On text/tap, the second failure shows only the locked retry toast, with no coach line. Never report success before persistence succeeds.', enforcedBy: [partial('tool-contract-check'), partial('persistence-contract-check'), partial('audio-ownership-check')] },
  { id: 'GR-13', severity: 'MUST', title: 'Slot 3: re-ask', text: '`onboard_reask`: one warm re-ask for unclear or invalid input, then wait.', enforcedBy: [notImplemented('eval:invalid-value-redirect'), partial('audio-ownership-check')] },
  { id: 'GR-14', severity: 'MUST', title: 'Slot 4: empty', text: '`onboard_empty`: one light nudge when a required picker/capture surface is empty, then wait without advancing.', enforcedBy: [partial('advance-gate-check'), partial('audio-ownership-check')] },
  { id: 'GR-15', severity: 'MUST', title: 'Slot 5: narrow', text: '`onboard_narrow`: when category or goals input exceeds the allowed count, ask for the one that matters most and wait.', enforcedBy: [notImplemented('eval:selection-cap'), partial('audio-ownership-check')] },
  { id: 'GR-16', severity: 'MUST', title: 'Slot 6: create own', text: '`onboard_createown`: when the desired item is off-list and custom input is supported, invite custom entry and capture it.', enforcedBy: [partial('tool-contract-check'), partial('audio-ownership-check')] },
  { id: 'GR-17', severity: 'MUST', title: 'Slot 7: nudge', text: '`onboard_nudge`: when stuck, declining, or at the redirect cap, give one locked tap/answer nudge and wait. This is not a skip edge. This slot is the only coach-speech exception to the general ban on tap instructions.', enforcedBy: [notImplemented('eval:edge-walk'), partial('audio-ownership-check')] },
  { id: 'GR-18', severity: 'MUST', title: 'Slot 8: gender', text: '`onboard_gender`: after age, ask the gender follow-up once; never re-ask a captured value.', enforcedBy: [notImplemented('eval:carry-forward'), partial('audio-ownership-check')] },
  { id: 'GR-19', severity: 'MUST', title: 'Eight-slot closure', text: 'The reactive toolkit contains exactly these eight slots because the 2026-07-10 copy decision closes the v1 taxonomy: off-topic, tool-failure voice, re-ask, empty, narrow, create-own, nudge, and gender. Tool failure is slot 2, not a ninth family. Per-beat reactive variants and a separate max-turn family are retired. Select randomly from the approved variations within the matched slot. A new slot or a cross-slot trigger requires a new copy decision; it is not folded into an unrelated slot or silently dropped. If a spoken slot has no verified playable variation, voice release is blocked and the coach must not synthesize replacement copy.', enforcedBy: [notImplemented('decisions-coverage-check'), partial('audio-ownership-check')] },
  { id: 'GR-20', severity: 'MUST', title: 'Voice ownership', text: 'Every spoken response identifies one owner: recorded clip/family, explicit text-only, or the one named Cartesia exception. A family marked pending or lacking assets is not release-ready and must not be described as recorded.', enforcedBy: [partial('audio-ownership-check'), real('render-link-integrity-check')] },
  { id: 'GR-21', severity: 'MUST', title: 'Contract-B advancement', text: 'Profile, fork, category, and goals self-advance exactly once through their submit handler. Their tool set excludes `confirm_step_complete`. Multi-item habit/braindump screens retain an explicit done signal.', enforcedBy: [partial('tool-contract-check'), partial('advance-gate-check')] },
  { id: 'GR-22', severity: 'MUST', title: 'Profile gate and gender routing', text: 'Profile completion requires nickname/name, valid age, and gender. `referralSource` is optional. Persist Male/Female/Other; route Female and Other to the female path, and Male to the default path.', enforcedBy: [partial('persistence-contract-check'), partial('advance-gate-check')] },
  { id: 'GR-23', severity: 'MUST', title: 'Selection caps', text: 'Beginner habit selection has the visible two-habit limit. Advanced capture has a 50-habit safety cap that is never mentioned by coach or UI. Reaching either cap never creates a skip path.', enforcedBy: [notImplemented('eval:selection-cap'), partial('advance-gate-check')] },
  { id: 'GR-24', severity: 'MUST', title: 'Completion destination', text: 'Completion requires the persisted v1 data named by decision #42, then lands on Home with the plan visible. No separate v1 home tour is inserted; the built change-later reflection screen and its locked copy remain.', enforcedBy: [partial('persistence-contract-check'), notImplemented('eval:edge-walk'), notImplemented('eval:verbatim-opener')] },
  { id: 'GR-25', severity: 'SHOULD', title: 'Short, human, language-matched turns', text: 'Use the approved warm, direct, one-line copy; select only approved rotations. Match the user\'s active language only when an approved localized line exists, without changing canonical stored values.', enforcedBy: [notImplemented('eval:one-line-then-wait'), notImplemented('eval:warm-opener')] },
  { id: 'GR-26', severity: 'MUST', title: 'Tool and persistence boundary', text: 'Use only the active screen\'s allowed tools, pass canonical values rather than raw phrasing, do not claim a write succeeded until it did, and do not advance after a failed required write.', enforcedBy: [partial('tool-contract-check'), partial('persistence-contract-check'), partial('advance-gate-check')] },
];

export const GLOBAL_REACTIVE_SLOTS: readonly ReactiveSlot[] = [
  { id: 'onboard_offtopic', responseRows: [{ label: 'response', value: 'Briefly acknowledge, then restate the current beat question; do not answer the tangent or advance.' }, { label: 'voice owner', value: 'clip-family:onboard_offtopic (pending recording/assets)' }] },
  { id: 'onboard_toolfail_voice', responseRows: [{ label: 'voice response', value: "That didn't go through, let me try again." }, { label: 'text/tap response', value: 'Locked retry toast only after the second failure; no coach line.' }, { label: 'voice owner', value: 'clip-family:onboard_toolfail_voice (pending recording/assets)' }] },
  { id: 'onboard_reask', responseRows: [{ label: 'response', value: 'One warm re-ask of the current beat question for unclear or invalid input, then wait.' }, { label: 'voice owner', value: 'clip-family:onboard_reask (pending recording/assets)' }] },
  { id: 'onboard_empty', responseRows: [{ label: 'response', value: 'One light nudge when a required picker or capture surface is empty, then wait without advancing.' }, { label: 'voice owner', value: 'clip-family:onboard_empty (pending recording/assets)' }] },
  { id: 'onboard_narrow', responseRows: [{ label: 'response', value: 'Ask the user to pick the one that matters most when category or goals input exceeds the allowed count.' }, { label: 'voice owner', value: 'clip-family:onboard_narrow (pending recording/assets)' }] },
  { id: 'onboard_createown', responseRows: [{ label: 'response', value: 'Invite custom entry when nothing on the list fits and custom input is supported.' }, { label: 'voice owner', value: 'clip-family:onboard_createown (pending recording/assets)' }] },
  { id: 'onboard_nudge', responseRows: [{ label: 'response', value: 'One locked tap/answer nudge when stuck, declining, or at the redirect cap; this is not a skip edge.' }, { label: 'voice owner', value: 'clip-family:onboard_nudge (pending recording/assets)' }] },
  { id: 'onboard_gender', responseRows: [{ label: 'response', value: 'Ask the gender follow-up once after age; never re-ask a captured value.' }, { label: 'voice owner', value: 'clip-family:onboard_gender (pending recording/assets)' }] },
];

export const GLOBAL_AMENDED_CONTRACTS: readonly GlobalContract[] = [
  { id: 'TOOL_FAILURE', responsibility: 'Retry/failure sequence, voice-versus-tap behavior, failed-write hold, and no false success.' },
  { id: 'CONVERSATION_MODEL', responsibility: 'Current-beat turn boundaries, locked response model, and no independent generative branch.' },
  { id: 'VOICE_OWNERSHIP', responsibility: 'One declared output owner per spoken line, with pending assets blocking voice release.' },
  { id: 'DATA_PASSING', responsibility: 'Canonical persisted values, carry-forward behavior, and no raw-phrase leakage where enums apply.' },
  { id: 'COACH_TOOL_BOUNDARY', responsibility: 'Active-screen tool allow-list and Contract-B advancement ownership.' },
];

export interface GlobalDisplayRow {
  readonly label: string;
  readonly value: string;
}

export interface GlobalEnforcementRegistryRow {
  readonly id: string;
  readonly kind: 'static check' | 'QA evaluator';
  readonly status: EnforcementStatus;
  readonly meaning: string;
  readonly owner: string;
}

export interface GlobalDataContract {
  readonly id: string;
  readonly producer: string;
  readonly consumers: string;
  readonly shape: string;
  readonly persistence: string;
  readonly invariant: string;
}

export interface GlobalDecision {
  readonly id: string;
  readonly question: string;
  readonly decision: string;
}

export const GLOBAL_LAYER_TOPIC_RULE_IDS = {
  authority: ['GR-01', 'GR-03'],
  coach: ['GR-02', 'GR-04', 'GR-08', 'GR-20', 'GR-25'],
  input: ['GR-06', 'GR-09', 'GR-10', 'GR-13', 'GR-14', 'GR-15', 'GR-16', 'GR-17', 'GR-18', 'GR-19', 'GR-22', 'GR-23'],
  progress: ['GR-05', 'GR-07', 'GR-21', 'GR-24', 'GR-26'],
  failure: ['GR-12'],
} as const;

export const GLOBAL_LAYER_CONFLICT_SEMANTICS =
  'A narrower trigger wins only when it does not loosen another MUST; unresolved MUST conflicts or overlapping slots block activation rather than inventing coach copy. SHOULD never overrides MUST.';

export const GLOBAL_CONVERSATION_MODEL: readonly GlobalDisplayRow[] = [
  { label: 'Coach identity', value: 'The coach is the LLM. Every non-scripted coach turn is an LLM turn; the orb and bubbles are its face.' },
  { label: 'Governance', value: 'The global layer governs every turn above per-beat rules, conversation, prose, and tools; prose never overrides a rule.' },
  { label: 'Multi-turn default', value: 'One coach line, then wait. Do not chain questions, narrate the next beat, or open a free-improvisation window.' },
  { label: 'Off-topic default', value: 'Briefly acknowledge, restate the current beat question, do not answer the tangent, and do not advance.' },
  { label: 'Unsure picker default', value: 'No brainstorm/help-you-decide branch. Use the plain re-ask plus the tap path; remain on the current beat.' },
  { label: 'Voice ownership', value: 'Locked script and locked reactive rotations own spoken output. The profile name greeting is the sole live Cartesia exception; every other spoken global response must resolve to an approved recorded/text path.' },
];

export const GLOBAL_DATA_PASSING_ROWS: readonly GlobalDisplayRow[] = [
  { label: 'Forward transport', value: 'Captured values travel forward in the flow-state manager under canonical keys; submit persists the value but the flow continues from memory.' },
  { label: 'Route boundary', value: 'Use a URL query parameter only where a page-era route boundary loses in-memory state.' },
  { label: 'Forbidden', value: 'Do not re-fetch a just-submitted value from the database/profile during the same flow. The database is the record, not the courier.' },
  { label: 'Cold resume', value: 'Only cold resume/refresh hydration reads back: saved state hydrates flow state once, then the in-memory rule resumes.' },
  { label: 'Coach/tool boundary', value: 'Tools are the only LLM-to-backend connection. Persistence, navigation, and state changes flow through tools; the coach never writes state another way.' },
  { label: 'Advance ownership', value: 'Contract-B advancement is server/tool-owned after successful required persistence; no UI, response, or coach text may claim or execute success early.' },
];

export const GLOBAL_TOOL_FAILURE_ROWS: readonly GlobalDisplayRow[] = [
  { label: 'First failure', value: 'Retry once silently.' },
  { label: 'Voice path', value: 'On a second failure, remain on the beat, play `onboard_toolfail_voice` (“That didn’t go through, let me try again.”), retry once more, then keep failure surfaced and offer tap.' },
  { label: 'Text/tap path', value: 'On the second failure, show only the locked retry toast: “Couldn’t save that, tap to retry”; no coach line.' },
  { label: 'Never', value: 'Never report success, advance, or clear the required capture before persistence succeeds.' },
];

export const GLOBAL_CONSUMER_CONTRACT: readonly GlobalDisplayRow[] = [
  { label: 'phone preview (component render)', value: 'Read component rows as render assertions. Today: NOT WIRED; preview still has component-internal values.' },
  { label: 'script/audio playback', value: 'Read script plus metadata/ownership per line. Today: PARTIAL; script drives playback while metadata is display-only.' },
  { label: 'engine (advance/branch)', value: 'Read flow gates and BeatIO for movement. Today: NOT WIRED; engine logic lives in app code.' },
  { label: 'coach (LLM context assembly)', value: 'Read global layer plus per-beat rules/conversation/prose/tools. Today: NOT WIRED; coach reads generated context lineage, not this display contract.' },
  { label: 'guards', value: 'Resolve every declared enforcer against the registry and reject unknown IDs. Today: NOT WIRED; retired annotation parsing cannot see this display.' },
  { label: 'QA fleet (walks)', value: 'Read acceptance and edge rows as the walk checklist. Today: PARTIAL; parity walks exist without ID linkage.' },
];

const registryStatus = (id: string): EnforcementStatus => {
  if (id === 'render-link-integrity-check') return 'REAL';
  if (['advance-gate-check', 'tool-contract-check', 'audio-ownership-check', 'persistence-contract-check', 'eval:parity-walk'].includes(id)) return 'PARTIAL';
  return 'NOT-IMPLEMENTED';
};

const registry = (id: string, kind: GlobalEnforcementRegistryRow['kind'], meaning: string, owner: string): GlobalEnforcementRegistryRow => ({ id, kind, status: registryStatus(id), meaning, owner });

export const GLOBAL_ENFORCEMENT_REGISTRY: readonly GlobalEnforcementRegistryRow[] = [
  registry('render-consistency-check', 'static check', 'beatsSource structural invariants', 'render'),
  registry('render-link-integrity-check', 'static check', 'script bindings and clip ids resolve', 'render'),
  registry('type-check', 'static check', 'TypeScript compilation without emit', 'repo'),
  registry('bible-registry-check', 'static check', 'resolves bible enforcer IDs and section coverage', 'render guards'),
  registry('render-rules-check', 'static check', 'rules checker port for the bible schema', 'render guards'),
  registry('id-alias-check', 'static check', 'beat ID alias map is generated and unique', 'render guards'),
  registry('reveal-timing-check', 'static check', 'reveals gate on clip end, never timers', 'render guards'),
  registry('component-registry-check', 'static check', 'component, variant, state, and no-preselection match registry', 'render guards'),
  registry('audio-ownership-check', 'static check', 'spoken output has a legal voice owner', 'render guards'),
  registry('tool-contract-check', 'static check', 'tools and args match application registry', 'app'),
  registry('advance-gate-check', 'static check', 'advance gates match application preconditions', 'app'),
  registry('persistence-contract-check', 'static check', 'persistence rows match handler writes', 'app'),
  registry('decisions-coverage-check', 'static check', 'every beat maps the governing decisions', 'render guards'),
  registry('eval:verbatim-opener', 'QA evaluator', 'opener emits the declared verbatim copy', 'fleet'),
  registry('eval:no-read-options', 'QA evaluator', 'coach does not recite on-screen options', 'fleet'),
  registry('eval:no-contrarian', 'QA evaluator', 'coach does not undercut the user selection', 'fleet'),
  registry('eval:no-platitudes', 'QA evaluator', 'no filler or performative language', 'fleet'),
  registry('eval:warm-opener', 'QA evaluator', 'category opener is warm and specific', 'fleet'),
  registry('eval:name-the-goal', 'QA evaluator', 'habit opener names the goal', 'fleet'),
  registry('eval:count-agnostic', 'QA evaluator', 'wording works for one or two goals', 'fleet'),
  registry('eval:keep-the-gem', 'QA evaluator', 'habit-moment coaching point survives', 'fleet'),
  registry('eval:first-person-reflection', 'QA evaluator', 'reflection prompts are first-person and mirror daily set', 'fleet'),
  registry('eval:one-line-then-wait', 'QA evaluator', 'one line then wait; no chaining', 'fleet'),
  registry('eval:no-machinery-words', 'QA evaluator', 'no beat, step, screen, or tool language', 'fleet'),
  registry('eval:carry-forward', 'QA evaluator', 'captured values are not re-asked', 'fleet'),
  registry('eval:single-select', 'QA evaluator', 'overflow is narrowed to one selection', 'fleet'),
  registry('eval:silent-after-pick', 'QA evaluator', 'no post-pick coach output before next scripted moment', 'fleet'),
  registry('eval:ack-each-habit', 'QA evaluator', 'declared per-habit acknowledgement is verbatim', 'fleet'),
  registry('eval:invalid-value-redirect', 'QA evaluator', 'invalid input is not stored and receives one re-ask', 'fleet'),
  registry('eval:out-of-scope-decline', 'QA evaluator', 'off-topic input is declined and steered back', 'fleet'),
  registry('eval:parity-walk', 'QA evaluator', 'full flow walk against render expectations', 'fleet'),
  registry('eval:edge-walk', 'QA evaluator', 'per-beat edge behavior is walked live', 'fleet'),
  registry('eval:selection-cap', 'QA evaluator', 'declared selection min/max is enforced', 'fleet'),
];

export const GLOBAL_RETIRED_ENFORCER_MAPPINGS: readonly GlobalDisplayRow[] = [
  { label: 'eval:no-contrarian-turn', value: 'retired → eval:no-contrarian' },
  { label: 'eval:no-praise-pick', value: 'retired → eval:silent-after-pick' },
  { label: 'parity-walk', value: 'retired → eval:parity-walk' },
];

export const GLOBAL_CANONICAL_ENUMS: readonly GlobalDisplayRow[] = [
  { label: 'Gender enum', value: 'Stored profile values: Female, Male, Other. Only Female selects women’s art; Male and Other receive default art. Other never propagates past capture.' },
  { label: 'Category enum', value: 'Sleep better; Move more; Eat better; Feel more energized; Reduce stress; Improve focus; Break bad habits; Get more organized. Create-your-own is the custom string escape.' },
];

export const GLOBAL_RESOLVED_DATA_CONTRACTS: readonly GlobalDataContract[] = [
  { id: 'profile', producer: 'profile asks via submit_profile', consumers: 'gender routing and coach context', shape: '{ age: number, gender: Female | Male | Other }', persistence: 'onboarding_states.data.age and .gender; cold resume hydrates once', invariant: 'Only Female routes to category-women; Other never propagates downstream.' },
  { id: 'path-and-category', producer: 'fork via submit_path_choice; category via submit_category', consumers: 'beginner/advanced branch and goals picker', shape: 'path = beginner | advanced; category = canonical label or custom string', persistence: 'onboarding_states.data.path and .category', invariant: 'Custom category carries its exact string and opens custom-goal entry.' },
  { id: 'goals', producer: 'goals-list or goal-custom via submit_goals', consumers: 'per-goal habit picker and schedule routing', shape: '{ goals: string[], source: canonical | custom }, length 1 or 2', persistence: 'onboarding_states.data.goals replaces selection without advancing', invariant: 'Two goals allow one habit each; custom text remains verbatim.' },
  { id: 'habits', producer: 'habit picker, custom, advanced capture/schedule', consumers: 'plan and weekly-projection frames', shape: 'onboarding.habits = [{ name, goal?, custom, days, buildOrBreak?, time?, reminder? }]', persistence: 'onboarding_states.data.habitConfigs plus advanced raw input', invariant: 'Projection preserves every chosen name and normalized schedule; no samples.' },
  { id: 'morning-ritual', producer: 'morning setup via submit_morning_checkin', consumers: 'plan and morning ritual runtime', shape: '{ time, days, reminder } with locale work-week days', persistence: 'onboarding_states.data.morningCheckin', invariant: 'A ritual, not an onboarding habit; locale resolves days.' },
  { id: 'reflection-ritual', producer: 'reflection setup via submit_reflection_config/custom prompts', consumers: 'plan and evening reflection runtime', shape: '{ style, customPrompts?, time, days, reminder }', persistence: 'reflection_settings plus onboarding-state mirror', invariant: 'Saved style and custom prompts replay word for word.' },
  { id: 'state-check', producer: 'state check via record_checkin adapter', consumers: 'first daily_checkins record and coach context', shape: '{ sleep, mood, energy, stress }, each 1 through 5', persistence: 'onboarding state then one atomic daily_checkins write', invariant: 'Complete payload only; never advances on failed write.' },
  { id: 'plan-completion', producer: 'plan via confirm_plan', consumers: 'app entry, resume guard, projection', shape: '{ confirmed: true }', persistence: 'atomic completed-state update', invariant: 'Approval is the only completion action; failed write never advances.' },
  { id: 'weekly-projection', producer: 'resolved habits plus locale rituals', consumers: 'weekly projection frames', shape: '{ rituals, habits, weekStart, frame }', persistence: 'display-only', invariant: '76% and 35% are projections over real rows; gaps uses final two blank columns.' },
  { id: 'render-export', producer: 'render build', consumers: 'phone, coach, engine, guards, QA', shape: 'resolved parity and contract artifacts from one source commit', persistence: 'versioned build artifacts', invariant: 'Generated contexts are derived and equality-checked, never a second authority.' },
];

export const GLOBAL_DECISIONS: readonly GlobalDecision[] = [
  { id: 'multi-turn-placement', question: 'Where does the multi-turn model live?', decision: 'Its own conversation section; tone/behavior rules remain separate.' },
  { id: 'registry-staging', question: 'How may planned enforcement IDs appear?', decision: 'They may be registry-listed during build-out, with an owner; release requires MUST enforcers to be real.' },
  { id: 'variant-as-beat', question: 'How do variants avoid copied contracts?', decision: 'Use beat/sub-beat inheritance; parent carries shared parts and variants override differences.' },
  { id: 'improvise-boundaries', question: 'Which improvisation windows exist?', decision: 'OFF for onboarding. No per-beat improvise windows; use the locked off-topic/re-ask behavior.' },
  { id: 'gender-enum', question: 'What gender values and routing are canonical?', decision: 'Female, Male, Other are capture values; only Female selects women’s art; Other never propagates downstream.' },
  { id: 'tool-failure-copy', question: 'How does failure surface?', decision: 'One silent retry; voice line then tap offer; text/tap toast; never claim success before persistence.' },
  { id: 'category-labels', question: 'Which categories are canonical?', decision: 'The rendered eight labels in order are locked; Create-your-own remains custom.' },
  { id: 'uniform-sections', question: 'May beats omit sections?', decision: 'No. Every beat declares the uniform shape as filled, derived, or N/A with reason.' },
  { id: 'weekly-projection-real-habits', question: 'What does “This is your week” show?', decision: 'Real selected habits and schedules with projected outcomes; hard-coded sample habits are forbidden.' },
  { id: 'ritual-work-week-cadence', question: 'Which work-week cadence applies?', decision: 'Israel: Sunday–Thursday; elsewhere: Monday–Friday; resolve from locale/region.' },
];

export const GLOBAL_UNRESOLVED_GOVERNANCE: readonly GlobalDisplayRow[] = [
  { label: 'Activation', value: 'Blocked pending blessing, canonical crisis stop/resource wiring, and the named behavioral test targets.' },
  { label: 'Enforcement', value: 'The registry is display/audit truth, not an executable dispatcher; every MUST needs a real release gate before activation.' },
  { label: 'Open product items', value: 'No unresolved product decisions are recorded in the old decision library; remaining items are governance and implementation blockers.' },
];
