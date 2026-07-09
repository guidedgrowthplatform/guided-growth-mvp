# gg-spec docs sweep (last ~2 days) + 3 targeted hunts — 2026-07-09/10

Repo: ~/Developer/gg-spec (pulled clean, up to date). Also checked
~/Developer/claude-work/ for azure-pilot, render-qa, qa-rounds, and any
*azure*/*fable*/*fathom* files, plus the conductor ledger
(~/Developer/claude-work/gg-status/docs/fix-reports/STATUS.md) and its
scratch/ dir, which turned out to hold the two most important artifacts.

---

## Full commit log, gg-spec, last 2 days (git log --since="2 days ago" --stat --oneline)

Grouped by theme (see raw log for exact order):

**Onboarding Bible / render spec (the beat-13 workstream):**
- `570f769` handoff: render completeness QA — define the full per-beat Bible + audit gaps → `docs/handoff-render-bible-qa.md`
- `c6d252a` (Mintesnot) render-Bible-QA deliverable: 12-section per-beat Bible spec + gap audit + ranked fill → `docs/render-bible-spec-and-gap-audit-2026-07-09.md`
- `e0a4d61` (Mintesnot) coach-per-beat: 4-archetype format + tools resolved from beat_contexts.json → `docs/coach-per-beat-2026-07-09.md`
- `3330b3a` (Mintesnot) Merge render-bible deliverable into main
- `bc5f832` (Mintesnot) docs: coach behavior per onboarding concept beat → `docs/onboarding-coach-per-beat-2026-07-09.md`
- `e5a0192` (yair180) capture: Bible-fill pass-1 review changes + enforcer-layer gate finding → `docs/bible-fill-pass1-review-2026-07-09.md`
- `48ee9bd` (Mintesnot) Render+Bible review pass 1: category-women verdict (verified findings only) → `docs/render-bible-review-pass1-2026-07-09.md`
- `91c4529` rules: EVERY rule must be enforceable (Yair) — ban prose-only, require a real enforcer → `docs/rules-enforceability-law-2026-07-09.md`
- `93be0a2` / `5980fe6` onboarding behavior decisions (7 engine decisions) → `docs/onboarding-behavior-decisions-2026-07-09.md`
- `2b2062d` docs: publish the screenId->beatId rename map → `docs/onboarding-rename-map.md`
- `a90f5b5` docs: structure build brief (global layer + data-passing + files/sync map) from 2026-07-09 spec call → `docs/structure-build-brief-2026-07-09.md`

**Onboarding copy / recording / habit-ack:**
- `376206b` Onboarding copy handoff: audio generated (114 clips, MR !527)
- `8ab1615` Onboarding copy: per-habit acknowledgment set (110 clips, approved) + rules 27-29 → `docs/onboarding-habit-ack-2026-07-09.md`, `docs/onboarding-copy-flow-rules.md`
- `1903999` shorten rows 14/67/68/71, flip to re-record
- `876cc08` Copy brainstorming session state
- multiple `docs/onboarding-recording-table-2026-07-08.md` edits (category lines, buttons)
- `518a9fc` weekly rules APPROVED (Yair) → `docs/weekly-projection-rules-APPROVED-2026-07-09.md`

**GRAND-PLAN / finish-line / system audit (2026-07-08/09):**
- `a169989` docs: THE GRAND PLAN → `docs/GRAND-PLAN.md`
- `a1a067e` grand-plan: resolve epoch rule (render stays permanent)
- `d7b14d4` full finish-line plan + system audit + plan-scrutiny mission
- `46fa915` onboarding rebuild team brief

**Team-mattermost / comms (own workstream, not beat-13/Azure related):**
- Many commits building `skills/team-mattermost/` (session IDs, self-echo fix, ack, watcher, AI-COMMS-SOP.md) — see log, unrelated to the 3 hunts.

**Voice / Cartesia:**
- `fe9e4e0`/`dc3c92d`/`c6a38fe`/`27dafbb`/`6783e11` voice-presets.json/.md canonical registry, drop deprecated "4 (enhanced)" clone, lock Pro Clone routing.

**Library / calendar / other:**
- `34ec509`/`b1ee222` Library design grounding (2026-07-08)
- `24c7847`→`e8cbdc4` calendar-integration-mint-task/handoff evolution
- `0c09420` Timothy role redefinition (2026-07-08 call)
- `1cf8d0c` mission-control-dashboard-spec, conductor command center handoff

---

## HUNT 1 — "FABLE SWEEP" feedback (beat 13 / Bible-fill shape)

**Found. Location: `~/Developer/gg-spec/docs/render-bible-review-pass1-2026-07-09.md`**
(paired with `~/Developer/gg-spec/docs/bible-fill-pass1-review-2026-07-09.md`)

These two docs ARE the "Fable sweep" — a pass-1 human+AI structure review of the
12-section Bible model, run against the `category-women` exemplar (order 12) as
a stand-in for beat 13 (goals-sleep) until beat 13 itself was built.

**`render-bible-review-pass1-2026-07-09.md`** (Mint + Mint's Claude, per-section review):
- Overall verdict: **APPROVE-WITH-CHANGES**. The 12-section format proved its value — it
  caught a real render bug (§3: first tile pre-selected on entry, spec says no
  preselection) purely by being read against the live render.
- Per-section table: sections 2 (script+timing), 4 (voice), 7 (context), 8 (tools),
  10 (flow), 11 (edges), 12 (acceptance) = APPROVE. Section 1 (identity) = CHANGE
  (drop displaying aliases that always equal beatId, clutter). Section 3
  (components) = BUG+GAP (the preselection bug; static enforcer can't catch runtime
  state). Section 5 (coach rules) = CHANGE (add "silent after the pick" rule, widen
  single-select wording). Section 6 (engine invariants) = CHANGE (4 of 7 restate
  rules already owned by sections 1/2/4 — drift risk, need one canonical home per rule).
  Section 9 (persistence) = GAP (exact table/column unknown, app-reconcile).
- **Three model-level patterns** (the real output of the pass): (1) enforcement is
  DEFINED but not RUN — runtime guarantees (no-preselection, diff-phone-vs-components)
  have named enforcers that don't actually execute; (2) cross-section duplication
  (same rule restated in 3-5 places, exactly the drift the Bible exists to prevent);
  (3) clutter (derived values shown instead of only overrides).
- Beat-13 note at the bottom: "Beat 13 (goals-sleep) is the actual pass-1 verdict
  target; its verdict follows once the build fills its 12 sections." (This build
  has since landed — see MR !531 mentioned in the conductor ledger.)

**`bible-fill-pass1-review-2026-07-09.md`** (sourced "ai-yonas pass-1 review", captured
by the conductor):
- **Verdict: APPROVE.** Cleared to apply to beat 13.
- 4 actionable changes to fold into the fill (beat 13 first): (1) make reveal-to-clip
  gating order an explicit rule (currently inconsistent basis between seq-2/seq-3);
  (2) tool-failure edge case needs a defined signal, not silence; (3) "off-topic:
  acknowledge briefly" is too open, needs a strict bounded reply; (4) applicable-decisions
  section has no enforcer — wire `decisions-coverage-check`.
- **Material gate finding:** the enforcer layer is real but partial. Built:
  `render-link-integrity-check.mjs`, `audio-ownership` + source-fork guards (in
  `scripts/source-integrity-check.mjs`, MR !514, pending land). NOT yet built:
  `id-alias`, `reveal-timing`, `component-registry`, `decisions-coverage` (render-side),
  `persistence-contract`, `advance-gate`, `tool-contract` (app-side), and the whole
  `eval:*` QA-eval registry. So Bible `enforcedBy` ids are aspirational until those
  land — flagged as a release-gate item.

---

## HUNT 2 — "FATHOM CALL" feedback for BEAT 13

**Found. Location: `~/Developer/claude-work/gg-status/scratch/call-feedback-2026-07-09.md`**

Not in gg-spec — it lives in the conductor's working scratch dir (not yet promoted to
a gg-spec doc). Source: Fathom recording 162341344 (https://fathom.video/calls/741417002,
~29 min), a spec-review call with Yair + Mint + Yonas reviewing the 12-section Bible
model on the category-women exemplar.

Key content:
- **A. Global spec additions needed (apply to ALL beats, not just 13):**
  1. **No-improvisation law.** Yair, verbatim: "LLM cannot improvise, ever, unless
     it's given a very specific place to improvise." Need a global rule defining
     exactly when improvisation is allowed and its boundaries.
  2. **Global rules layer on top** for off-topic/out-of-scope handling (Yair's
     examples: "my gender is yellow," "who won the football match yesterday") —
     needs to be surfaced/built, every beat inherits it.
  3. **Global tool-failure error handling** — currently every beat says "stay on
     beat, don't narrate failure" but never says HOW the failure is shown (toast vs
     AI reply, voice vs text). Same gap the Fable/pass-1 QA flagged.
  4. **Multi-turn conversation modeling** — the model as written is single-turn only;
     Yonas: it "doesn't feel conversational." OPEN RULING NEEDED: new section 13 vs
     folding into section 5 (Yair leans section 5 but wants it clearer).
  5. **Beat-to-beat data-passing contract** — currently the LLM "improvises" how data
     moves forward (e.g. submit_category's value reaching the next beat). Yonas wants
     a global state manager / URL query param instead of re-reading the DB after
     submit; has a past example to share.
  6. **Make "coach = the LLM" explicit** in the model — currently ambiguous whether
     coach-behavior section covers the LLM turn.
- **B. Per-section bug fixes:** (7) coach-behavior contradiction between "no praise
  after pick" and "keep response specific to their pick" — resolve to one rule
  (overlaps the Fable QA's cross-section-duplication finding). (8) first pick-grid
  option auto-selected on entry — same bug the Fable/pass-1 QA caught at §3.
- **C. Render-as-source directive (Yair's closing note, "Part B"):** the render must
  also carry every file + what it does, how data is saved, and the Supabase sync
  rules, collapsible, landing on the Master Sheet. Yair: "we're still building the
  structure" — the 12-section per-beat fill is a shape test, not the finish line.
- **E. Open decisions needing Yair:** multi-turn as new §13 vs expanded §5; confirm
  coach=LLM; plus carried-over Fable QA opens (silent-after-pick rule, stay-open
  SHOULD-vs-MUST, lock the 8 category labels).

This doc is explicitly the actionable extraction the conductor is using to update
BEAT 13 before the full 25-beat build proceeds (per STATUS.md's 2026-07-09 ~21:33 entry).

---

## HUNT 3 — AZURE QA change (OpenAI -> Azure for all QA)

**Found, multiple layers. Status: DONE / LIVE on the QA preview environment as of
2026-07-09 ~19:00 IDT.**

1. **Rationale/plan doc:** `~/Developer/gg-spec/docs/qa-cloud-fleet-options.md`
   (2026-07-07) — recommends funding the QA persona fleet's browsers AND brain
   entirely on Azure (Azure App Testing for browsers, Azure OpenAI GPT-4o-mini for
   the persona-player, Claude kept for judge/conductor), spending down an expiring
   $1,000 Microsoft for Startups credit pool (expires 2026-09-19).
2. **Human QA <-> fleet connection spec:** `~/Developer/gg-spec/docs/human-qa-fleet-connection.md`
   (2026-07-07) — references the fleet's existing Azure OpenAI resource `gg-qa-openai`
   (creds at `~/.config/guided-growth/azure-openai.env`) as already funding the QA
   judge/analysis pipeline.
3. **Live cutover investigation:** `~/Developer/claude-work/scratch/azure-swap-plan.md`
   — read-only + live API validation proving the app's Responses API (function
   calling, previous_response_id chaining, streaming, the exact app request shape)
   works against Azure OpenAI (`gg-qa-openai` resource, eastus2). One caveat found:
   `temperature` param must become conditional (GPT-5-class models reject it, not
   an Azure limitation). gpt-4o/gpt-4o-mini confirmed deployable with quota headroom
   but not yet deployed (currently only gpt-5-mini / gpt-5.4-mini deployments exist).
4. **Actual deploy + verification:** `~/Developer/claude-work/scratch/iota-azure-deploy.md`
   (2026-07-09, 18:58-19:02 IDT) — the conductor force-deployed the QA preview app
   (`gg-qa-iota.vercel.app`) because `deploy_qa_preview` had been skipped on the
   main-push CI pipeline (gated to MR pipelines only), so the newly-set
   `LLM_PROVIDER=azure` + 5 `AZURE_OPENAI_*` project env vars had never actually
   been picked up. Manually ran the same Vercel deploy + alias steps CI would have
   run, confirmed via the Vercel API that `LLM_PROVIDER=azure` and all 5 Azure vars
   are attached to the `preview` target, then sent one real coach turn through
   `/api/llm` (signed in as a seeded QA test user) — got a clean 200 streaming
   response, real coach text, no config errors. **Verdict: Azure cutover for QA is
   live and confirmed working**, but this needed a manual force-deploy because the
   automatic CI path doesn't run on plain `main` pushes.
5. **Current status per the conductor ledger** (STATUS.md, 2026-07-09 ~21:33 IDT):
   flagged again as an open item to double check ("AZURE QA CHANGE flagged: the QA
   environment switched from OpenAI to AZURE for ALL QA (done on the other account);
   important, env changed; must check current status") — i.e. the conductor
   confirmed the switch happened but wants a fresh verification pass since sessions
   were moving to different accounts. Also related: `docs/qa-fleet-conductor-channel.md`
   and `docs/qa-round-loop-runbook.md` describe the QA round protocol this Azure
   swap feeds into. `~/Developer/claude-work/gg-azure-cutover/` is a full separate
   worktree checkout of guided-growth-mvp for this workstream (large repo tree,
   env example at `.env.local.example` — not a doc, a working checkout).

---

## Other notable recent gg-spec docs (not part of the 3 hunts)

- `docs/GRAND-PLAN.md` (2026-07-08/09) — the living strategic plan for the onboarding
  rebuild; epoch rule resolved (render stays permanent).
- `docs/rules-enforceability-law-2026-07-09.md` — Yair's hard rule: every rule must be
  enforceable, no prose-only rules; this is the law both Bible reviews above are
  checking beat 13 against.
- `docs/onboarding-rename-map.md` — the published screenId->beatId rename map for the
  atomic rename pass (referenced elsewhere as a live workstream, `onboarding-finish-line`).
- `docs/structure-build-brief-2026-07-09.md` — the newest doc (latest commit in the
  2-day window), capturing the global-layer + data-passing + files/sync-map brief
  from the same 2026-07-09 spec call as the Fathom feedback above — likely the doc
  that should absorb items A.2 and A.5 from the call-feedback extraction once promoted.
- `AI-COMMS-SOP.md` + `skills/team-mattermost/` — a large, separate hardening effort
  on the team Mattermost comms system (self-echo kill, ack flows, session IDs),
  unrelated to beat 13 / Azure but the single biggest commit volume in the window.

## Conductor ledger cross-reference (why these 3 hunts matter right now)

`~/Developer/claude-work/gg-status/docs/fix-reports/STATUS.md`, last entry
(2026-07-09 ~21:33 IDT), is Yair's live plan correction: apply the Fable-sweep
feedback + the Fathom-call feedback + human feedback to BEAT 13 first, get his
re-review, THEN build the remaining 24 beats (the earlier fill-all-beats handoff,
`~/Developer/claude-work/gg-status/scratch/build-handoff-beats-fill.md`, is
explicitly superseded/held until beat 13 is perfected). This sweep (dispatched as
one of a 4-agent 2-day sweep) is the mechanism finding those two feedback sources
and confirming the Azure status for that same re-plan.
