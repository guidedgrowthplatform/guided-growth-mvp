# Enforcement Audit — prose vs. enforceable

**Scope inspected (2026-07-17):** this render worktree, `/home/ggvoice/gg-ground/gg-mvp` (the live API/tool lane), and `/home/ggvoice/gg-spec` (docs/harness materials). Source was read-only; this document is the only new artifact.

## Bottom line

**1 of 15 named enforcement IDs is REAL today; 6 are PARTIAL; 8 are aspirational names.**

The registry makes `enforcedBy` look like a test/gate registry. It is not. In `src/components/flow-designer/beatsSource.ts`, those strings are display metadata. Searching all three scopes found only one ID with a directly matching executable implementation: `render-link-integrity-check`.

There is important real enforcement in the app—especially the per-screen runtime tool allow-list and forward-advance preconditions—but it is a separate app system. It neither consumes the render `enforcedBy` IDs nor proves the much broader prose claims attached to them. That distinction is the answer to “prose is just words—is it enforceable?”: **some nearby behavior is enforced, but most named render assurances are currently prose, not gates.**

## How verdicts were assigned

- **REAL** — a runnable implementation exists, matches the named ID’s core claim, and has an identifiable execution path.
- **PARTIAL** — relevant code exists, but it checks only a subset, is not tied to the render ID, or is not a release/CI gate.
- **NOT-IMPLEMENTED** — no matching implementation was found in the render repo, real app, or `gg-spec`; the ID is a label only.

“Runs” below is intentionally precise: an npm command existing is not the same as CI running it. Render CI (`.github/workflows/ci.yml:43`) runs lint/type/tests, but does **not** invoke `check:render`, `check:links`, `check:beats`, or `verify:objective1`.

## Audit by `enforcedBy` ID

| ID (registry uses supplied) | Verdict | Implementing evidence | What code actually checks vs. claim | Where it runs |
|---|---:|---|---|---|
| `advance-gate-check` (158) | **PARTIAL** | App: `/home/ggvoice/gg-ground/gg-mvp/api/_lib/llm/onboarding/handlers/advanceStep.ts:36`; `/home/ggvoice/gg-ground/gg-mvp/api/_lib/llm/onboarding/preconditions.ts:80` | Real app code blocks forward jumps greater than +2 and requires persisted data for source steps. It does **not** consume render beats/rules, validate every displayed “advance condition,” validate clip-end/tap/UI gates, or prove all beat edges cited by the registry. | Live `/api/llm` tool dispatch, after a model calls `advance_step`; not a render CI gate. |
| `tool-contract-check` (139) | **PARTIAL** | App: `/home/ggvoice/gg-ground/gg-mvp/api/_lib/llm/onboarding/registry.ts:21`; `/home/ggvoice/gg-ground/gg-mvp/api/llm/[...path].ts:652`; `/home/ggvoice/gg-ground/gg-mvp/api/llm/[...path].ts:927` | The real route exposes only `getOnboardingTools(screenId)` and rejects a call not in that offered set. This is a genuine runtime allow-list. It does **not** verify render-side tool declarations/arguments/order/persistence claims, and the render source does not feed this gate. The app overlay can take `allowedTools` from a separate generated flow export (`beatContexts.ts:605`), not from `beatsSource.ts`. | Live `/api/llm`; app tests exist for parity/tool behavior, but not a render check or render CI gate. |
| `render-link-integrity-check` (124) | **REAL** | Render: `scripts/render-link-integrity-check.mjs:75`; npm script: `package.json:43` | Checks each authored script line: a named component binding must be declared in the beat, bubble bindings must use approved structural tokens, and each referenced audio clip resolves under `public/voice` (`scripts/render-link-integrity-check.mjs:79`). It **does not** validate timing, audio ownership, routes/aliases, tool contracts, or actual rendered DOM. | Manual/local `npm run check:links`, also included in `npm run check:beats`; **not invoked by current CI**. |
| `audio-ownership-check` (123) | **PARTIAL** | Narrow proxy only: `scripts/render-link-integrity-check.mjs:90` | The link checker proves a declared `line.clip` has a file. It does **not** enforce the claim “recorded vs. live,” no-Cartesia/no-live-slot policy, engine/mode consistency, clip-family ownership, or that the app plays that asset. No ID-specific checker exists. | The proxy runs with `npm run check:links`; no direct audio-ownership gate. |
| `id-alias-check` (122) | **NOT-IMPLEMENTED** | None found | `render-consistency-check` only detects duplicate canonical `beat.id` values (`scripts/render-consistency-check.mjs:99`). It does not parse or cross-check `screenId`, route, step, `session_log`, `data-beat-id`, aliases, or app aliases. Therefore duplicate IDs are not an implementation of this ID’s stated alias-mapping contract. | Nowhere. |
| `reveal-timing-check` (106) | **NOT-IMPLEMENTED** | None found | The real link checker accepts a structural `reveal-N` token (`scripts/render-link-integrity-check.mjs:56`), but checks neither `reveal`/timing values nor whether a UI reveal waits for the correct audio/user event. | Nowhere. |
| `component-registry-check` (75) | **PARTIAL** | Render schema check: `scripts/render-consistency-check.mjs:84`; link binding check: `scripts/render-link-integrity-check.mjs:75` | Existing scripts require basic beat fields and ensure declared script component element IDs resolve. They do **not** validate actual component registry keys, component availability, props/options, selection caps, or the runtime rendering component. They are useful structural checks, not the claimed registry gate. | Manual/local `npm run check:render` and `npm run check:links`; not CI. |
| `eval:edge-walk` (74) | **NOT-IMPLEMENTED** | None found in all three scopes | No harness evaluator walks all edges/branches or asserts stated outcomes. `advanceStep` validates a subset of forward state transitions, not render edge coverage. | Nowhere. |
| `eval:no-read-options` (72) | **NOT-IMPLEMENTED** | No named eval found | App prompts contain instructions such as silent options, and tests only assert selected context text contains `SILENT_OPTIONS` (`/home/ggvoice/gg-ground/gg-mvp/api/_lib/__tests__/beat-context-parity.test.ts:82`). That is a content-presence test, not an evaluation of output/audio behavior. | Nowhere as an eval. |
| `eval:parity-walk` (62) | **PARTIAL** | App parity test: `/home/ggvoice/gg-ground/gg-mvp/api/_lib/__tests__/beat-context-parity.test.ts:32` | The test checks generated flow tools name real tools, LLM-active beats have contexts, and a progression tool remains (`:39–66`). It does **not** walk UI/render parity, scripts, voice, components, branches, or the render registry. The ID itself has no evaluator. | App test suite if its external test command is run; no render/npm/CI invocation located. |
| `decisions-coverage-check` (60) | **NOT-IMPLEMENTED** | None found | `verify-objective1.mjs` verifies 62 beats, select fields, mapped IDs, and selected “rich data” coverage (`scripts/verify-objective1.mjs:169`), but never reads decisions nor checks decisions coverage. It must not be credited to this ID. | Nowhere. `npm run verify:objective1` exists but is not CI and needs git history. |
| `eval:verbatim-opener` (58) | **NOT-IMPLEMENTED** | **No implementation found anywhere** | No repo/app/spec evaluator compares an emitted opener to a required verbatim string. The app parity test merely rejects em dashes/gesture words in configured openers (`beat-context-parity.test.ts:88`); that is not verbatim matching. | Nowhere. |
| `persistence-contract-check` (53) | **PARTIAL** | App tool handlers persist data; advance preconditions inspect it: `/home/ggvoice/gg-ground/gg-mvp/api/_lib/llm/onboarding/preconditions.ts:13`; `scripts/verify-objective1.mjs:196` | Real app handlers/persistence and advance gates exist. Objective-1 only requires certain beats to have `io.dataIn/dataOut` and `bible.allowedTools`; it does not compare declared persistence contracts to DB writes, schemas, or runtime effects. No ID-specific contract checker exists. | Live app behavior for actual handlers; objective checker is manual and not CI. |
| `eval:no-platitudes` (52) | **NOT-IMPLEMENTED** | None found | No output evaluator or lexical gate checks this. Prompt prose may instruct it, but prompts are not deterministic enforcement. | Nowhere. |
| `eval:silent-after-pick` (40) | **NOT-IMPLEMENTED** | None found | No evaluator checks emitted speech after selection. The route’s final text-only fallback (`/home/ggvoice/gg-ground/gg-mvp/api/llm/[...path].ts:709`) is unrelated and can still generate text. | Nowhere. |

### Other IDs found

The supplied 15 are not the complete registry. `beatsSource.ts` also contains `eval:single-select`, `eval:invalid-value-redirect`, `eval:keep-the-gem`, `eval:count-agnostic`, `eval:name-the-goal`, `eval:one-line-then-wait`, `eval:no-contrarian`, `eval:warm-opener`, `eval:selection-cap`, `eval:no-machinery-words`, and `eval:carry-forward`, plus several local non-`eval:` names. No separately implemented harness evaluators for those names were found in the three searched scopes either. They should be treated as **NOT-IMPLEMENTED labels** until a runnable evaluator is added and wired.

## Yair’s specific questions

### 1. Rule-ID prefixes: complete beat-by-beat map

The rule prefix is a local namespace for the specific beat or variant, **not** an enforcement implementation selector. The complete prefix→beat map extracted from `rulesCode[].id` is:

| Prefix | Beat namespace |
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
| `genergy`, `gstress`, `gsleep`, `gfocus`, `gmove`, `geat`, `gorganize`, `gbreak`, `goalcustom` | the corresponding `onboarding-beginner-beat-12-pick-goals:<variant>` beat |
| `h` | `onboarding-beginner-beat-13-pick-habits` |
| `halcohol`, `havoidcrashes`, `hcaffeine`, `hcalmerday`, `hdeeperwork`, `heatintentionally`, `heveningstress`, `hexerciseconsistently`, `hfallasleepearlier`, `habitcustom`, `hlatesnacking`, `hlessoverwhelmed`, `hlifeadmin`, `hmobility`, `hmorningenergy`, `hphoneuse`, `hplanfood`, `hporn`, `hprocrastinateless`, `hreduceovereating`, `hsleepconsistently`, `hsleepdeeply`, `hsmoking`, `hstableenergy`, `hstartwork`, `hstayontasks`, `htidyspaces`, `hwakeearlier`, `hwalkmore`, `hweed` | the corresponding `onboarding-beginner-beat-13-pick-habits:<variant>` beat |
| `schedule` | `onboarding-beginner-beat-14-schedule-habits` |
| `advcap` | `onboarding-advanced-beat-15-capture-existing-habits` |
| `advfreq` | `onboarding-advanced-beat-16-schedule-existing-habits` |
| `plan` | `onboarding-beat-17-plan-review` |
| `wblank`, `wfull`, `wgaps`, `wp36`, `wp78` | `onboarding-beat-18-week-projection:empty`, `:best`, `:avoid`, `:some`, `:likely`, respectively |

So Yair’s reading is correct: `cat-` belongs to the category beat; `advcap-` and `advfreq-` belong to the two advanced beats. The variant prefixes (`g…`, `h…`, `w…`) are likewise beat/variant namespaces. They do **not** select a checker or cause code to run.

### 2. `eval:verbatim-opener`: does any implementation exist?

**No.** A full text search of the render repo (excluding generated outputs), `/home/ggvoice/gg-ground/gg-mvp`, and `/home/ggvoice/gg-spec` found the ID only in the render registry. There is no harness evaluator, test, script, or runtime comparison that asserts an output exactly equals the declared opener.

Closest nearby code is not enough:

- `scripts/render-link-integrity-check.mjs:90` verifies only that a declared clip file exists.
- `/home/ggvoice/gg-ground/gg-mvp/api/_lib/__tests__/beat-context-parity.test.ts:88` only rejects em dashes and gesture words in configured opener strings.
- Prompt instructions can request a verbatim opener, but an LLM instruction is not enforceable verification.

### 3. `tool-contract-check`: is the runtime `allowedTools` gate real, and does the render claim match it?

**Yes, the runtime gate is real—but it is only a partial implementation of the render claim.**

1. Per-screen `allowedTools` are held in `BEAT_CONTEXTS` and can be replaced from a generated flow export in `/home/ggvoice/gg-ground/gg-mvp/api/_lib/llm/onboarding/beatContexts.ts:605`.
2. `getOnboardingTools()` filters the global onboarding tool definitions to those names in `/home/ggvoice/gg-ground/gg-mvp/api/_lib/llm/onboarding/registry.ts:21`.
3. The live route gives the model only that list at `/home/ggvoice/gg-ground/gg-mvp/api/llm/[...path].ts:652–670`, and belt-and-suspenders rejects any attempted name outside the set at `:927–937` before dispatch.

The mismatch is material: `beatsSource.ts`’s `bible.allowedTools`/`rulesCode` prose is not consumed by that API path. The app uses its own `beatContexts.ts` plus generated `onboarding_combined.json`. Therefore a render beat can claim “only X and Y are callable” while the live app gate has a different list, without a test joining the two sources. The app parity test validates the **generated flow export ↔ app context/tool names**, not **render registry ↔ live gate**.

## Shortest path from aspirational name to enforcement

- `id-alias-check` — write a script that extracts each alias surface from `beatsSource.ts`, enforces uniqueness/mapping against the app’s generated step/route data, and add it to CI.
- `reveal-timing-check` — make reveal gates structured data, then assert every reveal references a valid preceding event/clip and test the renderer’s event sequence.
- `eval:edge-walk` — define a machine-readable transition graph and run a deterministic traversal over all branch/variant edges.
- `eval:no-read-options` — record/fixture model outputs per option-bearing beat and fail when option labels are spoken without an explicit request condition.
- `decisions-coverage-check` — give each product decision a canonical ID, require each applicable beat to declare it, and assert no decision is uncovered or stale.
- `eval:verbatim-opener` — store canonical opener text/clip transcript and compare actual emitted opening event/audio transcript byte-for-byte (or an explicit normalized policy).
- `eval:no-platitudes` — define a reviewed prohibited-pattern evaluator plus fixture outputs; treat it as a heuristic quality gate, not absolute semantic truth.
- `eval:silent-after-pick` — instrument selection and assistant/audio events and assert no speech event occurs in the defined post-pick window.

For the six partial IDs, close the gap rather than renaming them: bind `advance-gate-check`, `tool-contract-check`, `eval:parity-walk`, and `persistence-contract-check` to the render-exported contract; expand `component-registry-check` to actual component/props validation; and make `audio-ownership-check` assert declared runtime/ownership rather than merely a file’s existence.

## Trust headline

**1 of 15 enforcement IDs is real today, 6 are partial, and 8 are aspirational names.** The system contains meaningful real code around tool exposure, advancement, persistence, and link integrity. But only link integrity is honestly represented by its `enforcedBy` name today. The shortest trust-building move is to make `enforcedBy` machine-resolved: every ID must point to a runnable checker/test, have a documented invocation, and fail CI when its declared contract is violated. Until then, these IDs should be presented as intended controls, not proof of enforcement.
