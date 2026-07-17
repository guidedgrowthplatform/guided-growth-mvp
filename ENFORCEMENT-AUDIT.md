# Enforcement Audit — prose vs. enforceable

**Audit date:** 2026-07-17  
**Scope searched:** this render worktree; `/home/ggvoice/gg-ground/gg-mvp` (the live API/tool implementation); and `/home/ggvoice/gg-spec` (spec and harness material). Source repositories were read-only. This report is the audit artifact.

## Headline

**Of the 15 supplied `enforcedBy` IDs: 1 is REAL today, 6 are PARTIAL, and 8 are aspirational names (NOT-IMPLEMENTED).**

The central answer to Yair’s question is therefore: **the registry is not an executable enforcement registry today.** `enforcedBy` strings in `src/components/flow-designer/beatsSource.ts` are rendered/documented metadata; no dispatcher resolves an ID to a checker, and no CI job requires every declared ID to have an implementation. There are useful real protections nearby—most notably clip/link checking and the live app’s per-screen tool allow-list—but they cover materially less than the prose claims attached to most IDs.

## Verdict standard and execution reality

- **REAL** — runnable code exists that materially implements the named control, with a known invocation.
- **PARTIAL** — relevant executable behavior exists, but it is only a subset of the claim, is not connected to the render declaration, or is not an ID-specific control.
- **NOT-IMPLEMENTED** — no matching checker/evaluator/runtime assertion was found across the three scopes; the ID is a name only.
- The render repo exposes `npm run check:render`, `npm run check:links`, `npm run check:beats`, and `npm run verify:objective1` in `package.json:20` and `package.json:43`. Current CI runs lint, formatting, type-check, tests, and build—not any of those render checks—at `.github/workflows/ci.yml:66`, `.github/workflows/ci.yml:70`, `.github/workflows/ci.yml:73`, and `.github/workflows/ci.yml:112`.
- “Runs locally” below means a command exists. It is **not** a CI/release gate unless explicitly stated.

## Audit: the 15 supplied IDs

Usage counts below are the current `enforcedBy` occurrences extracted from `beatsSource.ts`, rather than the older review snapshot; several have increased since the supplied list.

| ID / current uses | Verdict | Implementing evidence | What it actually checks; material gap from the cited rule claims | Runs where |
|---|---|---|---|---|
| `advance-gate-check` / 203 | **PARTIAL** | `/home/ggvoice/gg-ground/gg-mvp/api/_lib/llm/onboarding/handlers/advanceStep.ts:36`; `/home/ggvoice/gg-ground/gg-mvp/api/_lib/llm/onboarding/preconditions.ts:80` | Live code checks selected persisted-data preconditions before an `advance_step` and rejects unsupported forward jumps. It does **not** consume render rules, validate every declared UI/clip/tap advance condition, or walk every stated edge. | Live `/api/llm` tool dispatch, only when `advance_step` is called. |
| `tool-contract-check` / 139 | **PARTIAL** | `/home/ggvoice/gg-ground/gg-mvp/api/_lib/llm/onboarding/registry.ts:19`; `/home/ggvoice/gg-ground/gg-mvp/api/llm/[...path].ts:655`; `/home/ggvoice/gg-ground/gg-mvp/api/llm/[...path].ts:927` | A real runtime allow-list exposes only per-screen tool schemas and rejects a tool name outside the offered set as `unknown_tool`. It does **not** compare `beatsSource.ts` declarations, argument prose, call ordering, persistence promises, or the entire render-side contract to runtime behavior. | Live `/api/llm`; supported by app tests, not a render CI control. |
| `render-link-integrity-check` / 166 | **REAL** | `scripts/render-link-integrity-check.mjs:75`; command at `package.json:43` | Parses `BEATS_SOURCE`; requires component script bindings to name a declared element, bubble bindings to use structural tokens, and every declared clip to resolve under `public/voice` (`scripts/render-link-integrity-check.mjs:79` and `scripts/render-link-integrity-check.mjs:90`). It does **not** verify timing, ownership/mode, route IDs, tool contracts, or the rendered DOM. | Manual/local `npm run check:links`; included by `npm run check:beats`; not current CI. |
| `audio-ownership-check` / 124 | **PARTIAL** | Only a narrow proxy: `scripts/render-link-integrity-check.mjs:90` | The proxy confirms that a declared clip path/id has a file. It does **not** enforce “recorded, not Cartesia/live,” slot policy, `voiceEngine` consistency, ownership by beat/line, or that production plays that asset. | The proxy runs under `npm run check:links`; no ID-specific gate. |
| `id-alias-check` / 122 | **NOT-IMPLEMENTED** | None found | `scripts/render-consistency-check.mjs:99` detects duplicate canonical `beat.id` values only. It does **not** cross-check `screenId`, route, step, `session_log`, `data-beat-id`, generated app IDs, or aliases—exactly what the cited rules claim. | Nowhere. |
| `reveal-timing-check` / 106 | **NOT-IMPLEMENTED** | None found | `scripts/render-link-integrity-check.mjs:56` merely treats `reveal-N` as a legal structural token. It never reads timing, verifies clip-end sequencing, or observes a real UI reveal. | Nowhere. |
| `component-registry-check` / 119 | **PARTIAL** | `scripts/render-consistency-check.mjs:84`; `scripts/render-link-integrity-check.mjs:75` | The scripts require basic beat fields and ensure named **element IDs** are declared. They do **not** verify actual component registry keys, component availability, props/options/caps, or that the renderer instantiates the intended component. | Manual/local `npm run check:render` / `npm run check:links`; not CI. |
| `eval:edge-walk` / 119 | **NOT-IMPLEMENTED** | None found in render, app, or `gg-spec` | No harness walks the declared branches/edges and asserts outcomes. Live advance preconditions are a narrow state-transition safeguard, not an edge-walk evaluator. | Nowhere. |
| `eval:no-read-options` / 72 | **NOT-IMPLEMENTED** | None found | Context/prompt prose can instruct silent options. `/home/ggvoice/gg-ground/gg-mvp/api/_lib/__tests__/beat-context-parity.test.ts:82` checks presence of a `SILENT_OPTIONS` string for selected contexts, not emitted speech/audio. | Nowhere as an evaluator. |
| `eval:parity-walk` / 102 | **PARTIAL** | `/home/ggvoice/gg-ground/gg-mvp/api/_lib/__tests__/beat-context-parity.test.ts:32` | That test checks generated flow tool names exist, LLM-active beats have contexts, and an interactive beat retains a progression tool. It does **not** walk render parity across scripts, voice, components, routes, branches, or the render source. The named evaluator itself does not exist. | App test suite if run in that app environment; no render CI invocation located. |
| `decisions-coverage-check` / 60 | **NOT-IMPLEMENTED** | None found | `scripts/verify-objective1.mjs:169` verifies source/baseline structure and selected rich-data coverage; it does not read a decision register or prove decision coverage. It cannot honestly be credited to this ID. | Nowhere. `npm run verify:objective1` is manual/local and not CI. |
| `eval:verbatim-opener` / 58 | **NOT-IMPLEMENTED** | **No implementation anywhere in the three searched scopes** | No script, test, runtime assertion, or `gg-spec` harness compares actual emitted opener text/audio to the declared verbatim opener. The closest test checks configured opener text for em dashes/gesture wording, not equality. | Nowhere. |
| `persistence-contract-check` / 97 | **PARTIAL** | Live persistence handlers plus `/home/ggvoice/gg-ground/gg-mvp/api/_lib/llm/onboarding/preconditions.ts:80`; structural proxy `scripts/verify-objective1.mjs:185` | App handlers do persist real onboarding state and later gates inspect some state. Objective-1 only requires that select beats have `bible`, `io`, `dataIn`, `dataOut`, and tools; it does **not** compare each declared persistence contract to schemas, writes, resume behavior, or later reads. | Live app behavior; manual objective script; neither is an ID-specific render gate. |
| `eval:no-platitudes` / 52 | **NOT-IMPLEMENTED** | None found | No lexical/output evaluator, transcript test, or runtime policy checks this. An LLM prompt instruction is not deterministic enforcement. | Nowhere. |
| `eval:silent-after-pick` / 40 | **NOT-IMPLEMENTED** | None found | No test records a selection then asserts no coach/audio output in a post-pick window. The route’s forced text-only final round at `/home/ggvoice/gg-ground/gg-mvp/api/llm/[...path].ts:709` is unrelated and may still emit text. | Nowhere. |

## Yair’s three direct questions

### 1. Rule-ID prefixes: full beat-by-beat map

Yes: the prefixes are **local rule namespaces**, not checker selectors. They identify the beat (and often a variant) whose `rulesCode[].id` is being described. A prefix does not cause `enforcedBy` code to run.

| Prefix | Beat / variant namespace |
|---|---|
| `greet` | `onboarding-beat-3-coach-greeting` |
| `signup` | `onboarding-beat-4-sign-up` |
| `micperm` | `onboarding-beat-5-mic-permission` |
| `profgreet` | `onboarding-beat-6-profile:greeting` |
| `profile` | `onboarding-beat-6-profile:asks` |
| `statecheck` | `onboarding-beat-7-state-check` |
| `checkin` | `onboarding-beat-8-morning-checkin-setup` |
| `reflect` | `onboarding-beat-9-evening-reflection-setup` |
| `fork` | `onboarding-beat-10-experience-fork` |
| `cat` | `onboarding-beginner-beat-11-pick-category` |
| `catw` | `onboarding-beginner-beat-11-pick-category:women` |
| `gsleep`, `gmove`, `geat`, `genergy`, `gstress`, `gfocus`, `gbreak`, `gorganize`, `goalcustom` | Corresponding `onboarding-beginner-beat-12-pick-goals:<variant>` beat |
| `h` | `onboarding-beginner-beat-13-pick-habits` |
| `hfallasleepearlier`, `hwakeearlier`, `hsleepconsistently`, `hsleepdeeply`, `hwalkmore`, `hexerciseconsistently`, `hmobility`, `heatintentionally`, `hreduceovereating`, `hplanfood`, `hmorningenergy`, `havoidcrashes`, `hstableenergy`, `hcalmerday`, `heveningstress`, `hlessoverwhelmed`, `hstartwork`, `hdeeperwork`, `hprocrastinateless`, `hsmoking`, `hweed`, `halcohol`, `hporn`, `hphoneuse`, `hlatesnacking`, `hcaffeine`, `hstayontasks`, `htidyspaces`, `hlifeadmin`, `habitcustom` | Corresponding `onboarding-beginner-beat-13-pick-habits:<variant>` beat |
| `schedule` | `onboarding-beginner-beat-14-schedule-habits` |
| `advcap` | `onboarding-advanced-beat-15-capture-existing-habits` |
| `advfreq` | `onboarding-advanced-beat-16-schedule-existing-habits` |
| `plan` | `onboarding-beat-17-plan-review` |
| `wblank` | `onboarding-beat-18-week-projection:empty` |
| `wfull` | `onboarding-beat-18-week-projection:best` |
| `wp78` | `onboarding-beat-18-week-projection:likely` |
| `wp36` | `onboarding-beat-18-week-projection:some` |
| `wgaps` | `onboarding-beat-18-week-projection:avoid` |

So the review interpretation is correct: `cat-` is category-beat namespace; `advcap-` is advanced capture; `advfreq-` is advanced frequency. The `g*`, `h*`, and `w*` families are the goal, habit, and weekly-projection variant namespaces.

### 2. `eval:verbatim-opener`: does any implementation exist?

**No.** Search found its identifier only as render registry metadata. No implementation exists in this worktree, `/home/ggvoice/gg-ground/gg-mvp`, or `/home/ggvoice/gg-spec` that compares emitted text/audio with a required opener string.

Nearby but insufficient controls:

- `scripts/render-link-integrity-check.mjs:90` proves a declared clip file exists; it does not establish that its words are played verbatim.
- `/home/ggvoice/gg-ground/gg-mvp/api/_lib/__tests__/beat-context-parity.test.ts:88` bans selected textual patterns in configured openers; it does not compare runtime output to an expected opener.
- Prompt wording such as “SPEAK MODE: VERBATIM_OPENER” is an instruction to a probabilistic model, not a test or gate.

### 3. `tool-contract-check`: is the runtime `allowedTools` gate real, and does the render-side claim match it?

**The runtime gate is real. It is the correct concrete implementation of “only these tool names may be called on this live screen,” but it is only a partial implementation of the render-side `tool-contract-check` claim.**

1. `BEAT_CONTEXTS` owns a per-screen allow-list; `getOnboardingTools()` filters the global tool schemas to it in `/home/ggvoice/gg-ground/gg-mvp/api/_lib/llm/onboarding/registry.ts:19`.
2. The live route offers only those schemas at `/home/ggvoice/gg-ground/gg-mvp/api/llm/[...path].ts:652`–`/home/ggvoice/gg-ground/gg-mvp/api/llm/[...path].ts:670`.
3. It also rejects an attempted out-of-list tool call at `/home/ggvoice/gg-ground/gg-mvp/api/llm/[...path].ts:927`–`/home/ggvoice/gg-ground/gg-mvp/api/llm/[...path].ts:937`.
4. It is exercised by tests such as `/home/ggvoice/gg-ground/gg-mvp/api/_lib/__tests__/beat-context-parity.test.ts:32` and route error-path tests under `/home/ggvoice/gg-ground/gg-mvp/api/_lib/__tests__/`.

**The mismatch:** the render registry’s `bible.allowedTools` and `rulesCode` are display data from `src/components/flow-designer/beatsSource.ts`; the live route does not import them. The app instead overlays generated metadata from `src/generated/onboarding_combined.json` in `/home/ggvoice/gg-ground/gg-mvp/api/_lib/llm/onboarding/beatContexts.ts:605`–`/home/ggvoice/gg-ground/gg-mvp/api/_lib/llm/onboarding/beatContexts.ts:628`; that combined JSON is built from other app sources by `/home/ggvoice/gg-ground/gg-mvp/scripts/build-onboarding-combined.ts:5`–`/home/ggvoice/gg-ground/gg-mvp/scripts/build-onboarding-combined.ts:19`. Therefore the live allow-list does not prove that each render claim’s tool names, arguments, order, “when,” or persistence text match production.

## Other enforcement names discovered

The supplied 15 are not the full `enforcedBy` vocabulary. The source also declares: `eval:carry-forward`, `eval:count-agnostic`, `eval:invalid-value-redirect`, `eval:keep-the-gem`, `eval:name-the-goal`, `eval:no-contrarian`, `eval:no-machinery-words`, `eval:one-line-then-wait`, `eval:selection-cap`, `eval:single-select`, and `eval:warm-opener`.

No separately runnable evaluator matching any of those names was found across the three scopes. Treat them as **NOT-IMPLEMENTED labels** until a corresponding test/checker exists and is invoked.

## Shortest path from aspirational name to real enforcement

- `id-alias-check` — add one canonical ID map and a CI checker that compares every render beat’s `id`/`screenId`/route/step/log/data attribute against the app generated flow and route constants.
- `reveal-timing-check` — encode reveal triggers in machine-readable fields, then add component/Playwright tests that assert the reveal occurs only after the required audio event or user action.
- `eval:edge-walk` — define machine-readable transitions and run a table-driven state-machine test over every edge, required persistence state, and expected next beat.
- `eval:no-read-options` — run deterministic transcript/audio-event fixtures for option beats and fail if option labels are spoken before selection.
- `decisions-coverage-check` — make the decision ledger structured, require decision IDs on relevant beats, and check coverage/waivers in CI.
- `eval:verbatim-opener` — make opener text/clip transcript canonical and test exact emitted opener text or audio clip identity for each beat.
- `eval:no-platitudes` — define a reviewed banned/required-output policy and test deterministic scripted outputs; do not represent prompt wording alone as enforcement.
- `eval:silent-after-pick` — instrument pick and speech/audio events and assert no speech event in the specified post-pick window.

For the six **PARTIAL** controls, the shortest trust-building improvement is the same: add a machine-readable contract source, wire its checker to the named ID, and make `npm run check:beats` part of CI. Until that is done, describe these names as **declared intended controls with partial adjacent safeguards**, not as proof of enforcement.

**Honest headline: 1 of 15 enforcement IDs is REAL today, 6 are PARTIAL, and 8 are aspirational names.**
