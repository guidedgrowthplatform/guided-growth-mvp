# Fable go-over: beat 13 (goals-sleep) review round

Date: 2026-07-09. Reviewer: Fable (adversarial pass, on paper, before the 40+ beat fill).
Artifact: branch `trial/rebase-531`, `src/components/flow-designer/beatsSource.ts` (goals-sleep, lines 1381-1773; category-women, line 988), `flowBible.ts` (ENFORCER_REGISTRY line 282, CONVERSATION_MODEL line 164, CANONICAL_ENUMS line 535), `FlowDesigner.tsx` (BiblePanel line 983, resolveBeatStructure consumer line 1440). Cross-read against GRAND-PLAN.md, render-bible-spec-and-gap-audit-2026-07-09.md, render-bible-review-pass1-2026-07-09.md, bible-fill-pass1-review-2026-07-09.md. All findings below are grounded in the code as it sits on this branch; nothing is repeated from pass-1 unless beat 13 failed to apply it.

## Verdict: SCALE-WITH-CHANGES

The 12-section contract itself is validated and genuinely good. Sections flow, edges, and rules.context on goals-sleep are strong, specific, and fold in the Yair-approved tool-failure contract and the bounded off-topic reply the fill review asked for. The enforcer registry (flowBible.ts) is more honest than the fill review implied: every id has a kind, an owner, and a built/planned status, plus a RETIRED map. That is real architecture, not prose.

But two things will actively multiply wrong content if the fill runs now: the variant-inheritance model produces factually wrong bibles for 36 of the 37 variants, and the enforcer ids are free strings that nothing validates, with two semantic clashes already live in the exemplar. Fix those two before the fill; the rest can ride along.

---

## Q1. Does the 12-section contract hold on goals-sleep?

**Mostly yes. Where it holds:**

- `edges` (6 rows) is the best section again, as in pass-1. Tool failure now carries the full Yair-approved surfacing contract (toast + retained selection on tap, one coach line on voice) — fill-review item 2 was applied. Off-topic is bounded to "one short acknowledgement, at most one sentence, then re-ask" — fill-review item 3 applied.
- `flow` is genuinely structured: advance condition, upstream branch (category routing), downstream branch (goal-count → habit distribution, per-goal routing to habits-*), gate. This is the contract profile-asks needs and doesn't have; goals-sleep proves the shape works.
- `rules.context` (9 rules) is specific and per-beat, not boilerplate.
- The applicableDecisions "binds: false but here's WHY and what this beat contributes" row for decision 4/5 (input, not gate) is exactly the right nuance.

**Where it's forced or broken:**

1. **`components` asserts on-screen state the render does not have.** The "exact state" row claims 'a running "n of 2 selected" reflects taps' and 'the Continue affordance advances once 1 to 2 goals are picked'. `goalsList.tsx` renders neither: no selection counter, no Continue button (grep across goalsList.tsx, beatKit.tsx, GoalCard.tsx, FlowPlay.tsx: zero hits for either). Either the bible is describing an intended-but-unbuilt UI with no marker distinguishing it from as-built fact, or the render is missing chrome. This is pass-1's section-3 failure mode inverted: pass-1 caught the render doing something the spec banned (preselection); here the spec claims things the render lacks. Both prove the same hole — `component-registry-check` is `planned`, so components rows are un-diffed prose. The `pending` flag exists in the schema for exactly this and was not used on those rows.
2. **`applicableDecisions` shape is being fought, not used.** Beat 13 stuffs a pending-status note into a `BibleDecision` row (`decision: 'decisions-coverage-check enforcer', binds: false, how: 'PENDING: ...'`). A schema field is being abused as a comment channel. If the fill copies this pattern, 40 beats carry a fake decision row.
3. **`identity` still displays all 5 aliases, 3 of which are `= beatId`.** Pass-1's section-1 verdict was CHANGE (show only overrides); the beat-13 fill reproduced the clutter. Small on one beat, 200 dead rows across 40.
4. **`voice` papers over the unreconciled enum in prose.** The row says "mode: Verbatim (reconciled from source Verbatim; enum is Verbatim / Generative)" while the actual type on line 15 is still `VoiceMode = 'Verbatim' | 'Improvise' | null`. The spec (section 4) ordered the enum reconciled; instead the bible CLAIMS reconciliation the type system contradicts. A prose assertion contradicting a machine type inside the one source is exactly the class of drift the whole exercise exists to kill.
5. **`persistence` is honest but structurally unenforceable**, same as pass-1's section-9 GAP: the watchOut says the table/column is unknown and screen_contexts' `user_onboarding.selected_subcategories[]` is only a hint. Fine as a flag, but it means `persistence-contract-check` is cited as the enforcer of a contract that names no enforceable target. `io.dataOut.persistsTo: 'onboarding_states.data (verify key)'` puts a prose hedge inside a machine field. At fill time, every data-writing beat will carry the same unresolvable citation until app-reconcile lands. Consider a `status: 'app-reconcile-pending'` on the section (the SourceStatus enum has exactly this value and beat 13 doesn't use it).

**Section count confusion.** The docs say 12 sections, the schema comment says "14 top-level keys = 13 numbered sections + applicable-decisions", the UI badge says "Bible fill · 12 sections", and the "full contract" chip renders on a beat missing section 13 entirely. Trivial to fix, embarrassing to scale.

## Q2. Is the variant-inheritance model sound? NO — this is the blocking finding.

The numbers: 37 `variantOf` beats — 7 → `goals-sleep`, 29 → `habits`, 1 → `category`. Only TWO beats in the whole file carry a `bible` at all: `category-women` and `goals-sleep`.

`resolveBeatStructure` (beatsSource.ts:3667) is `bible: beat.bible ?? head.bible`. All-or-nothing at the whole-bible level, one level, no chains, no per-section merge, no parameterization.

**Consequence A — wholesale inheritance produces factually wrong contracts.** `goals-move` (order 14) has no bible, so it resolves to goals-sleep's ENTIRE bible. Concretely wrong for goals-move, section by section:
- identity: `beatId (canonical) = 'goals-sleep'`, `order = '13'`, alias `screenId = ONBOARD-BEGINNER-02--SLEEP`, `persisted current_step = 'goals-sleep'` — all five identity facts wrong.
- components: "4 goal tiles for Sleep better: Fall asleep earlier, Wake up earlier, ..." — wrong category, wrong tiles, wrong tile count (Move more has 3).
- voice.perLine: `resolvesTo 'onboard_beginner_02_sleep'` — wrong clip (goals-move's script plays a different clip).
- flow: "Sleep better routes to this goals-sleep variant" — wrong.
- acceptance: "phone renders goals-list for Sleep better" — wrong; a fleet walking goals-move against this acceptance would fail a correct render or pass a wrong one.
- rulesContext/rulesCode ids are all `gsleep-*` — rule ids no longer unique per beat, which breaks any per-rule scorecard keyed by rule id.
The BiblePanel shows a variant chip, but the CONTENT it displays and any future consumer of `resolveBeatStructure` (checks, parity export, fleet evals) reads these wrong facts for 6 sibling goals beats today and 29 habits beats the moment `habits` gets a bible.

**Consequence B — the demonstrated alternative is full duplication.** `category-women` is `variantOf: 'category'` yet carries its own complete ~340-line bible, so inheritance buys nothing there. And note the inversion: the HEAD `category` beat — the one every non-female user hits — has NO bible, while its variant is fully contracted. Inheritance is head→variant only, so the primary beat of that pair is uncontracted and cannot borrow from its variant. When `category` gets filled, the two will be hand-kept near-copies, the drift pair the Bible exists to prevent.

**What's missing:** either (a) per-section merge (variant overrides only the sections/rows that differ: identity, components tiles, voice clip; inherits rules/edges/flow/tools verbatim), plus (b) parameterization — the head bible authored with slots ({category}, {clip}, {tiles}) resolved from the variant's own `props`/`script`/@gg/shared `goalsByCategory`, so category-specific facts are DERIVED, never copied. Without one of these, the fill must choose between 36 wrong bibles and 40 hand-synced copies. Both fail at scale. This must be settled BEFORE the fill because the fill's entire economics (25 standalone + 2 concept groups, per the spec) assumes the groups collapse.

## Q3. Are the enforcers real and resolvable?

**Better than the fill review said, and still not binding.**

- ENFORCER_REGISTRY exists with 3 built (render-consistency-check, render-link-integrity-check, type-check), ~9 planned statics, ~20 planned evals, owners per lane, and a RETIRED-ids map. Honest bookkeeping — good.
- But the validator that would make the registry binding, `render-rules-check` ("port of check:rules to the bible schema, resolves ids against THIS registry"), is itself status `planned`. Nothing on this branch reads ENFORCER_REGISTRY except the display (FlowDesigner.tsx). `check:beats` (render-consistency + link-integrity) does not touch the bible at all — grep for "bible" in all three check scripts: zero hits. The schema comment in beatsSource ("Enforcer strings are real static-check / eval ids so `check:rules` can resolve them") describes a check that does not exist. So `enforcedBy` is a free `readonly string[]`; a typo'd or invented id passes type-check and every gate. Effectively prose-with-a-colon, despite the no-prose-only law.
- **Two live semantic clashes prove the risk is not theoretical:**
  1. `gsleep-one-or-two` ("Allows one or two goals only; on three, asks which two matter most") cites `eval:single-select`, whose registry meaning is "more than one named: asks which matters most, takes exactly ONE (widened per pass-1)". The registry eval, implemented as written, FAILS goals-sleep's correct behavior (accepting two goals). The pass-1 widening was applied globally to an eval whose category-beat semantics (exactly one) do not transfer to goals beats (one or two). Multiplied across 8 goals beats and the habits group, this is a mass false-fail (or the eval gets loosened and silently stops enforcing the category beat).
  2. `gsleep-react-and-ask` ("naming the category (sleep) once") cites `eval:name-the-goal`, whose registry meaning is "HABIT-PICK opener names the goal every time". Wrong eval borrowed because the vocabulary has no `eval:name-the-category`. Meaning drift between rule text and eval meaning, undetectable because meanings are prose.
- **Cheap, high-leverage fix before the fill:** derive a TS union type from the registry ids (or add a registry cross-check pass to render-consistency-check, which already AST-parses BEATS_SOURCE) so every `enforcedBy` id must exist in ENFORCER_REGISTRY and RETIRED ids are rejected. One day of work; without it the fill emits roughly 40 beats × ~10 citations = 400 unvalidated strings.
- Note the enforceability-law nuance: the fill review's rule ("pending enforcers must stay flagged as pending, not counted as real") is only half-implemented — the registry knows planned vs built, but the beat cards render "full contract" with no distinction, and `check:beats` green tells you nothing about any bible claim.

## Q4. Contradictions with the grand plan / acceptance criteria

1. **The bible re-creates a second hand-authored store INSIDE the one source.** The beatsSource header forbids "a second hand-authored metadata store", and the grand plan's core lesson is that copies drift. Yet the bible restates, rather than derives, facts that already have machine homes:
   - `allowedTools: 'submit_goals, advance_step'` (legacy field) AND `bible.allowedTools.tools: ['submit_goals','advance_step']` — two homes per beat.
   - `voiceEngine/voiceMode` fields AND `bible.voice.rows` string copies — edit one, the other silently lies (and already does, on the mode enum).
   - `context` (Sheet-synced, per grand-plan §4 the Master Sheet Beats Context tab is the clean source) AND `bible.contextProse.prose` — coach prose now has THREE homes: Sheet upstream, the `context` field, and `contextProse`. Which wins is undefined.
   - Tile labels: `bible.components` hand-lists "Fall asleep earlier | Wake up earlier | ..." while the rendered tiles come from `goalsByCategory` in `@gg/shared/data/onboardingGoals` (goalsList.tsx line 21). A change to @gg/shared silently invalidates the bible. Fourth and fifth copies live in the legacy screen_contexts.json and voice-lines.csv (retiring, fine).
   No check reconciles any of these pairs. The design intent (contract + enforcer diffs it against code) is grand-plan-consistent, but until the enforcers exist, scaling the fill mass-produces the exact overlapping-truth condition section 2 of the grand plan diagnoses. Either derive these sections from the owning fields/data at render time, or add the reconcile assertions to render-consistency-check NOW (it already parses the file).
2. **Component-code fallbacks contradict "the render reads one source".** goalsList.tsx carries a hardcoded fallback coach line ('So within that, which goals would you like to start with?...') that differs from every goals-* script opener, plus `category ?? 'Sleep better'`. These are the no-fallback-source class of forks; that guard (MR !514) is app-side and pending, and the render repo has no equivalent. Not new to this round, but the bible's script/scriptMeta claims are only true when no fallback fires, and nothing asserts that.
3. **Acceptance-criteria drift, small:** grand plan §6 defines FOUR per-beat checks; beat 13's acceptance has five (adds "routes correctly" — a good addition). If the fleet scorecard is built to the grand plan's four, the fifth is silently unchecked; reconcile the doc or the schema (a fixed 4+optional-extras shape would do).
4. **Parity export does not carry the bible.** export-render-parity.mjs never references it, so the app-side parity gate cannot see any bible contract. Consistent with the current report-mode plan, but it means "the bible is the contract" is display-only until the parity payload or the planned app-lane checks pick it up. Worth stating in the gate order so no one assumes bible claims are already gated.

## Q5. What multiplies if we scale now (and doesn't fix itself later)

Ranked by (wrongness × 40) ÷ cost-to-fix-now:

1. **Inheritance (Q2).** 36 wrong bibles or 40 hand-copies. Fix: per-section merge + parameterized head bibles derived from props/@gg/shared. Blocking.
2. **Unvalidated enforcer ids + eval vocabulary too narrow (Q3).** 400+ free-string citations, two semantic clashes already. Fix: registry cross-check in check:beats + split eval:single-select into per-cardinality evals (or parameterize: eval:select-cap{n}) + add eval:name-the-category. Blocking-cheap.
3. **Restated-not-derived facts (Q4.1).** Every fill pass hand-copies tool lists, voice fields, tile labels, prose into bible rows; drift is then permanent background noise and reviewers stop trusting the bible. Fix: derive or reconcile-check before fill.
4. **Section 13 (conversation) skipped by both exemplars.** CONVERSATION_MODEL says "a beat with no conversation block is single-turn by definition" — but goals-sleep is demonstrably multi-turn by its own rules ("asks one short pointer question then waits") and edges ("names three → ask which two matter most"; "vague → ask one short question to pin it" — those ARE TurnBranches). The flagship beat is formally declared single-turn while specifying a negotiation loop, and its turn branches live mis-homed in `edges`. The fill will clone this omission 40 times and section 13 dies on the vine. Decide per-beat conversation blocks (with maxTurns) for the conversational beats BEFORE the fill, or the definition needs softening.
5. **Review-loop leakage.** Two accepted pass-1 changes (identity alias clutter; rulesCode restating rules already owned by sections 1/2/4 — beat 13 reproduces all four restates: reveal-gates, audio-ownership, clip-resolves, id-alias) were not folded into the very next fill. If the exemplar→fill pipeline doesn't consume review verdicts, pass-1/pass-2 reviews are theater and every miss is ×40. Process fix: a review-actions checklist the fill MR must tick, checked by the conductor gate.

Lesser but real: the `pending`/SourceStatus vocabulary exists and is under-used exactly where it matters (components exact-state, persistence); the VoiceMode enum reconciliation is claimed in prose and false in the type; the section-count messaging (12 vs 13 vs "full contract") needs one answer; the head `category` beat is bible-less while its variant is contracted (fill it first, make category-women the override).

## What is genuinely good (keep)

- The 12-section shape survived contact with a second real beat; flow/edges/rules.context are teaching the fill what good looks like.
- ENFORCER_REGISTRY with statuses, owners, and a RETIRED map is the right backbone; it just needs its validator.
- The fill DID consume fill-review items 2 and 3 (tool-failure surfacing, bounded off-topic) — the loop works when items are concrete.
- applicableDecisions' "binds:false + how this beat feeds the decision" nuance on 4/5 is better than the spec's bare "none".
- io/DATA_PASSING with the Yonas precedent citation is exactly how a machine contract should carry its provenance.

## Recommended pre-fill gate (the changes in SCALE-WITH-CHANGES)

1. Redesign variant inheritance: per-section merge + derive category/goal-specific facts (tiles, clip, identity) from the variant's own props/script/@gg/shared. Prove it on goals-move.
2. Wire enforcer-id validation into check:beats (ids ∈ ENFORCER_REGISTRY, retired ids rejected); fix the eval:single-select and eval:name-the-goal mis-citations while doing it.
3. Rule: bible sections that restate machine-owned facts (tools, voice, tiles) are derived or reconcile-checked, never hand-copied. Kill the legacy-field duplication (or declare the bible side canonical and generate the legacy fields).
4. Fill section 13 on the conversational exemplars (or amend the single-turn-by-default definition), and apply the two outstanding pass-1 changes (aliases, rulesCode dedupe) to both exemplars so the fill copies the post-review shape.
5. Use SourceStatus/pending on every row that is intended-not-as-built (components exact-state) or app-reconcile-pending (persistence), and make the card badge reflect it instead of "full contract".
