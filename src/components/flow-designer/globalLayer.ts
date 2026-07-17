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
