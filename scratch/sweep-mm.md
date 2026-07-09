# Mattermost Activity Sweep — 2026-07-09

## ai-yair

**Bible fill spec + gap audit delivered by Mint's Claude.**
- 12-section contract model defined (identity, script, components, voice, rules.context, rules.code, context, allowedTools, persistence, flow, edges, acceptance + applicable-decisions).
- Gap audit: rules.code absent everywhere (biggest hole); persistence/edges/acceptance absent almost everywhere; components thin; applicable-decisions unmapped on 6 decision-bearing beats.
- Highest-stakes gaps: profile-asks, category-women (art-variant gender guard), reflection, habits, goal-opener.
- Ranked fill provided: 9-part fill order from rules.code → applicable-decisions down to identity aliases.
- **5 open decisions for Yair:** (1) confirm 12-section model + resolved-props demotion; (2) allowedTools code-owned or generated now; (3) QA-eval ids as enforcers; (4) vapiAgent pull-in scope; (5) weekly p36/p78/gaps percentages for acceptance.
- Doc: gg-spec branch `render-bible-spec-and-gap-audit-2026-07-09.md`, MR !3 open.

**Coach-per-beat format (before full authoring).**
- 4 archetypes proposed: A SILENT (splash/get-started/sign-up), B VERBATIM MP3+tools (profile-asks/checkin), C CATEGORY-OPENER (goals), D GOAL-OPENER (habits).
- Tools resolved from beat_contexts.json; 2 source-integrity flags found (advanced-frequency dual id, state-check no tool entry).
- **4 questions before fill:** (1) OK archetype shape + QA-eval enforcer model; (2) eval:* ids match registry or new ones; (3) state-check tool-less; (4) fix advanced-frequency id split now or later.
- Doc: `gg-spec/docs/coach-per-beat-2026-07-09.md`.

---

## ai-yonas

**OWNERSHIP CONFUSION → RESOLVED.**
- "Build lead session STARTED, claiming it" posted 3 messages ago — BUT no branch pushed, 1/62 still the only progress.
- Build brief then handed to Yonas S2 — but S2 clarified it rules itself OUT (guards + rename lane, !514 Part 1 done).
- Yonas S3 (review lane) flagged the crossed wire and refused to grab without clarity.
- **CONDUCTOR RULING:** build-lead subagent was false claim (STOPPED, dead, nothing to wait on). SINGLE OWNER = **fresh Yonas build session per Yair**.
- Review lane (S3) stays on review. Guards lane (S2) stays on !514 + rename. One builder, one reviewer, no collision.
- Session IDs feature added (export GG_SESSION=<role-id>). Yonas S2/S3 using manual [prefix] tags, backward compatible, optional.

**Build spec (for fresh session):**
- Scope: 62 real onboarding beats (77 ids minus 15 nested catw-* rule ids).
- Families: linear onboarding, 8 goals openers, ~40 per-goal habit picks, 5 weekly-projection, new per-habit-ack beat.
- Fold in 4 pass-1 changes first: reveal-to-clip explicit rule, real tool-fail signal, bounded off-topic, decisions-coverage-check.
- **Order: create ack beat, land edits, FILL BEAT 13 (goals-sleep) FIRST, then family batches.**
- Brief at ~/Developer/claude-work/gg-status/scratch/build-handoff-beats-fill.md.
- Data sources: gg-spec/docs/coach-per-beat-2026-07-09.md, fill-data-source-map.md, bible-fill-pass1-review-2026-07-09.md.

---

## ai-mint

**Usage snapshot (Opus 4.8, no Fable in this session):**
- Current session: 42% used, resets in 21 min.
- Weekly, all models: 81% used, resets in 4h 51m.
- Weekly, Fable: 83% used, resets in 4h 51m (tighter constraint).
- Headroom: session OK now; Fable near cap but not blocking (can run if needed, may want to wait for reset).

**Render + Bible review (pass 1 — human structure QA).**
- Human judges: are coach rules right, is contract faithful to product intent, are acceptance criteria true done, does tone read right, missing anything?
- Claude owns: enforcer ids resolve, clips link, types compile, bindings valid.
- Process: Claude explains 12 sections on live sample, hands human judgment spots, captures calls precisely.
- Per beat: APPROVE / CHANGE (name section + exact change) / GAP (what is missing).
- Live sample: https://bfec93c4.gg-onboarding-render.pages.dev (Category women's art, order 12).

---

## ai-sandbox

**Audio overlap fixed + conductor ready to merge.**
- QA Claude B: "Audio overlap is gone, 0ms at fork. Marking GO."
- Build Claude A: "Ready for the conductor."
- Conductor: "You are clear to merge when you want."

**"Real round trip" test — Mattermost loop.**
- Yair requested: "I want you to do Claude A and Claude B. There are actually two Claude accounts."
- System testing: WebSocket wake test, double-delivery probe, self-echo probe, teammate probe, keepalive live, ack-button test (tap-to-confirm).
- Conductor Claude testing message delivery and receipt loop.

---

## ai-alejandro

**Onboarding rebuild brief + parallel work options.**
- Brief at `gg-spec/docs/onboarding-rebuild-team-brief.md` (pull main).
- Model: render is single source of truth, right-side script is binding instructions, parity law, acceptance criteria, guardrails everywhere.
- Parallel tracks (do not touch render yet):
  1. **Guardrail scan:** every beat/tool/data-write/fallback/nav/audio/auth/state. Coverage map + suggested guards.
  2. **Source-integrity checks:** fail when fallback/stale file becomes real source. Required CI job alongside render parity.
  3. **Codebase cleanup:** flag second sources of truth for beat order/copy/context/audio.

**Plan scrutiny mission — from Yair.**
- Deep review of finish-line strategy, step by step, poke holes.
- Docs: `plan-scrutiny-mission.md` (read first), `onboarding-finish-line-plan.md` (model, gates, per-beat QA), `onboarding-system-audit.md` (audit, 11 findings).

---

## Flags

### Beat 13 / Bible fill
- **Status:** Spec delivered (Mint), gap audit complete, ranked fill provided, 5 open decisions awaiting Yair's call.
- **Build:** ownership resolved, fresh Yonas session is single owner, review lane (S3) in place, build lead subagent was false claim (dead).
- **Order:** create per-habit-ack beat first, land pass-1 edits, FILL BEAT 13 (goals-sleep) FIRST, then family batches.

### Fable
- Not running per-beat review in parallel yet (Fable at 83% weekly, near cap). Session headroom OK if needed.
- Full Fable + human review pass 2 comes after build lands beats.

### Audio overlap
- **FIXED.** 0ms at fork, QA marked GO, conductor ready to merge.

### Azure / OpenAI credits / QA environment
- **No mention** in recent Mattermost activity. May be handled elsewhere or not yet discussed.

### Fathom-call feedback
- **No mention** in recent activity.

### Guardrails
- **New work assigned to Alejandro:** full guardrail scan + source-integrity checks as required CI job.
