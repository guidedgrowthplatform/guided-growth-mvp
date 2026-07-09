# Forensic sweep — GG MVP conductor record, 2026-07-07 → 2026-07-09

Read-only reconstruction. Sources: `docs/fix-reports/STATUS.md` (line numbers cited as `L<n>`),
`Yair-Context/handoffs/HANDOFF-gg-conductor.md`, `CONDUCTOR-RUNS-LEAN.md`, the `scratch/*.md` files,
and (cross-check) `scratch/sweep-gitlab.md` produced by a parallel sweep agent dispatched from the
same ledger entry that spawned this one (L536 — see "Duplicate work" below).

**Important structural note on STATUS.md itself:** the file is NOT uniformly append-only despite
its own header ("append-only, one line per event, newest last", L40). Three different orderings
coexist:
- L41–L135: a block of entries running **newest-first, oldest-last** (L41 = 2026-07-09 19:50, the
  most recent entry in that block; L135 = 2026-07-07 15:15, the oldest). This directly contradicts
  the file's own banner.
- L156–L385ish: older 2026-07-02 material (Loop status, Verification batch, Handoff notes,
  Blockers) plus a second reverse-order stretch (L340–L385, newest-first again).
- L414–L536: genuinely chronological, oldest-first, append-only — this is the reliable tail and the
  one to trust for "what really happened when."
So the same events are effectively told twice, once backwards (a retrospective digest written by
an opus-conductor session) and once forwards (the real-time entries, including `[fable-fixer]` and
`[conductor-handoff]` tags the digest smooths over). They mostly agree, but not always (see
Confusion section).

---

## 1. Timeline

**2026-07-07 ~13:05–18:00 (day shift, multiple engine switches).** A `[fable-conductor]` session
resumes on a fresh Fable account (L112), inherits a large in-flight queue (!498 audio, !502
coach-silence, !504 corrections, local-video SOP), merges the "takeover batch" (!486, !492, !493,
!494, !495 — habit-schedule rulings, fork-delegation guard, QA-reset wipe, resync fixes; L128–L135),
then explicitly **hands the conductor role to VS Code / a different engine** (L110–L111) because
Yair moved accounts. A `[conductor]` (Codex) session then runs L91–L109, verifying QA accounts,
cleaning up stale walker processes, and gating !505/!502 live-acceptance. Effort/engine changed at
least 4 times in this single calendar day (Fable → VS Code Fable → Opus bridge "~8% left" L101 →
Codex → fresh Opus L69).

**2026-07-07 evening — the fix wave.** Three coach/audio bugs (coach-never-silent !502,
user-corrections !504, fork audio-overlap !505/B40) go through repeated NO-GO → fix → re-walk
cycles (overlap measured 2630ms → 669ms → 75ms → 0ms across four iterations, L82/L86/L87/L89) before
merging clean on iota (L82–L84). The REGRESSION RULE and REGRESSIONS.md are created this evening
(L88, L2 banner) specifically because Yair had seen "months of fix-one-break-another."

**2026-07-07 ~19:45–22:45 — the render pivot (the single biggest event of the window).** Yair walks
a live build and finds the onboarding flow had drifted hard from his render guide ("killing the
company," L80). This triggers: a 3-surface drift audit (L79), a gender-loop fix (!506, L76/L78), a
full flow reconciliation MR (!507, L77) that exposes a load-bearing conflict between the new
rhythm-first beat order and the engine's persist-step numbering (flagged, not papered over, L77),
and — the actual policy shift — Yair's decision that **the render is the one source of truth**
(L76). This is codified same night as the **RENDER PARITY LAW** and shipped as draft MRs !509
(parity export) and !510 (CI gate, report-mode) by a Codex session (L73).

**2026-07-07 22:45 – 2026-07-08 01:30 — render QA + !507 held.** Three Sonnet audits of the render
itself (L75) feed a synthesis report (L74) and a decision worksheet (L73). Yair rules that !507
should NOT merge yet — clean the render first, then reconcile the app to the cleaned render, "so no
interim copy ships" (L71). A full system-integrity audit lands at 01:30 (L67) naming SIX unresolved
architectural questions (epoch rule, screen_contexts fate, category-line ownership, voice-rule
machine semantics, allowedTools ownership, guard placement).

**2026-07-08 (day) — B58/audio wave 2 + fable-fixer thread.** A second fixer session
(`[fable-fixer]`, L414–L421) is onboarded specifically for B58 (audio double-arm) and !489 (Soniox
pre-mint). It root-causes B58 via a 5-mechanism map (L415), ships !508, and flags that the
`qa-onboarding-fable` account had silently stopped authenticating (L419/L421) — a flag that gets
re-raised THREE more times (L420, L422 "(b)", L424) before an `[investigator]` session finally fixes
it at 07-08 21:46 (stale password drift, L424). !508 merges 07-08 12:05 (L65).

**2026-07-09 00:30 — conductor-handoff, second track opens.** A `[conductor-handoff]` entry (L422)
opens a **separate track** — the "onboarding-render finish-line" — running in parallel with the
fix-wave lineage above. From here the render work becomes the dominant thread: 42 MP3 clips land
(!518, L423), a Mattermost bus/watcher gets built and hardened (L425–L426), the **epoch rule is
resolved** ("render stays PERMANENT source of truth," L428), a voicegen preset footgun is fixed
(!520, L429–L430), and at 02:25 Yair gives a **"full-power mandate"** — merge render MRs
autonomously, stop only at render-ready (L431). Fifteen minutes later that mandate is **already
corrected**: annotations must be FULLY populated before anything else; Fable QA runs only after,
not now (L432).

**2026-07-09 03:00–04:30 — the finisher stall and takeover.** The render "finisher" branch is
reported as actively building for hours; at 03:25 the conductor catches that it actually stalled
3.5 hours earlier with no ping (L438) and takes it over with a fresh Opus agent. The takeover lands
clean (!517 merged 03:35, L439), the render redeploys (with a broken-alias caveat — production
still served the stale build for a while, L440), and a command-center dashboard ships (L437). At
13:40 (L449) the conductor **owns a coordination mistake**: the branch it "took over" belonged to a
live Yonas session that was deliberately holding for a go-ahead, not dead — the takeover was clean
technically but skipped a caution flag that would have caught render bugs Mint later found in the
same area (double-render, reveal-timing).

**2026-07-09 morning–afternoon — the "Bible" model (12-section per-beat contract).** A rapid
sequence of design/QA/ruling cycles: exemplar annotation (!522, L441) reveals two DIVERGENT rules
schemas exist (Codex's all-flows work vs. the exemplar) that must reconcile before scaling (L441,
L444); Yair issues a hard **"Rules Law"** — every rule must be machine-enforceable, no
prose-only rules allowed (L446); variant-beats get collapsed from 62 renders down to ~25–26 concept
beats (!523, L447); a play-button UI fix (!524) and a voice-config fix (!525) stack on top, both
edited the same file and were known in advance to conflict (L447–L448); Mint's deep QA of the Bible
model surfaces a live render/runtime divergence (the women's-art variant exists in the render but
not in the live flow at all, L454) which gets explicitly deferred rather than silently patched.

**2026-07-09 ~14:24–17:35 — first account switch of the day, Bible fill begins.** Yair hits 90%
usage and switches Claude accounts (L464 handoff, L477 new conductor). The new conductor discovers
neither !523 nor !525 has ever had a CI pipeline run against them at all (L479, L483 — confirmed
independently in `scratch/render-ci-gate.md`: render MRs get **zero CI**, `.gitlab-ci.yml` does not
exist on the render branch). A one-beat sample fill (category-women) is built, reviewed, and
approved by Yair (L489, L505, L513, L517), triggering a full per-beat "Bible fill" build handed to a
Yonas session (L519), scoped first to just beat 13 ("goals-sleep") as a shape test.

**2026-07-09 ~19:20–19:50 — second account switch, structure work forks off.** Yair answers 6 open
model decisions (L44), locks the 8 category labels (L43), and hands a parallel "structure" build
(global layer above the 12 sections) to a Mint session (L46) while the Yonas session continues the
beat-13 fill (draft MR !531, L45/L42). At 19:50 the conductor snapshots and hands off again for
another account switch (L41) — the third conductor handover of the day.

**2026-07-09 ~21:12–21:33 — fourth conductor session, plan correction, the sweep dispatched.** A new
conductor comes up on Yair's fresh "Guided Growth OS" account (L534), confirms beat-13 = goals-sleep
was filled correctly (!531), and is told to build everything on Yair's own accounts going forward,
not Mint's/Yonas's. Thirteen minutes later (L536) Yair **reverses the build-everything order**:
beat 13 must first absorb Fable-sweep feedback, Fathom-call feedback, and human feedback, get
re-reviewed, and only THEN does the full 62-beat fill proceed — "the earlier fill-all-beats handoff
is superseded." In the same entry, Yair also flags that the QA environment moved from OpenAI to
Azure on a different account and needs status-checking, and dispatches the exact 4-agent "2-day
sweep" this document is part of.

**Parallel side-tracks that ran the whole time, largely independent of the render push:**
- **OpenAI cost workstream** (L54–L62, 07-09 14:10–16:05): $10 OpenAI credit draining fast on the
  coach's `/api/llm` path triggers an audit, an Azure swap plan, live Azure Responses-API proof, a
  new `gg-prod-openai` resource, and a same-day model-policy flip: gpt-4o was "a miscommunication,"
  the coach was always meant to run on mini (L57). QA env (`gg-qa-iota`) is flipped to Azure and
  proven live (L54); production stays on OpenAI, gated on Yair (L54–L58, and per L536 this gate's
  current status is now explicitly in question again).
- **Azure QA fleet pilot** (L90–L112 desc., 07-07 evening): accounts provisioned, a canary run
  false-negatives on a timeout mismatch (60s canary vs. 90s nav timeout, L90), never actually
  re-run solo before the day's later pivots overtook it.
- **Mattermost comms hardening** (L425–L426, L48–L50): session-id tagging, a private
  `yair-sessions` channel, watcher/dedup fixes — largely done, but a fresh QA-and-fix handoff for
  the same system (self-echo noise, human-signal relevance) is STILL being dispatched as of L532
  and L536, i.e., the comms system needed a second hardening pass within the same 2 days.

---

## 2. Locked decisions

- **RENDER PARITY LAW** (2026-07-07, Yair, STATUS.md banner L1): the render
  (gg-onboarding-render.pages.dev) is the one source of truth for onboarding; a required
  `render_parity` CI job + a full behavioral parity walk gates every build; report-mode until main
  first matches the render.
- **REGRESSION RULE** (2026-07-07, Yair, L2): every acceptance verdict and round judge must name
  regressions explicitly (worked-before/broke-now/introduced-by) into `REGRESSIONS.md`.
- **Habit scheduling scope ruling (A)**: habit *creation* is off the mid-flow scheduling beats;
  full add/remove/frequency-change lives only on the plan-review/approve screen (L135, shipped
  !495).
- **QA-reset scope ruling (B)**: a fresh QA restart must wipe ALL onboarding-derived state, not
  just habits (L135, shipped !494).
- **Epoch rule** (2026-07-09 01:45, Yair, L428): the render is the PERMANENT source of truth, not a
  migration seed; the flow builder edits it, never replaces it; the app always reconciles to the
  render. This explicitly overturns a competing doc that said the render "retires after launch."
- **screen_contexts scope correction** (2026-07-09 03:40, conductor, L435): retire ONLY for
  onboarding (28 screens fully covered by beatContexts already); keep it live for every
  non-onboarding screen, since `buildSystemPrompt.ts` has zero non-onboarding coverage otherwise.
- **Rules Enforceability Law** (2026-07-09 12:35, Yair, L446): every rule must resolve to a real
  enforcer (a static check or a named QA-eval); `proseOnlyAccepted` is banned from the schema
  outright.
- **7 behavior decisions locked** (2026-07-09 11:35, gg-spec/docs/onboarding-behavior-decisions-2026-07-09.md,
  L442): profile advance requires age+gender; missing gender = hard reject; women's-art variant
  gates strictly on gender==woman; habit cap = 2 total (flexible 2×1 or 1×2), floor 1 to advance;
  daily reflection reuses onboarding config verbatim; custom reflection prompts replay verbatim.
- **8 category labels locked** (2026-07-09 19:20, Yair, L43): Sleep better / Move more / Eat better
  / Feel more energized / Reduce stress / Improve focus / Break bad habits / Get more organized (+
  Create-your-own).
- **Weekly projection rules approved** (2026-07-09 17:20, Yair, L463): blank=0% no change; p78
  displays 76% (accepted, not forced exact); p36 displays 35% (accepted); the "gaps" frame's two
  empty days anchor to grid POSITION not weekday, non-empty days read as mediocre (~50–60%) not
  good, 8/8 streaks dead every day.
- **Bible model = keep 12 sections** (2026-07-09 14:24, Yair, L478, reaffirmed L459): fill first,
  Opus review pass, then human review; Fable QA optional and not yet.
- **Tagging convention** (Yair, standing, L513/L526): tag the human (@yonas @mintesnotm @yairamsel
  @timothyjm @alej4ndro) only when a message is FOR a human; AI-to-AI messages need no tag.
- **Build ownership moves to Yair's own accounts** (2026-07-09 21:12, L534): stop routing the big
  build through Mint's/Yonas's sessions; both stay on Mattermost but the build runs on Yair's seat.
- **Beat-13-first re-sequencing** (2026-07-09 21:33, Yair, L536): full 62-beat fill is HELD; beat 13
  must absorb Fable-sweep + Fathom-call + human feedback and be re-approved before the full build
  proceeds — this explicitly supersedes the build-dispatch instruction from ~5 hours earlier.

---

## 3. Open items / in flight right now (as of STATUS.md L536 + the newest succession block)

- **Beat 13 (goals-sleep) fill** — done as a shape test, draft MR !531, but per the very last
  ledger entry (L536) it is now HELD pending a revision pass (Fable sweep + Fathom call + human
  feedback), not proceeding to the full 62-beat build as previously instructed.
- **Full 62-beat Bible fill** — explicitly SUPERSEDED/paused (L536) until beat 13 is re-approved.
- **Structure build** (global layer above the 12 sections, enforcer registry, consumer contract,
  files/Supabase-sync map) — MR !532, running on a Mint session, targeting the live
  `annotate/sample-category-women` branch (a moving target per `sweep-gitlab.md` Flag 1).
- **Enforcer layer** — per L42, "PARTLY BUILT, NOT LANDED, NOT CONNECTED." Only lint/type-check run
  on main today; nothing reads `beat.bible` at all. !514 (source-integrity), !521 (CI guards,
  report-mode), !510 (parity gate) are all still draft, still targeting the render branch not app
  main, still unmerged. The eval:* coach-eval registry (10+ ids) does not exist as running code.
- **Render CI** — confirmed via live GitLab API check (`scratch/verify-523-525.md`,
  `scratch/render-ci-gate.md`): the render branch (`flow-annotated-render`) has NO `.gitlab-ci.yml`
  at all. Every render MR (!523, !525, !531, !532, etc.) has literally never had a pipeline run
  against it. "Checks green" language used for render MRs elsewhere in the ledger refers to
  `check:render`/`check:links`/`tsc` run manually by the agent, not CI.
- **!526 (6/7 behavior rules)** — verified green, marked ready (not draft) on GitLab, but explicitly
  HELD for a joint Yair+Yonas+Mint human review gate rather than merged (per L455, L461).
- **Rule 3 (women's-art routing)** — deferred to a separate flow-reconcile track; confirmed as a
  real render-vs-runtime divergence (render has a `category-women` beat and gender branch, the live
  runtime flow has neither, L454).
- **!507 (order+copy reconciliation to render)** — still open/draft on main, HELD since 2026-07-08
  00:05 pending the "clean render first" sequencing; multiple later render MRs implicitly assume it
  lands eventually but nothing in the ledger re-confirms its status after that hold.
- **Azure production cutover** — QA (`gg-qa-iota`) proven live on Azure gpt-5.4-mini; production
  (`guided-growth-mvp`) still on OpenAI, gated on Yair's go, owned by a separate `llm-cost-azure`
  session. L536's "AZURE QA CHANGE flagged... must check current status" suggests even the
  conductor is not confident of the current live state at the moment of the latest entry.
- **!530 (Azure provider onto the `production` branch)** — draft, marked "inert," purpose and
  relationship to !529 (already merged to main, flag-gated) is unclear even to the parallel GitLab
  sweep (`sweep-gitlab.md` Flag 3).
- **Mattermost comms QA/hardening (round 2)** — a full audit-and-fix handoff (self-echo, human
  signal relevance, WebSocket vs. polling, double-delivery) was written and handed off (scratch/
  handoff-mattermost-comms-qa.md) but not confirmed done as of the last entry.
- **The 4-agent 2-day sweep itself** (dispatched L536) — this document is one deliverable of that
  sweep; two sibling outputs (`sweep-gitlab.md`, `sweep-docs.md`, `sweep-mm.md`) already exist on
  disk as of this writing; a fourth ("ledger+handoffs arc + confusion list") may be this very task
  or may be a separate, not-yet-materialized output — worth checking before assuming this document
  is the only one.
- **Fable QA go-over** — repeatedly deferred/rescoped (first "give the whole window to QA," then
  "not yet," then tied to beat-13 revision); account allocation for it (Yonas weekly Fable at 68%
  used vs. Mint resetting nightly) was never firmly decided, only "pick it at the Fable step."
- **Open Yair confirmations still outstanding across the ledger**: exact per-day/dollar OpenAI
  burn (conductor cannot read platform.openai.com/usage, needs an admin key or Yair to check,
  L62); hard spend cap not yet set; whether a CODE-bucket rule may ever be `proseOnlyAccepted`
  (answered NO by the Rules Law, L446, but the reconcile agent's original question was still open
  at ask-time); Fable-account pick for the go-over pass.

---

## 4. Confusion / contradiction list

1. **The ledger contradicts its own stated ordering.** STATUS.md's WORKLOG header (L40) says
   "append-only, one line per event, newest last." In fact L41–L135 and L340–L385 run
   newest-first/oldest-last (a retrospective digest prepended at some point), while L414–L536 run
   true chronological order. Anyone trusting the header and reading top-down will read the last two
   days of work in reverse without any signal that the ordering flips partway through.

2. **The digest and the raw entries disagree on how the B58/audio fix actually happened.** The
   reverse-order digest (L65–L66) describes !508 as landing cleanly via a rebase merged by the
   conductor. The forward, real-time `[fable-fixer]` entries (L414–L421) show the actual mechanics:
   the fixer flagged that its live-collision repro could NOT be re-triggered on current main with
   three separate instrumentation attempts (L420) and merged anyway on the strength of the earlier
   evidence plus unit tests reproducing "that exact shape deterministically" — a materially weaker
   acceptance story than "verified: 2229 tests, pipeline green, backoff walk 0" as stated in the
   digest (L65). Neither entry is false, but reading only the digest hides that the live
   reproduction never actually succeeded on the merged head.

3. **Two independent rules/Bible schemas were built in parallel without either side knowing until
   reconciliation was forced.** Codex's `all-flows-one-source-render` branch (!515) built its own
   rules structure; a separate exemplar branch (!522) built a second, different rules structure; the
   conductor only discovered "there was NO rules structure on the TRUNK at all" and that these were
   two forked schemas at L441 — after both had already been built out. This is exactly the kind of
   duplicate-work-stream the single-conductor rule is supposed to prevent, and it happened anyway
   because the two builds were on different engines (Codex vs. Claude/Opus) reporting through
   different channels.

4. **A live branch was mistaken for dead and taken over mid-flight — acknowledged by the conductor
   itself.** L438 ("CRITICAL: caught that the finisher STALLED... Yair GO to take over") vs. L449
   ("COORDINATION MISS (own it): Yonas S1 was ALIVE, deliberately HOLDING at 4 commits for a go...
   NOT dead. I read 3.5h commit-silence + no ping as dead"). The takeover produced clean, green,
   merged code (!517) but skipped exactly the caution ("rendering-sensitive") flag that would have
   prevented the render bugs (double-render at beats 22/23, reveal-timing) that Mint found
   immediately afterward in the same code area (L449, L451). The single-conductor rule assumes one
   driver at a time, but here two sessions were both legitimately "in the driver's seat" on
   overlapping work and only one of them knew it.

5. **"Checks green" on render MRs does not mean what it means everywhere else in the ledger,** and
   this was only caught by an explicit verification pass late in the window. Ledger entries
   routinely say things like "checks green (tsc, render link-integrity 62 beats, build:flow)" for
   render MRs (e.g. L42) in the same voice used elsewhere for real CI-gated app MRs. A live GitLab
   API check (`scratch/verify-523-525.md`, `scratch/render-ci-gate.md`) confirms `flow-annotated-
   render` has no `.gitlab-ci.yml` at all, so EVERY render MR (!523, !525, and by extension !531,
   !532) has literally zero pipeline runs, ever. "Green" for these MRs means an agent manually ran
   a script locally, not that CI validated anything.

6. **Who is "the conductor" changed at least seven times in 48 hours, across at least four
   different engines/accounts, and the handoff quality was inconsistent.** Chronologically:
   Fable(acct A, L112) → Codex/VS Code (L110, L100) → Opus "bridge" at ~8% context (L101) → fresh
   Opus (L69, evening 07-07) → Opus continues through 07-08 → conductor-handoff at 00:30 07-09
   (L422, described as a "fresh Opus wrapper, same account" — i.e., NOT actually a full handover,
   just a process restart) → new Opus account at 14:24 07-09 (L477) → another account switch at
   19:50 07-09 (L41) → a fourth conductor on "fresh usage" at 21:12 07-09 (L534). Several of these
   transitions are documented via a "SUCCESSION" block prepended to
   `HANDOFF-gg-conductor.md`, but those blocks themselves are stacked in an inconsistent order in
   that file (a block literally marked "(SUPERSEDED)" sits physically BETWEEN two other blocks that
   are not marked superseded, rather than at the bottom), so a session that opens the handoff file
   cold has to read every block's embedded date to figure out which one is current rather than
   trusting file position.

7. **Yair's own architecture premise flipped and then flipped back within the same night.** At
   01:30 07-09 the system-integrity audit (L67) frames the render as one of several
   "MULTIPLE OVERLAPPING TRUTHS," implying it might not stay canonical. Fifteen minutes into the
   same session block a separate doc (render-handoff) is cited as saying the render is a "migration
   seed" that the flow builder eventually replaces (L427). At 01:45 (L428) Yair resolves this by
   ruling the render PERMANENT — but the ledger explicitly notes "docs saying the render retires
   after launch are superseded on that point," meaning at least one team-visible doc was actively
   contradicting the locked decision until this ruling landed.

8. **The full-build order was given, then reversed, within about 5 hours, after real work had
   already started against the first instruction.** At 21:12 07-09 (L534) Yair tells the new
   conductor to keep building on his own account, confirming beat 13 is correctly filled. At 21:33
   (L536), 21 minutes later in ledger time but likely longer in wall time, Yair reverses course:
   the full-beat fill instruction "is superseded" and beat 13 itself needs another revision pass
   first. Any session that acted on the 21:12 instruction without checking for the 21:33 update
   would be building against a stale mandate.

9. **A "50-scale" vs "16-walk" QA fleet ceiling was set, referenced, and then never actually
   exercised at any scale before the render pivot overtook it.** L105/L112 lock a 16-walk ceiling
   (Yair's ruling, "not 50 walks"). L90 launches an 8-wide Azure fleet pilot the same evening; it
   false-negatives on a timeout mismatch and is explicitly deferred to "re-run solo" — but no later
   ledger entry in this window records that re-run actually happening. The fleet workstream is
   referenced as active/relevant in at least three later entries (L423 cost-guard note, L536 "must
   check current status") without ever showing a completed pilot run in between.

10. **Numbering / branch-target sprawl the parallel GitLab sweep flags independently, corroborating
    this reconstruction:** `scratch/sweep-gitlab.md` counts **47 open MRs** with **24 still draft**
    as of the last snapshot, and flags on its own: !531/!532 both targeting the live, moving branch
    `annotate/sample-category-women` rather than a stable trunk; !515 vs. !527 targeting two
    sibling render branches (`flow-annotated-render` vs. `all-flows-one-source-render`) that
    diverged around 07-08 08:00 with no ledger entry resolving which is authoritative going
    forward; and !530 targeting a `production` branch outside the render/main flow entirely, with
    no stated purpose beyond "inert."

11. **This exact sweep may be duplicated.** The dispatching entry (L536) describes a 4-agent sweep:
    GitLab state (Haiku), "ledger+handoffs arc + confusion list" (Sonnet), gg-spec docs hunt
    (Sonnet), Mattermost recent (Haiku). Three sibling outputs already exist on disk
    (`sweep-gitlab.md`, `sweep-docs.md`, `sweep-mm.md`). Whether this document is the fourth
    ("ledger+handoffs arc") or an independently-triggered duplicate of it was not verifiable from
    inside this task — worth checking before treating this as the sole confusion-list deliverable.
