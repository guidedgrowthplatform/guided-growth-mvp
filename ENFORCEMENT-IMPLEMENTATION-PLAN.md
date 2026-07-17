# Enforcement Implementation Plan

**Date:** 2026-07-17  
**Goal:** turn the 15 IDs audited in `ENFORCEMENT-AUDIT.md` into named, runnable controls with deterministic pass/fail output and required invocation.  
**Scope:** plan only; no code changes. `beatsSource.ts` now contains other `eval:*` labels; they are outside this request and must be audited separately rather than silently folded into this plan.

**Audited set:** `advance-gate-check`, `tool-contract-check`, `render-link-integrity-check`, `audio-ownership-check`, `id-alias-check`, `reveal-timing-check`, `component-registry-check`, `eval:edge-walk`, `eval:no-read-options`, `eval:parity-walk`, `decisions-coverage-check`, `eval:verbatim-opener`, `persistence-contract-check`, `eval:no-platitudes`, and `eval:silent-after-pick`. Audit baseline: 1 REAL, 6 PARTIAL, 8 NOT IMPLEMENTED.

| Audit status | IDs |
|---|---|
| REAL | `render-link-integrity-check` |
| PARTIAL | `advance-gate-check`, `tool-contract-check`, `audio-ownership-check`, `component-registry-check`, `eval:parity-walk`, `persistence-contract-check` |
| NOT IMPLEMENTED | `id-alias-check`, `reveal-timing-check`, `eval:edge-walk`, `eval:no-read-options`, `decisions-coverage-check`, `eval:verbatim-opener`, `eval:no-platitudes`, `eval:silent-after-pick` |

## Operating rule

`beatsSource.ts` is authoritative for authored beat/rule claims. The live app is authoritative for runtime tool, transition, persistence, component, and audio behavior. The locked decision documents are authoritative for approved copy/decision values. Move the literal TypeScript extraction already duplicated in the render scripts into one small helper and reuse its normalized object.

Every failure reports `enforcedBy ID → rule ID → beat ID → expected → actual`. Each must-rule is split into atomic assertion clauses. Each clause has exactly one canonical owner ID and one required test/check; any other ID on the same rule is a reference to that clause, not a duplicate assertion. The registry rejects zero owners, multiple owners, missing invocations, and must-rules with unowned clauses. Runtime authority stays in the app; the render repository checks authored-contract integrity and parity only.

**Effort units:** S = at most 2 engineer-days, M = 3–5 engineer-days, L = 6–10 engineer-days, including focused tests and CI wiring but excluding review/deploy wait. Re-estimate before implementation if source inspection invalidates an interface named below.

**Owners:** Render owner = `gg-render-bugs` maintainers/CODEOWNERS; App owner = onboarding API/UI maintainers in `gg-ground/gg-mvp`; QA owner = `gg-spec` onboarding/QA maintainers. A control cannot move homes without approval from both its current and proposed owner because that changes its authority boundary.

## Ownership and acceptance map

| ID | Canonical home / owner | Acceptance evidence | Blocking dependency |
|---|---|---|---|
| `render-link-integrity-check` | Render CI / Render owner | Source/asset/text-reference cases pass; negative fixture fails | Shared extractor |
| `audio-ownership-check` | Render parity check / Render + App owners | Every audio row matches app lookup; wrong engine/slot/asset fixture fails | Exported lookup fixture |
| `id-alias-check` | Render cross-repo check / Render + App owners | Every declared alias is bijective; duplicate/unknown alias fixture fails | App identity fixture |
| `component-registry-check` | App component test / App owner | Every declared component mounts with exact props; unknown prop/key fixture fails | Stable registry export |
| `tool-contract-check` | App runtime tests / App owner | Offer and dispatch reject undeclared names/args/order; render drift fixture fails | Render contract fixture |
| `persistence-contract-check` | App integration tests / App owner | Exact write/read/resume/re-ask cases pass; unexpected DB diff fails | QA reset + test DB |
| `decisions-coverage-check` | Render CI / Render + QA owners | Every must decision maps to rule/assertion; orphan or stale decision fails | Machine-readable decision rows |
| `advance-gate-check` | App runtime/browser tests / App owner | Every declared trigger/edge is exact and idempotent; early/duplicate/wrong edge fails | Render contract fixture |
| `reveal-timing-check` | Browser test / App owner | Reveal is absent before boundary and present after; early/late fixture fails | Controllable audio/events |
| six `eval:*` IDs | Existing app test runner plus browser only when needed / QA + App owners | Required scenario per owned clause emits passing normalized trace; negative fixture fails | Scenario rows + event trace |

These are acceptance criteria, not evidence that implementation already exists. “Full” is awarded only after the named positive and negative cases run in the required gate.

## Sequence

1. **Quick CI wins:** require the existing render checks in report mode, then blocking mode.
2. **Static contract checks:** complete link, audio, alias, component, tool, persistence, decision, and advance coverage.
3. **Browser/runtime checks:** reveal timing and the interaction portions of advance gating.
4. **Conversation harness:** implement the six `eval:*` IDs and publish transcripts/event traces.
5. **Full-control gate:** fail CI for any unimplemented ID, uncovered must-rule, stale waiver, or cross-repo contract mismatch.

## The 15 controls

### 1. `render-link-integrity-check` — REAL, harden and gate — S

- **Claims it must verify (source quotes):** “`coach_greeting` resolves to a real asset”; “The rendered words equal the full source `script[0].words`”; “the beat does not advance before the greeting clip's end event.” This control owns only link/asset/text-reference integrity; timing remains with the advance/reveal controls.
- **Home:** render check script, required in CI. It is deterministic source/asset integrity, not live behavior.
- **Mechanics:** read `beatsSource.ts`, `public/voice`, and renderer binding declarations. For every script line, require a valid target and an existing clip when declared; for rules that say rendered words equal `script[].words`, mount the renderer and compare its text to that source value. Fail with beat/seq/target/clip and expected versus actual. Keep playback timing out of this check.
- **Dependencies:** shared parser helper; focused renderer test for the cited text-equality rules. The existing asset/binding checks can become blocking immediately.

### 2. `audio-ownership-check` — PARTIAL → full — M

- **Claims it must verify (source quotes):** “The greeting resolves to a recorded clip; no live Cartesia”; “The greeting resolves to live Cartesia BECAUSE it carries the `{name}` slot”; “playback uses the source clip rather than live synthesis.”
- **Home:** render check script wired into CI. Engine/slot/asset ownership is a static contract; actual emitted opener identity is covered by `eval:verbatim-opener`.
- **Mechanics:** read each beat’s `voiceEngine`, `voiceMode`, script `clip`, `clipPath`, words, and slots, plus the app’s existing clip/engine lookup. Pass only when: MP3/Verbatim lines resolve to the declared file and have no unresolved slot; Cartesia/Generative lines have an approved slot and no recorded-only claim; silent beats have no clip; and production lookup selects the declared asset/engine. Fail on engine/mode/slot/clip disagreement. Do not invent a transcript catalog; `script[].words` is the expected text.
- **Today’s exact gap:** `check:links` proves only that a named file exists. It does not validate engine, mode, slots, ownership, production mapping, or recorded-vs-live policy.
- **Delta:** add the audio matrix and production mapping comparison; keep emitted-audio verification in the eval harness.
- **Dependencies:** shared parser helper; importable app audio lookup or a checked-in test fixture generated by that lookup.

### 3. `id-alias-check` — NOT IMPLEMENTED — M

- **Claims it must verify (source quotes):** “beatId (canonical): onboarding-beat-1-splash”; “persisted current_step: splash”; “data-beat-id: splash.” Equivalent rows for `screenId`, route, and `session_log` must map to the same canonical beat; documented null `screenId` exceptions remain explicit.
- **Home:** render cross-repo check in CI. Alias drift is deterministic and should fail before runtime.
- **Mechanics:** read normalized identity/alias rows plus app route constants, generated onboarding flow, screen/context keys, persistence step enum, session-log event values, and rendered `data-beat-id` mapping. Require every non-`none` declared alias to exist exactly once and map back to one canonical beat; reject duplicate aliases, undeclared app aliases, and exceptions without an explicit waiver. Output the surface and both values.
- **Dependencies:** shared parser helper; import the app constants/generated maps directly in app CI. Add a manifest only if module boundaries make direct import impossible.

### 4. `component-registry-check` — PARTIAL → full — M

- **Claims it must verify (source quotes):** “component (registry key): profile-beat”; “an age input and a gender selector (Male / Female / Other)”; “age free entry; gender single-select, nothing preselected.” Other beats supply the equivalent key, controls/options, selection mode, cap, and initial-state claims.
- **Home:** render check plus focused component tests, both in CI. Registry existence/props are static; visible controls and initial state need component rendering.
- **Mechanics:** compare normalized component rows with an exported renderer registry and component config (`key`, required props, options, cap, single/multi-select, preselection). Mount each registry entry with its beat fixture and query stable roles/test IDs for declared controls and initial state. Pass only when the key resolves, required props are supplied, option values/caps match, and the intended component mounts without fallback.
- **Today’s exact gap:** current checks validate required beat fields and script element IDs, not registry keys, component availability, props, options, caps, or instantiated component.
- **Delta:** export registry metadata and add table-driven mount tests generated from the contract.
- **Dependencies:** extractor; stable component registry export; stable accessible selectors.

### 5. `tool-contract-check` — PARTIAL → full — M

- **Claims it must verify (source quotes):** “Only submit_profile and advance_step are callable on this beat”; “submit_profile passes the canonical gender enum ... not the raw words”; “Call record_checkin exactly once after all four cards hold an integer score.”
- **Home:** app runtime gate plus contract-parity tests in app CI. Authorization must remain at dispatch; static parity alone cannot stop a bad call.
- **Mechanics:** generate a per-screen tool contract from app-owned schemas/handlers and compare it with normalized render `allowedTools`/rules. At runtime retain both gates: offer only allowed schemas and reject any unoffered name. Add handler/route tests that attempt every disallowed tool, missing precondition, invalid enum, duplicate call, and valid call; inspect tool arguments and event log. Pass only when names, argument schema, preconditions, cardinality, and persistence target match the declared contract.
- **Today’s exact gap:** the live double gate correctly limits tool names, but does not prove render parity, arguments, ordering/preconditions, “once” semantics, or persistence promises.
- **Delta:** machine-readable parity manifest plus negative/positive dispatch tests for all declared beat contracts.
- **Dependencies:** stable canonical beat/alias map; exported tool schemas; persistence contract map.

### 6. `persistence-contract-check` — PARTIAL → full — L

- **Claims it must verify (source quotes):** “writes: the user name and the authenticated session”; “the name, once captured at sign-up, is carried forward ... never re-ask”; “an authenticated session past sign-up proves this beat is done on refresh.”
- **Home:** app integration tests in the QA harness. Writes, reads, resume, and re-entry require a real handler/database boundary, not source linting.
- **Mechanics:** derive fixtures from each beat’s `dataIn`, `dataOut`, and persistence rows. For each contract, reset a QA user, invoke the real handler/tool with canonical input, snapshot allowed tables/session state before and after, reload at the declared resume key, then enter the first downstream consumer. Pass only when exactly the declared fields change, values/schema are correct, resume selects the correct beat, downstream context receives the value, and the coach does not ask for a persisted “never re-ask” field. Unexpected writes fail.
- **Today’s exact gap:** handlers persist real data and some preconditions read it; `verify:objective1` only checks that rich-data fields exist. No per-beat comparison covers schema, exact writes, resume, later reads, or re-ask behavior.
- **Delta:** table-driven DB probes and resume/downstream conversation cases keyed by rule ID.
- **Dependencies:** canonical aliases; QA user reset endpoint/material; deterministic database snapshot/redaction; tool contracts.

### 7. `decisions-coverage-check` — NOT IMPLEMENTED — S

- **Claims it must verify (source quotes):** “decision: 1, 2 (profile gates: age + gender required, gender not skippable)”; “this beat IS the render side of the profile gates”; “decision: 6, 7 ... this beat IS the render side of the reflection decisions.” Each remaining locked decision must be marked applicable or explicitly not applicable.
- **Home:** render check script in CI. This is document/contract coverage.
- **Mechanics:** convert the approved decision ledger into a small JSON/YAML register with ID, status, affected beats/rules, and evidence target. Compare it with each beat’s `applicableDecisions`. Pass when every locked decision has all expected binding beats, every beat accounts for the decision set or has an allowed N/A, each binding points to at least one rule/check, and no `PENDING` decision is treated as locked. Fail on missing, extra, stale, or evidence-free coverage.
- **Dependencies:** structured version of `gg-spec/docs/onboarding-copy-decisions-2026-07-10.md`; canonical beat IDs.

### 8. `advance-gate-check` — PARTIAL → full — L

- **Claims it must verify (source quotes):** “the user taps Get started”; “auto-advances when the greeting clip ends”; “Do not advance when any dimension is absent.” Acceptance also requires that a valid trigger advances exactly once and does not skip the next beat.
- **Home:** split control with one ID: app runtime gate for state/preconditions, plus browser event tests for tap/clip/UI gates. A script cannot enforce live navigation, and browser tests alone cannot secure dispatch.
- **Mechanics:** normalize every beat’s advance condition into trigger (`tap`, `clip-end`, `auth`, `tool-success`, `all-fields-valid`, structural), destination, preconditions, and max jump. Runtime `advance_step` checks the current canonical beat, exact allowed destination, and required persisted payload; reject missing, stale, duplicate, or skip attempts using the route’s existing request-scoped duplicate-call protection rather than adding a new token system. Browser tests inject clock/audio events and assert zero transition before the trigger and exactly one afterward, including double tap and duplicate clip-end. Pass only when all declared beats have a gate case and all negative cases stay put.
- **Today’s exact gap:** live code checks selected persisted preconditions and limits forward jumps to two; it does not consume every declared condition, enforce exact edges, cover UI/clip/tap/auth triggers, or guarantee exactly-once navigation.
- **Delta:** per-beat transition manifest, exact-next validation using existing duplicate-call protection, and generated browser gate cases.
- **Dependencies:** alias map; normalized edge/flow manifest; stable navigation/audio instrumentation; persistence checks.

### 9. `reveal-timing-check` — NOT IMPLEMENTED — L

- **Claims it must verify (source quotes):** “gender selector revealed after the age prompt finishes”; “the sleep card blooms, GATED on seq 1 clip end”; “each card reveal gates on the prior line clip end, never a fixed timer.”
- **Home:** browser/component integration tests in CI. Timing and DOM visibility are observable UI behavior.
- **Mechanics:** extract each script line’s target and reveal trigger into fixtures. Mount the beat with a fake audio adapter exposing `play`, progress, and `ended(seq)`; use fake timers to prove elapsed time alone does not reveal gated elements. Assert initial visibility, emit each declared clip-end, and require only the next target to become visible, once, in order. Also test missing/duplicate/out-of-order events and audio failure fallback where specified.
- **Dependencies:** machine-readable reveal trigger (replace prose-only parsing); injectable audio adapter; stable element IDs/test IDs.

### 10. `eval:edge-walk` — NOT IMPLEMENTED — L

- **Claims it must verify (source quotes):** “user speaks over the greeting ... ignore input and let the greeting finish, then advance”; “auth error ... keep the sign-in options visible ... never advance on failure”; “permission blocked at OS level ... fall back to typing and advance.”
- **Home:** QA conversation/browser harness. Edges span model output, tools, UI events, and persistence.
- **Mechanics:** turn every `edges.rows[]` entry into a scenario: start beat + seeded state, user/system event, expected next beat, expected tool calls, speech/audio constraints, and DB diff. Execute against the real route with deterministic model fixtures for rule-focused cases and a nightly live-model run for drift. Pass only when every declared edge has a scenario and the event trace exactly matches expected destination, calls, and writes; unknown edges fail coverage.
- **Dependencies:** shared harness runner/event trace; QA reset; aliases; tool/persistence/advance manifests.

### 11. `eval:no-read-options` — NOT IMPLEMENTED — M

- **Claims it must verify (source quotes):** “Never reads the three styles out loud; they are on the screen”; “Never reads the two choices aloud as a list”; “Never reads the category tiles aloud, not in full, not one as an example.”
- **Home:** QA conversation harness. This is emitted speech behavior.
- **Mechanics:** for every rule, seed the beat before a choice, capture assistant text plus TTS/clip transcript events, and compare against the visible option labels from component config. Fail if output contains any full label not present in the locked opener, enumerates two or more labels, or triggers option audio; pass when the expected opener/question occurs and the turn ends waiting with no tool call. Include paraphrase fixtures judged by a narrow rubric only after deterministic lexical checks.
- **Dependencies:** component option export; transcript/event capture; canonical opener set.

### 12. `eval:parity-walk` — PARTIAL → full — L

- **Claims it must verify (source quotes):** “No coach audio, bubble, transcript line, or improvised greeting is emitted because `script` is empty”; “The tool-call log remains empty before and after the tap”; “A before/after persistence snapshot has no user-data mutation because `dataOut` is empty.” Equivalent parity assertions apply to spoken and interactive beats.
- **Home:** QA end-to-end harness, with a static parity precheck. Cross-surface parity requires walking production-shaped behavior.
- **Mechanics:** create one golden scenario per beat plus each path variant. Load the render contract fixture in the app test, then walk the app while capturing canonical beat, visible component/options, spoken clip/text identity, offered/called tools, transition, and DB diff. Pass only when each observed field equals the contract and all beats/variants are visited. Produce a field-level diff, not a score.
- **Today’s exact gap:** the app parity test verifies tool names exist, LLM beats have contexts, and an interactive beat keeps a progression tool. It does not import the render contract or walk UI, scripts, voice, routes, branches, transitions, or persistence.
- **Delta:** importable render fixture plus full beat/path scenarios and trace comparison.
- **Dependencies:** completed static checks; harness runner; QA reset; deterministic model fixtures.

### 13. `eval:verbatim-opener` — NOT IMPLEMENTED — M

- **Claims it must verify (source quotes):** “Speaks the recorded greeting verbatim, no improvised lead-in or addition”; “Speaks the greeting verbatim (with the user name filled)”; “Speaks the framing and the fork question verbatim, no improvised lead-in or filler tail.”
- **Home:** QA conversation/audio harness. Static transcript equality is necessary but not sufficient; emitted output must be observed.
- **Mechanics:** obtain expected text from `script[].words`. Enter each beat from a clean prior state and capture the first assistant audio/text event. Normalize only encoding, whitespace, and approved slot values. Pass on exact token equality and correct clip ID/engine; fail on any prefix, suffix, paraphrase, duplicate opener, wrong clip, or live synthesis where MP3 is required.
- **Dependencies:** audio/text event capture; seeded user name; audio ownership check.

### 14. `eval:no-platitudes` — NOT IMPLEMENTED — M

- **Claims it must verify (source quotes):** “Gives no advice on what the user reports”; “No filler or praise”; “No ‘both are totally fine’ or any reassurance tail after the question.”
- **Home:** QA conversation harness. This governs generated output, not source structure.
- **Mechanics:** maintain a reviewed policy file tied to rule IDs: banned exact phrases/patterns, forbidden speech slots (after question/selection), and maximum allowed response shape. Run representative user replies for each cited beat; deterministic checks fail on banned patterns, extra sentences after the locked question, or output in a forbidden slot. A narrow judge rubric flags semantic praise/advice for report review first; promote only stable cases to blocking.
- **Dependencies:** conversation fixtures; event segmentation; approved policy/rubric; canonical opener exclusion so required copy is not falsely flagged.

### 15. `eval:silent-after-pick` — NOT IMPLEMENTED — M

- **Claims it must verify (source quotes):** “Silent after the pick: no praise, no commentary”; “nothing except submit_category and advance_step”; “nothing except add_habit, remove_habit and advance_step.”
- **Home:** QA conversation/browser harness. Silence is an event-sequence property after a UI action.
- **Mechanics:** select each supported option and custom value, mark the pick timestamp, and capture assistant text, TTS, clip, tool, and navigation events until the next beat’s opener boundary. Pass when the interval contains only the declared mutation tool(s) and one advance, with no assistant speech/audio; attribute the next beat opener to the next beat. Repeat for duplicate taps and add/remove flows. Fail on any extra assistant emission, extra tool, duplicate write, or missing transition.
- **Dependencies:** event timestamps/beat attribution; tool and advance idempotency; component fixtures.

## CI wiring

### Phase 0 — report mode, fixed to 20 PRs or 7 days

Add a `render-enforcement-report` job after install and before tests. Run in this order so failures are causal:

1. `npm run check:render` — source shape and single-source integrity.
2. `npm run check:links` — bindings/assets.
3. `npm run verify:objective1` — baseline/rich-data drift.
4. New `npm run check:enforcement-registry` — every one of the 15 IDs resolves to a checker/harness owner and every must-rule citing one of them has an owned assertion.

Each command initially writes its normal output to the PR summary and uploads it as an artifact. The job is non-blocking for at most 20 PRs or 7 days; crashes remain visible as job failures, but the workflow does not block merging during this fixed observation window. Do not add a baseline/waiver service. At the cutoff, fix known failures or record a dated, owner-named exception in the repository, then remove non-blocking mode.

### Phase 1 — required static gates

After report mode, update `check:beats` to call, once and in this order: `check:render`, `check:links`, `verify:objective1`, `check:enforcement-registry`, then the completed static controls for decisions, aliases, component registry, audio ownership, tool parity, and persistence schema parity. Make only `npm run check:beats` the required render-repository branch gate; the leaf commands remain directly runnable for diagnosis. This avoids running `check:render` and `check:links` twice.

### Phase 2 — required app and browser gates

In the app repository, require tool-contract dispatch tests, persistence integration tests, exact advance-gate tests, component mounts, and reveal timing tests. These tests load a checked-in render-contract fixture generated from the same commit when the repositories are synchronized; CI fails if regeneration changes the fixture. Do not add a bidirectional artifact service or runtime dependency.

### Phase 3 — eval gates

Run deterministic harness fixtures on every PR for the six IDs: `eval:edge-walk`, `eval:no-read-options`, `eval:parity-walk`, `eval:verbatim-opener`, `eval:no-platitudes`, and `eval:silent-after-pick`. Run live-model drift cases nightly and on release. Begin judge-based `no-platitudes` cases in report mode; deterministic event/text violations block immediately. Required status reports per-ID scenario coverage and links to redacted transcripts/traces.

## Eval harness plan: existing versus net-new

### Build on what exists

- `gg-spec/skills/committee/codex-qa.sh` supplies a runnable model-lens wrapper; use it for adversarial review of failed transcripts, not as the product conversation runner.
- `gg-spec/skills/committee/committee.sh`, `green_gate.py`, and verifier materials supply report aggregation, reviewer roles, and a green/red bookend pattern.
- `gg-spec/docs/onboarding-copy-decisions-2026-07-10.md` supplies locked opener/copy decisions and forbidden reactive patterns.
- `gg-spec/docs/onboarding-render-singlesource-and-sync-2026-07-17.md` and render-sync specs supply single-source/versioning direction.
- App tests already provide route mocks, onboarding handler/registry/precondition fixtures, parity assertions, and `api/qa` user reset primitives to reuse.

### Net-new, kept minimal

1. `qa/onboarding/scenarios/*.json`: start beat/state, event or user turn, expected events, next beat, and DB diff; each file lists the rule IDs it covers.
2. One scenario runner that uses the app's existing route-test helpers for conversation/tool cases and Playwright only when DOM/audio/navigation observation is required. Both paths emit the same normalized event trace (`beat`, assistant text, clip/TTS, tool offer/call/result, navigation, persistence diff) and accept deterministic model fixtures.
3. One assertion library: exact text/clip, silence window, forbidden option labels, allowed tools/order, next beat, and DB diff.
4. One plain JSON/JUnit report: per-ID coverage, failures, redacted transcript, and event trace. Committee scripts may read it; the harness does not depend on them.
5. A nightly live-model adapter. It reuses the same scenarios/assertions; it is not a second harness.

Do **not** build a general-purpose evaluator platform, autonomous judge loop, or runtime dependency on the committee scripts. The product harness is table-driven tests; committee tooling reviews ambiguity and summarizes evidence.

## Definition of full control

This 15-ID program is green only when: all 15 audited IDs have a registered required invocation; every must-rule citing one of those IDs has a passing owned assertion; the checked-in app fixture matches the render source; no dated exception is expired; deterministic PR gates pass; and nightly/release live-model runs have zero untriaged violations. Other `eval:*` labels already present in `beatsSource.ts` remain a separately reported audit backlog and cannot be represented as implemented. Until then, report status per ID (`REAL`, `PARTIAL`, `NOT IMPLEMENTED`), not as one optimistic percentage.

## Adversarial review result

- **Vagueness:** green after replacing generic claim summaries with 2–3 direct source-rule quotes and explicit inputs/pass/fail mechanics for every ID.
- **Wrong-home choices:** green. Static drift lives in render CI; security/state authority stays in app runtime; emitted conversation and cross-surface behavior live in the QA harness/browser.
- **Dependencies:** green after making aliases, the render fixture, QA reset, event tracing, audio injection, and stable component selectors explicit.
- **PARTIAL deltas:** green. All six audit PARTIALs state today’s exact behavior gap and the concrete closing delta.
- **Scope control:** green. One extractor, one event trace, one scenario format, and one assertion library are shared; no general evaluator platform or new runtime committee dependency is proposed.
