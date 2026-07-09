# Re-QA: corrected beat-13 review artifact (structure fix batch)

Date: 2026-07-10. Reviewer: Fable (adversarial re-QA, the gate before the 40+ beat fill).
Artifact: head `7ff51254` at `~/Developer/claude-work/gg-trial-rebase` (confirmed by `git log --oneline -1`), deployed at https://trial-rebase-531.gg-onboarding-render.pages.dev (deployed index.html byte-identical to committed `dist-flow/index.html`; deployed bundle `index-BaEqpAQS.js` carries the corrected structures: inherited chip, section-13 branches, pending-app-reconcile renderer; `/parity.json` serves JSON).
Files read in full or in relevant part: `src/components/flow-designer/flowBible.ts` (all 1,902 lines), `beatsSource.ts` (schema, goals-sleep 1456-1898, category-women 994-1456, goals-move 1899-1934, resolveBeatStructure 3789-3856), `FlowDesigner.tsx` (BiblePanel 1135-1320, SourceOfTruthPanel 1690-1815, global-layer imports/renders), `scripts/bible-registry-check.mjs` (all), `beats/goalsList.tsx`, `beats/categoryGrid.tsx`, `.gitlab-ci.yml`, `package.json` scripts. Grounding: `gg-spec/docs/GRAND-PLAN.md` §6, `render-bible-spec-and-gap-audit-2026-07-09.md`, prior go-over `gg-status/scratch/fable-goover-beat13.md`.

Guards run live on head: `check:render` PASS (62 beats), `check:links` PASS, `check:rules-registry` PASS (33 registry ids, 12 flowBible refs + 55 beatsSource refs all resolved, sectionManifest validated on both bible-bearing beats).

## VERDICT: SCALE-WITH-CHANGES

The structure batch landed the hard parts: a real registry cross-check guard wired into `check:beats`, section 13 filled on both exemplars, both enforcer semantic clashes fixed, tile preselect dead, identity truly derived-never-inherited on variants, and the uniform-manifest model machine-validated against fake-empty. That is a different artifact from last round.

Two things still multiply wrong content if the fill runs as-is, both far cheaper than last round's blockers:

1. **Inheritance is derive-not-clone for IDENTITY ONLY.** Components (sleep tiles), voice.perLine (sleep clip), flow/acceptance/contextProse (Sleep-better facts), and the all-'filled' manifest still resolve wholesale from goals-sleep onto all 7 goals siblings. goals-move's resolved card asserts clip `onboard_beginner_02_sleep` while its own script on the same card plays `onboard_beginner_02_move`.
2. **category-women's tool-failure edge contradicts the Yair-approved global contract** ("do not narrate the failure" = the silent failure the contract bans). Exemplars are the fill's copy template; a one-row fix stops 40 copies.

---

## Re-check of the four prior blockers

| # | Prior blocker | Status | Evidence |
|---|---|---|---|
| 1 | Variant inheritance derive-not-clone | **PARTIAL** | `deriveVariantIdentity` (beatsSource.ts:3792) generates identity from the beat's own fields; `resolveBeatStructure` (3822) now merges per-SECTION with `identity: beat.bible?.identity ?? deriveVariantIdentity(beat)`. Siblings no longer carry goals-sleep's beatId or SLEEP aliases (fixed). BUT no sibling authors any override and non-identity sections spread wholesale from the head, so siblings still carry the sleep TILES (components row: "4 goal tiles for Sleep better: Fall asleep earlier, ...") and the sleep CLIP (voice.perLine `resolvesTo 'recorded clip onboard_beginner_02_sleep'`), plus Sleep-better facts in flow/acceptance/contextProse and `gsleep-*` rule ids. The amber "inherited from goals-sleep · verify per-variant facts" chip (FlowDesigner.tsx:1011) flags it honestly, but flagged-wrong is still wrong, and the inherited sectionManifest claims it all 'filled'. |
| 2 | Enforcer ids resolve | **FIXED** | New `scripts/bible-registry-check.mjs`: AST-collects every `enforcedBy` in flowBible.ts AND beatsSource.ts, rejects any id not in ENFORCER_REGISTRY (retired ids rejected by absence), validates sectionManifest completeness + legal values + filled⇒non-empty. Wired as `check:rules-registry` inside `check:beats` (package.json:45-46). Ran live: PASS. Both prior semantic clashes fixed: `gsleep-one-or-two` now cites the new `eval:selection-cap` (registry meaning matches 1-2 cardinality); `gsleep-react-and-ask` now cites `eval:warm-opener` instead of the borrowed `eval:name-the-goal`. |
| 3 | Section 13 on goals-sleep | **FIXED** | `conversation` filled (beatsSource.ts:1677): opens + 5 branches (valid picks → `tool:submit_goals`; three-plus → scripted "Which two matter most right now?"; vague → scripted pin-down; unsure → scripted help-you-decide set per the improvisation ruling; off-topic → glob-out-of-scope) + maxTurns 4 + onMaxTurns. category-women equally filled (1188). Both consistent with CONVERSATION_MODEL defaults and the scripted-prompts-only law. |
| 4 | Tile preselect | **FIXED** | categoryGrid.tsx:201-202 `// glob-no-preselection: nothing selected on entry` + `useState<string | null>(null)`; goalsList.tsx:21 `useState<string[]>([])`. Global rule `glob-no-preselection` cites `component-registry-check` with honest `status: 'app-reconcile-pending'`. Deployed bundle matches source. |

Also from the prior gate list: the fake PENDING decision row in applicableDecisions is gone (real rows only, decision-3 binds:true on category-women is exactly right); components "exact state" claims are now explicitly marked "ASSERTED SPEC the render component does not implement yet" + section `status: 'app-reconcile-pending'`. NOT applied from pass-1: identity alias clutter (3 of 5 aliases = beatId, now also codified inside `deriveVariantIdentity`) and the rulesCode restates (reveal-gates / audio-ownership / clip-resolves / id-alias duplicate sections 2/4/1 on both exemplars).

---

## Part A — Global layer (flowBible.ts)

**APPROVE (non-blocking, the layer is genuinely strong):**
- All eleven required sections present and rendered in FlowDesigner (imports line 37-48, render 2893+): improvisation law (windows now `[]`, OFF ruling with the scripted-prompts resolution inline), global rules + precedence ("crisis > global > beat > script; a beat rule may tighten, never loosen"), tool-failure contract with approved verbatim copy, conversation model (section-13 ruling), data-passing with the Yonas in-repo precedent (merge 196e99ed), coach=LLM, consumer contract, enforcer registry (33 ids incl. new `eval:selection-cap`), RETIRED map, canonical enums (8 categories LOCKED; gender Female/Male/Other with the Other-never-propagates ruling), decisions log (all 8 decisions carry Yair rulings with dates), files/save/sync map (16 edges, honest HIGH stale-risk flags).
- Every `enforcedBy` in the file resolves against the registry, machine-checked, ran clean.
- Honesty about non-wiring is real: CONSUMER_CONTRACT "today" column, EnforcerStatus built/planned, SourceStatus needs-yair on glob-ack-where-declared.

**CHANGE (should-fix):**
- **A1. CONSUMER_CONTRACT guards row is now stale in the honest direction.** Line 259 still says "the only guard parses the retired annotation schema and cannot see bible.*" — false since this very batch: bible-registry-check sees bible.enforcedBy + manifests. Update the `today` cell. (Exact change: "PARTIAL: bible-registry-check resolves every enforcedBy + validates sectionManifest; content-diff checks still planned".)
- **A2. The built validator is not in the registry it enforces.** ENFORCER_REGISTRY still lists `render-rules-check` as planned while its id-resolution half now exists as `scripts/bible-registry-check.mjs`, which itself has no registry entry. Add `bible-registry-check` as kind static, status built, owner render — or flip render-rules-check with a note naming the script. The registry under-reporting reality is precisely the drift class this system polices.
- **A3. No CI runs the guards.** This branch's `.gitlab-ci.yml` contains only a never-run voice-sync job; `check:beats` is a voluntary npm script. Wire it into the render deploy/MR pipeline so the gate is machine-run. (FILES_SYNC_MAP edge 12 already describes it as "manual/CI guard" — make the CI half true.)

**GAP (nice):**
- A4. `TurnBranch.then` is a free string; the convention ('wait' | 'advance' | 'tool:<name>' | 'repeat') is only a comment. A union-or-pattern check in bible-registry-check would close it.
- A5. COACH_IDENTITY carries no enforcedBy (identity statement, arguably fine; could cite eval:parity-walk for the tool-boundary claim).

## Part B — Per-beat (goals-sleep, category-women, goals-move as inherited variant)

**APPROVE:**
- goals-sleep: 14/14 manifest filled and true to content; section 13 filled (see re-check 3); edges carry the approved tool-failure copy verbatim + retained-selection detail; persistence watchOut honest ("do not invent a table name"); flow section still the model of what good looks like; acceptance rows follow GRAND-PLAN's 4 + one beat-specific extra; applicableDecisions clean (no fake rows), the decision-4/5 "input, not the gate" nuance kept.
- category-women: complete own bible incl. section 13; `catw-single-select` correctly cites `eval:single-select` (exactly-one semantics fit the category beat now that goals beats use eval:selection-cap); decision 3 binds:true with the enforcement path named.
- goals-move: identity resolves DERIVED and correct (beatId goals-move, order 14, MOVE screenId aliases), chip'd "generated"; its io inherits the head's correctly-generic contract.

**BLOCKING:**
- **B1. Inherited variant content still asserts head-category facts** (re-check 1 above). Concrete on goals-move's resolved bible: components = 4 SLEEP tiles; voice.perLine = sleep clip while the same card's script plays `onboard_beginner_02_move`; acceptance = "renders goals-list for Sleep better"; contextProse/flow = Sleep better; rule ids `gsleep-*` (non-unique per beat, breaks a per-rule scorecard); manifest inherited as all-'filled'. Exact change (either suffices before the fill):
  (a) author per-variant overrides for the category-specific sections (components, voice, contextProse, flow, acceptance) on the 7 goals siblings — proves the sub-beat-override pattern the Yair ruling describes; or
  (b) extend resolveBeatStructure to DERIVE those sections the way identity is derived (tiles from `goalsByCategory[props.category]`, clip from the beat's own script[], category token from props) — the parameterization the prior review asked for; and in either case add a bible-registry-check rule: a `variantOf` beat may inherit only inheritance-safe sections (rulesContext/rulesCode/conversation/edges/allowedTools/persistence/applicableDecisions/scriptMeta); components/voice/contextProse/flow/acceptance must be own or derived. Without the guard rule, the next lazy fill re-creates this silently.
- **B2. category-women edges.tool-failure contradicts the approved global contract.** Row (beatsSource.ts:1295-1298): "submit_category errors: stay on the beat, do not narrate the failure, let the user pick again" — that is the silent failure TOOL_FAILURE explicitly bans ("never fail silently with no user signal after the retry"), and precedence says a beat rule may never loosen a global. goals-sleep has the correct row; category-women predates the ruling and was not reconciled by this batch. Exact change: replace with the goals-sleep wording (silent retry once; toast "Couldn't save that, tap to retry" on tap path with selection retained; voice line "That didn't go through, let me try again"; never advance). One row; exemplars are the fill template, so this multiplies if left.

**CHANGE (should-fix):**
- **B3. category-women uses non-canonical gender vocabulary.** `catw-women-variant` (line 1157-1160): "renders ONLY when gender == woman; men, non-binary, undisclosed get the default"; flow.upstream: "gender == woman". CANONICAL_ENUMS locked Female/Male/Other with `womenArtSelector: "gender === 'Female' is the ONLY selector"` and says the non-binary/undisclosed language maps to Other. The beat that IS decision 3's render side should speak the locked enum. Mechanical text fix in rule + flow row (+ acceptance row "gender == woman").
- **B4. voice.mode prose still contradicts the machine type** on BOTH exemplars: "reconciled from source Verbatim; enum is Verbatim / Generative" while beatsSource.ts:15 still reads `VoiceMode = 'Verbatim' | 'Improvise' | null`. Prior finding, unfixed. Either reconcile the type or drop the "enum is" claim from the rows.
- **B5. Double status channel with divergent values.** goals-sleep components: `sectionManifest.components = 'filled'` while the section carries `status: 'app-reconcile-pending'`; persistence is manifest-'filled' while its watchOut says the write target is unknown. The guard validates only the manifest channel. State the precedence (manifest = authored-ness, section.status = source verification) in the schema comment, or move these to manifest 'pending-app-reconcile'. Undefined precedence here becomes 40 beats of ambiguous status at fill time.
- **B6. Pass-1 leftovers now codified:** the 5-alias identity block (3 rows = beatId) is reproduced on both exemplars AND generated by deriveVariantIdentity, so the accepted "show only overrides" change now needs a generator edit too; rulesCode still restates sections 1/2/4 facts as four extra rules per beat.

**GAP (nice):**
- B7. Head `category` beat is still bible-less while its variant carries the full contract (the inversion the prior review flagged); habits head likewise, so the 29 habit variants resolve to no bible (at least no wrong facts). Fill heads first at fill time.
- B8. The `glob-ack-where-declared` exception (needs-yair) has no exemplar; the habits group will need one declared-ack exemplar before its fill.

## Part C — Model per-type (uniform sections + per-section status)

**APPROVE:**
- The uniform-shape ruling is implemented for real: `BibleSectionKey` (14 keys), `SectionFillStatus = 'filled' | 'pending-app-reconcile' | { na: string }`, `sectionManifest` REQUIRED on every bible (type-level) and machine-validated (guard: all 14 keys present, values legal, na requires a non-empty reason, **filled ⇒ section non-empty with per-section-shape emptiness rules** — no fake-empty can pass). Both exemplars declare complete manifests and every 'filled' claim is content-true.
- Renderer honors the model: filled → accordion; na → "N/A for this type: reason" row; pending → amber chip row (BibleSectionSlot, FlowDesigner.tsx:1111). Never a silently absent section.
- Fit: silent beats can mark voice/conversation/allowedTools { na }; verbatim-MP3 fits (goals-sleep IS MP3+verbatim with a filled contract); interactive multi-turn fits (section 13). Extensible: adding an archetype = a manifest policy row, not a schema change.

**CHANGE (should-fix):**
- **C1. Per-archetype legality is a declared TODO** (bible-registry-check.mjs:24-26): nothing yet stops a silent beat marking `allowedTools: 'filled'` or a multi-turn beat marking `conversation: { na: ... }`. Acceptable for THIS gate only if the fill spec pins the archetype table (which sections each beat `type` must fill vs may na) and the guard grows the table during the fill's first slice. Name it in the fill brief so it doesn't silently stay a TODO.
- **C2. The card badge ignores the manifest.** "full contract" + "Bible fill · 12 sections" render unconditionally for ANY bible-bearing beat (BiblePanel 1231, 1246) — including a variant whose sections are wholesale-inherited and a future beat with pending/na sections. Derive the badge from the manifest (e.g. "14 filled" / "12 filled · 2 pending") and fix the count messaging: spec doc says 12, schema comment says 14 keys = 13 numbered + decisions, UI says 12. One answer, everywhere.
- **C3. Variants inherit the head's manifest.** The manifest is spread in with the other sections, so a sibling's card claims fill statuses it never authored. Make sectionManifest per-beat mandatory even on variants (cheap once B1's inheritance whitelist lands: the manifest simply isn't inheritable).

**GAP (nice):**
- C4. Acceptance criteria: both exemplars carry GRAND-PLAN §6's four checks plus one beat-specific extra (routes correctly / variant is correct) — a good, now-consistent convention that the doc doesn't know about. Amend §6 to "the four checks + optional beat-specific extras" so the fleet scorecard is built to the real shape.
- C5. No exemplar demonstrates { na } or 'pending-app-reconcile' at the manifest level; the tri-state ships untested by the template. Filling one silent/MP3-only beat (e.g. weekly-gaps) as a third exemplar would exercise it before 40 copies.

## What the fill must do (the "WITH-CHANGES")

Pre-fill, blocking: (1) B1 — variant category-facts: overrides or derivation + the inheritance whitelist in bible-registry-check, proven on goals-move; (2) B2 — one-row tool-failure fix on category-women.
Ride-along in the same MR, cheap: A1, A2, B3, B4, B5, C2's badge, C3.
Pinned in the fill brief, not blocking the gate: A3 (CI wiring), C1 (archetype table grows with the fill), C4 (GRAND-PLAN amendment), B6 aliases/rulesCode dedupe, C5 third exemplar.
