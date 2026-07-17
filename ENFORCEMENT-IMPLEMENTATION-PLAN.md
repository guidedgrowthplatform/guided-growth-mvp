# Enforcement Implementation Plan

**Date:** 2026-07-17  
**Scope:** plan only; no implementation or validation is claimed here.  
**Baseline:** `ENFORCEMENT-AUDIT.md` audits these 15 IDs as 1 REAL, 6 PARTIAL, and 8 NOT IMPLEMENTED.

## Minimal approach

Use the runners already present: Node render scripts, Vitest app/API tests, and the existing Playwright setup only for DOM timing/navigation. Do not add an enforcement registry, a second test runner, live-model gating, cross-repository SHA pins, raw transcript uploads, waivers, digest reruns, or new retention policy. For cross-repository checks, copy the normalized `beatsSource.ts` contract into an app test fixture in the implementation PR and review both changes together; the test fails when the fixture and app disagree.

Effort: **S** ≤2 engineer-days, **M** 3–5, **L** 6–10, including tests and CI wiring.

## Sequence

1. Wire the four existing render commands into CI in report mode, then make them required.
2. Finish deterministic source-contract checks: links, audio, aliases, decisions.
3. Finish app Vitest controls: components, tools, persistence, advance, and deterministic conversation evals.
4. Add only the Playwright cases that must observe reveal or navigation timing.

## The 15 controls

### 1. `render-link-integrity-check` — REAL — S

- **Claims:** “`coach_greeting` resolves to a real asset”; “The rendered words equal the full source `script[0].words`”; “the six check-in clips resolve to real assets.”
- **Home:** existing `scripts/render-link-integrity-check.mjs`, required in render CI; these are deterministic source-to-asset/binding checks.
- **Mechanics:** read `beatsSource.ts`, declared component/script targets, and `public/voice`. For every cited rule, require the target token to be legal, every declared clip path to exist, and every rule claiming rendered-word equality to have a renderer test comparing visible text with the referenced `script[seq].words`. Fail with ID, rule ID, beat ID, sequence, expected path/text, and actual value.
- **Dependencies:** reuse the extraction pattern already in the two render scripts; no new runner. Timing claims remain owned by `advance-gate-check` or `reveal-timing-check`.

### 2. `audio-ownership-check` — PARTIAL → full — M

- **Claims:** “The greeting resolves to a recorded clip; no live Cartesia”; “The greeting resolves to live Cartesia BECAUSE it carries the `{name}` slot”; “playback uses the source clip rather than live synthesis.”
- **Home:** render Node check, required in CI; engine/mode/slot/asset ownership is a static authored contract.
- **Mechanics:** read each beat's voice engine/mode and every script line's words, clip, clip path, and live slots. Compare those rows with the app audio-selection map used in production. Pass only when recorded lines have an existing declared asset and no live slot, live lines have the declared permitted slot and no recorded-only assertion, silent lines select no audio, and the app map chooses the same engine/asset. Fail on the first beat/sequence mismatch.
- **Current gap:** `check:links` proves only that a named asset exists; it does not check engine, mode, slots, recorded-versus-live policy, or the production selection.
- **Delta:** add one table-driven audio-contract check and expose/import the production audio-selection map for that test.
- **Dependencies:** app audio-selection map; `render-link-integrity-check` for file existence.

### 3. `id-alias-check` — NOT IMPLEMENTED — M

- **Claims:** “beatId maps to the screenId / route / step / session_log / data-beat-id in identity”; “persisted current_step: splash”; “data-beat-id: splash.”
- **Home:** render Node check in CI; aliases are deterministic identifiers and should fail before runtime.
- **Mechanics:** read each beat's identity rows and the app's generated flow, route/screen constants, persisted step values, session-log names, and rendered `data-beat-id` map. Pass when each non-empty declared alias exists exactly once and maps back to the same canonical beat. Fail on duplicate, missing, extra, or cross-beat mappings; allow only explicit `none` values already authored in the beat.
- **Dependencies:** an importable app identity map, or one generated JSON fixture if direct import is impossible.

### 4. `component-registry-check` — PARTIAL → full — M

- **Claims:** “component (registry key): profile-beat”; “an age input and a gender selector (Male / Female / Other)”; “age free entry; gender single-select, nothing preselected.”
- **Home:** existing app Vitest suite; the app registry and rendered component are runtime authority.
- **Mechanics:** make a table from authored component key, controls, options, selection mode, cap, and initial state. For each row, resolve the key through the actual registry, mount the component with the beat props, and query roles/test IDs. Pass only when the intended component—not a fallback—mounts and the declared controls/options/cap/preselection match. Include negative fixtures for an unknown key and wrong option/cap.
- **Current gap:** current render scripts validate beat fields and element IDs only; they do not resolve registry keys, mount components, or check props/options/caps/state.
- **Delta:** export the existing component registry for tests and add one table-driven mount test.
- **Dependencies:** stable registry export and existing component test utilities.

### 5. `tool-contract-check` — PARTIAL → full — M

- **Claims:** “Only `submit_profile` and `advance_step` are callable on this beat”; “`submit_profile` passes the canonical gender enum ... not the raw words”; “Call `record_checkin` exactly once after all four cards hold an integer score.”
- **Home:** existing app runtime gate plus app Vitest tests; only dispatch rejection can enforce calls, while tests prove the full authored contract.
- **Mechanics:** keep the confirmed offer-time filter and dispatch rejection. Feed normalized per-beat `allowedTools`, argument shapes, call conditions, and cardinality into table-driven tests of `registry.ts`, `beatContexts.ts`, and the route dispatcher. Pass when offered names equal the declaration, every unoffered name is rejected, invalid/missing arguments fail, calls before conditions fail, duplicate “once” calls have no second effect, and valid calls reach the named handler with canonical values.
- **Current gap:** the double gate enforces tool names, but not parity with `beatsSource.ts`, argument semantics, ordering/preconditions, once-only behavior, or persistence promises.
- **Delta:** add the render contract fixture and positive/negative cases around the existing gates; do not replace the gates.
- **Dependencies:** canonical alias map; exported schemas/handlers; persistence cases for write assertions.

### 6. `persistence-contract-check` — PARTIAL → full — L

- **Claims:** “the user name and the authenticated session”; “the name, once captured at sign-up, is carried forward; later beats greet by it, never re-ask”; “an authenticated session past sign-up proves this beat is done on refresh.”
- **Home:** existing app/API Vitest integration tests; writes, reload, and downstream reads belong at the handler/database boundary.
- **Mechanics:** build cases from authored data-in/data-out/persistence rows. Using the existing QA reset/test-user support, seed a user, invoke the real handler, read only the named tables/session fields before and after, reload from the declared step, and call the next consumer. Pass when exactly the declared fields change, the correct next beat is restored, the downstream context receives the value, and a persisted “never re-ask” value is not requested again. Fail on missing or unexpected writes, wrong resume beat, or re-ask.
- **Current gap:** handlers persist data and some preconditions read it; `verify:objective1` checks only structural field presence, not exact writes, reload/resume, downstream reads, or re-ask behavior.
- **Delta:** add table-driven handler/database/resume tests keyed by beat and rule ID.
- **Dependencies:** existing `api/qa-reset.ts` behavior or equivalent test setup; alias map; tool-contract cases.

### 7. `decisions-coverage-check` — NOT IMPLEMENTED — S

- **Claims:** “1, 2 (profile gates: age + gender required, gender not skippable)”; “this beat IS the render side of the profile gates”; “this beat IS the render side of the reflection decisions.”
- **Home:** render Node check in CI; this is static coverage between the approved decision ledger and authored beats.
- **Mechanics:** read `/home/ggvoice/gg-spec/docs/onboarding-copy-decisions-2026-07-10.md` and each beat's applicable-decision rows. Parse only the ledger's numbered decision headings/status and declared affected beat/rule references. Pass when every locked decision appears on all named beats, every beat reference points to an existing rule, and pending decisions are not asserted as locked. Fail on missing, stale, unknown, or rule-less references.
- **Dependencies:** keep the existing decision document's numbered format stable; no new decision database or registry.

### 8. `advance-gate-check` — PARTIAL → full — L

- **Claims:** “the user taps Get started”; “auto-advances when the greeting clip ends”; “Do not advance when any dimension is absent.”
- **Home:** existing app runtime gate for tool/state edges, with existing Playwright only for tap/clip navigation; source scripts cannot enforce live transitions.
- **Mechanics:** make a fixture per authored edge: current beat, trigger, required state, exact next beat. Extend `advanceStep.ts`/precondition tests so a valid request advances exactly to that next beat, while missing state, stale current beat, duplicate request, and any skip fail without state change. Add Playwright cases only for tap and clip-end triggers: assert no navigation before the event and one navigation after it, including double tap/duplicate end.
- **Current gap:** today's code checks selected persisted preconditions and permits a forward jump up to two; it does not enforce every authored trigger, exact next edge, UI/audio triggers, or exactly-once navigation.
- **Delta:** replace the two-step allowance with declared exact-next validation, cover every authored precondition, and add the minimal tap/clip cases.
- **Dependencies:** alias/edge map; existing request deduplication; controllable audio event in browser tests.

### 9. `reveal-timing-check` — NOT IMPLEMENTED — M

- **Claims:** “gender selector revealed after the age prompt finishes”; “the sleep card blooms, GATED on seq 1 clip end”; “each card reveal gates on the prior line clip end, never a fixed timer.”
- **Home:** existing component Vitest tests where the audio adapter is injectable; use Playwright only if the production component cannot be mounted with that adapter.
- **Mechanics:** for each reveal rule, mount the beat with fake audio events and fake timers. Assert the target is absent/hidden initially, advancing time alone does not reveal it, the declared `ended(seq)` reveals only the expected target, and duplicate/out-of-order events do not reveal additional targets. Fail on early, late, wrong-target, or repeated reveal.
- **Dependencies:** expose the existing audio-event callback to the test and use stable target IDs.

### 10. `eval:edge-walk` — NOT IMPLEMENTED — L

- **Claims:** “user speaks over the greeting ... ignore input and let the greeting finish, then advance”; “auth error ... keep the sign-in options visible ... never advance on failure”; “permission blocked ... fall back to typing and advance.”
- **Home:** deterministic app/API Vitest conversation harness, plus existing Playwright only for the OS/UI fallback edge; these scenarios span route output, tools, state, and sometimes UI.
- **Mechanics:** one scenario per authored edge with seeded beat/state, scripted user/system event, fixture model response, expected spoken text class, tool calls, state changes, and next beat. Invoke the real route/dispatcher with the fixture response and record a small in-memory event array (`speech`, `tool`, `state`, `navigation`). Pass when every edge has a scenario and the ordered events equal its expected outcome. No live-model run and no persisted raw transcript.
- **Dependencies:** shared scenario table and event recorder described below; advance and persistence controls.

### 11. `eval:no-read-options` — NOT IMPLEMENTED — M

- **Claims:** “Never reads the two choices aloud as a list; the cards show them, ask the question then wait”; “Never reads the category tiles aloud, not in full, not one as an example”; “Never reads sub-lists or anything the screen is not currently showing.”
- **Home:** deterministic app/API Vitest conversation harness; this judges emitted coach text/audio events, not prompt wording.
- **Mechanics:** run each option-bearing beat with its scripted fixture response before selection. Normalize emitted speech text only by whitespace/case, then fail if it contains any authored option label or if an audio event references option copy. Require no option-reading event before the selection event; a negative fixture that reads one label must fail.
- **Dependencies:** scenario table/event recorder; authored option labels.

### 12. `eval:parity-walk` — PARTIAL → full — L

- **Claims:** “Do not read the two choices out loud, and add no reassurance tail”; “Collect one category ... Ask what they most want to work on, then wait”; “Collect one or two goals ... Do not read the tiles out loud, do not coach or explain per goal.”
- **Home:** extend the existing app Vitest `beat-context-parity.test.ts`; it already owns generated-flow/context parity.
- **Mechanics:** iterate every authored beat and compare canonical ID/screen, active context, allowed tools, opener/script mode, component key, and declared outgoing edges with the app generated flow and beat context. For beats with conversation rules, execute the shared deterministic scenario and compare emitted event types with the authored voice/tool/edge contract. Pass only when every beat and every compared field has a case; report beat/field/expected/actual.
- **Current gap:** the existing test checks valid tool names, context presence, progression tools, and selected anti-improvisation strings; it does not walk all beats or compare scripts, voice, components, routes, branches, or emitted behavior.
- **Delta:** source the full authored fixture and add field-by-field plus scenario coverage to that test file.
- **Dependencies:** alias map; component/tool/advance fixtures; shared scenario table.

### 13. `eval:verbatim-opener` — NOT IMPLEMENTED — M

- **Claims:** “Speaks the recorded greeting verbatim, no improvised lead-in or addition”; “Speaks the greeting verbatim (with the user name filled), no improvised lead-in or addition”; “Speaks the framing opener and the four questions verbatim, no improvised lead-in.”
- **Home:** deterministic app/API Vitest conversation harness; exact emitted opener text or selected clip identity is observable there.
- **Mechanics:** for recorded beats, require the first speech event to reference the declared clip and no generated speech before it. For generated verbatim beats, compare the first emitted text after whitespace normalization with the authored opener exactly. Fail on prefix, suffix, substitution, wrong clip, or any preceding speech event; include one failing altered-opener fixture.
- **Dependencies:** scenario table/event recorder; audio ownership contract.

### 14. `eval:no-platitudes` — NOT IMPLEMENTED — M

- **Claims:** “Gives no advice on what the user reports; one warm line, then moves on”; “No filler or praise; recommend a time, let them set it, move on”; “No per-category commentary or filler (\"sleep is the foundation\", \"genuinely\").”
- **Home:** deterministic app/API Vitest conversation harness; prompt text alone is not enforcement.
- **Mechanics:** for each cited beat, the scenario fixture supplies representative user input and the approved response pattern from the authored script/context. Pass when emitted coach text is either the declared verbatim line or matches the beat's finite allowed response set, contains none of a short reviewed forbidden list attached to that rule, emits at most the allowed line count, and then performs the declared transition. A fixture containing a forbidden filler phrase must fail.
- **Dependencies:** rule-local allowed/forbidden phrases approved in `beatsSource.ts`; scenario table/event recorder. Do not use a probabilistic classifier.

### 15. `eval:silent-after-pick` — NOT IMPLEMENTED — M

- **Claims:** “Silent after the pick: no praise, no commentary, nothing except `submit_category` and `advance_step`”; “Silent after each pick: no praise, no commentary, nothing except `submit_goals` and `advance_step`”; “Silent after each pick: no praise or commentary, nothing except `add_habit`, `remove_habit` and `advance_step`.”
- **Home:** deterministic app/API Vitest conversation harness, with Playwright only if the selection is handled solely in the browser.
- **Mechanics:** emit a selection event, then collect events until the next-beat navigation/state event. Pass when that interval contains no coach text, TTS request, or clip-play event and exactly one transition occurs. Fail on acknowledgement text/audio, delayed speech, missing transition, or duplicate transition; include one failing acknowledgement fixture.
- **Dependencies:** scenario table/event recorder; advance-gate cases.

## CI wiring

Use the existing `.github/workflows/ci.yml` `build` job after `npm ci` and before the production build.

**Report-mode PR, in order:** `npm run check:render`, `npm run check:links`, then `npm run verify:objective1`, each with `continue-on-error: true`. This exposes the three distinct existing outputs; `check:beats` is not also run because it currently duplicates the first two. Each command prints its normal concise failure output to the job log. Do not upload raw stdout, transcripts, database contents, or diagnostics.

**Required-gate PR, in order:** extend `check:beats` to run `check:render`, `check:links`, and the new static enforcement scripts, then require (1) `npm run check:beats` and (2) `npm run verify:objective1` with normal failing exit codes. The `build` job already gates its dependent release jobs through `needs: build`; no cross-workflow status plumbing is proposed. The report-to-required change is an explicit reviewed PR, not a time/PR counter.

New app Vitest controls run in the app repository's existing test command and become required there. Existing Playwright CI receives only the reveal/navigation cases that cannot run under Vitest.

## Eval harness: existing versus net-new

**Build on existing materials**

- `beatsSource.ts`: rule text, script words, options, tools, edges, and `enforcedBy` ownership.
- `/home/ggvoice/gg-spec/docs/onboarding-copy-decisions-2026-07-10.md`, `onboarding-beats-authoring-plan-2026-07-16.md`, and the render-sync specs: approved decisions and contract inputs. No executable conversation harness or scenario corpus exists in the inspected `gg-spec` materials.
- `/home/ggvoice/gg-ground/gg-mvp/api/_lib/__tests__/beat-context-parity.test.ts`: existing Vitest parity test to extend.
- Existing onboarding registry/dispatch/handler tests and `api/qa-reset.ts`: route, tool, and persistence setup.
- Existing Playwright configuration: only for browser-observable timing/navigation.

**Net-new, and only these two shared pieces**

1. A table of deterministic scenarios keyed by `enforcedBy` ID and rule ID: initial beat/state, scripted input or system event, fixture model output, and expected events.
2. A small in-memory event recorder used by the existing route/test doubles to capture ordered `speech`, `audio`, `tool`, `state`, and `navigation` events.

Each of the six `eval:*` IDs is a named Vitest `describe` block over that table. Test output contains only the failing scenario key and expected/actual event types or normalized text; it is not retained as a CI artifact. Live-provider behavior may be observed separately, but it is not part of deterministic enforcement and cannot block “full” status.

## Full-control acceptance

An ID becomes **FULL** only when its named positive and negative cases exist at the home above and that runner is required in CI. This plan itself changes no verdict. Completion requires all 15 named controls to pass; it does not claim coverage for other `enforcedBy` labels outside the audited set.
