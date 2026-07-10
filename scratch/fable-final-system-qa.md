# Fable final whole-system QA — scale-ready gate

Date: 2026-07-10. Reviewer: Fable (fresh adversarial whole-system QA, third gate).
Artifact: `swarm/integrate` at `d0cfb06e` (= `5ab47983` + the category-women tool-failure fix),
worktree `~/Developer/claude-work/swarm-integrate`, live
https://swarm-integrate.gg-onboarding-render.pages.dev
Grounding read in full: GRAND-PLAN.md, render-bible-spec-and-gap-audit-2026-07-09.md, the
NOT-READY gate (whole-system-onboarding-qa-2026-07-10.md), the prior Fable re-QA
(re-qa-system-integrated.md). Every check below run by me on d0cfb06e, not taken from reports.

## VERDICT: SCALE-WITH-CHANGES

The machinery is real and every prior blocker is genuinely closed on this commit, verified by
running the guards, mutating the code, and probing the live deploy. F1 (the last blocker from
the prior gate) is fixed and deployed. But a fresh whole-system pass found ONE new template gap
that multiplies exactly the way F1 would have: the voice modality of every dynamic coach reply
(off-topic steer-back, re-asks, the tool-failure voice line) is uncontracted, has zero recorded
clips, is banned from live TTS by the locked voice rule, and is structurally invisible to the
guard suite. It is a one-decision + one-guard-scope fix, and it must land in the template before
the 40+ fill copies it.

---

## 1. Prior blockers re-verified on d0cfb06e (ran, not trusted)

| Item | Status | Evidence (mine, this commit) |
|---|---|---|
| B1 variant inheritance derives | CLOSED | Runtime `resolveBeatStructure('goals-move')` via tsx: all 14 sections derived, manifest all-'derived' (never 'filled'), zero leaks of "Sleep better" / "gsleep" / "onboard_beginner_02_sleep" / "goals-sleep"; voice resolves to `onboard_beginner_02_move`. |
| B2 coverage forces all 62 beats | CLOSED | Authoring run: "62 beats resolved a manifest (4 owner-filled, 8 derived-variant, 50 all-pending)". Buckets reconcile: owner-filled = coach-greeting, sign-up, profile-asks, goals-sleep; derived = category-women (variantOf category) + 7 goals variants. |
| Guards FAIL on deliberate regression | PROVEN x3 | Mutation A: neutered `variantSubstitutions` → exit 1, per-section leak errors on goals-move. Mutation B: forced all-'filled' in `deriveVariantManifest` → exit 1, "claims 'filled' but the beat does not own that section". Mutation C: re-injected `voiceEngine` into beatMetadata.ts COACH-GREETING → exit 1, "carries retired field". All reverted, `git diff --quiet` clean after each. |
| 8 static enforcers run | CLOSED | `check:beats` runs all 12 guards green: render, links, rules-registry, beat-metadata, id-alias, reveal-timing, component-registry, audio-ownership, tool-contract, advance-gate, persistence-contract, decisions-coverage. |
| Two-mode gate | CLOSED | Authoring real exit 0; `--mode=release` real exit 1 with 32 must-rule violations, ALL citing planned `eval:*` fleet evals, zero static checks unbuilt. (Note: piping to tail masks the exit code; I re-verified unpiped.) |
| Parity in CI | CLOSED (report mode) | `.gitlab-ci.yml` `render_guards` + `render_app_parity`, both `allow_failure: true` with explicit flip conditions in comments. Local `check:app-parity`: 0 matched / 7 opener mismatches / 8 app-only informational / 77 clips, 0 missing on disk. |
| Second source retired (B5) | CLOSED | beatMetadata.ts carries only authoring content (spokenContent/perElement/flags); `gen_beat_metadata.py` no longer emits the 4 behavioral fields; `FlowBuilder.withRenderFacts` live-reads from `BEAT_BY_SCREEN_ID`; reconcile guard proven to bite (Mutation C). |
| F1 category-women silent failure | CLOSED + DEPLOYED | `beatsSource.ts:1906` now carries the approved retry-once-then-surface contract; all 3 tool-failure edges (profile-asks 1029, category-women 1904, goals-sleep 2395) share it; `grep "do not narrate"` = 0 hits in source; deployed bundle `index-BkTahcv3.js` has "retry once quietly" x4 and the banned phrase x0. Live page 200, `/parity.json` schema v2, 62 beats, 10 keys. |
| tsc | PASS | `npx tsc --noEmit` exit 0. |

## 2. The new blocking finding (whole-system, adversarial)

### F1'. Dynamic coach replies have no voice ownership — an audio contract hole the guards cannot see

Chain of facts, each verified on d0cfb06e:

1. **The locked voice rule** (GRAND-PLAN §10.4): live voice ONLY for the name greeting; every
   other spoken line is a recorded clip. The render agrees: 58 beats MP3, 3 Silent, 1 Cartesia.
   profile-asks' own voice section asserts "No live Cartesia on this beat."
2. **The exemplars mandate dynamic spoken lines anyway.** Every interactive exemplar's
   conversation branches + edges require coach replies that are not in `script[]`:
   off-topic steer-back (`glob-out-of-scope`, beats 977/1823/2312), the gender re-ask, the
   maxTurns one-liner, the invalid-age redirect, and now the tool-failure voice path line
   "That didn't go through, let me try again" (in all 3 exemplars after the F1 fix).
3. **Zero clips exist for any of them.** `public/voice/ob/` (75 clips) + `public/voice/` (15)
   contain no steer-back / retry / redirect / failure audio.
4. **No policy resolves the contradiction.** Nothing in flowBible.ts or the beats declares
   these replies text-bubble-only, live-exception, or clip-backed. The modality is simply
   unspecified.
5. **The guard suite is structurally blind here.** `audio-ownership-check` walks `script[]`
   seqs only ("perLine covers every spoken seq" — true for scripts, silent on branches/edges).
   `check:links` checks script clips only. So a fill that copies this pattern 40+ times passes
   every guard.

Why blocking: this is the same class as F1 — a defect in the copy template that multiplies in
text form across the 40+ fill, and re-deciding after the fill means editing 40+ beats again,
which is exactly what this gate exists to prevent.

Exact fix (cheap, before the fill):
- One Yair decision, recorded as a global-layer row in `flowBible.ts` (GLOBAL_CONTEXT /
  TOOL_FAILURE area): on MP3/Verbatim beats, dynamic branch+edge replies are either
  (a) text-bubble-only (no audio), (b) a small shared recorded edge-clip set
  (generic steer-back, tool-failure line, plain re-ask — 3-5 clips reused everywhere), or
  (c) an explicit live-Cartesia exception class. Any of the three is fine; it must be WRITTEN.
- Template change: each exemplar's conversation/edge rows state the chosen modality (one
  phrase per row, or one global row all beats inherit).
- Guard scope: extend `audio-ownership-check` (or add a small check) to require every
  conversation branch `reply` and spoken edge behavior to resolve to clip | text-only |
  declared-live-exception. Mutation-test it once.
- If (b): record the clip set whenever; the CONTRACT can land now, audio later — the gate is
  on the wording, not the WAV files.

## 3. Should-fix (carry in the fill MR — all confirmed still open on d0cfb06e)

- **S1. Non-canonical gender vocabulary in category-women** — `beatsSource.ts` 1767, 1886,
  1959, 1975 still use `gender == woman` / "men, non-binary, undisclosed" while the locked
  enum (profile-asks tool spec, line ~941) is `"Male" | "Female" | "Other"`. category-women IS
  the women-variant template; the fill will copy this. Mechanical text swap.
- **S2. VoiceMode enum contradiction** — `beatsSource.ts:16` `'Verbatim' | 'Improvise' | null`
  vs the Bible's Verbatim/Generative, patched per-row with "(enum is Verbatim / Generative)"
  parentheticals (and goals-move's derived voice even says "reconciled from source Verbatim").
  Pick the machine enum, map `Improvise` once, drop the parentheticals.
- **S3. UI badge overclaims** — `FlowDesigner.tsx:1231` "Bible fill · 12 sections" and 1246
  "full contract" are static strings on a 14-key model, shown identically for variants whose
  sections are 100% derived. Compute from the resolved manifest.

## 4. Nice (pin in the fill brief)

- **N1. CI runs authoring mode + allow_failure: true on both jobs.** Correct for this phase;
  the flip conditions are documented in the CI comments, and the real release trigger
  (`--mode=release` + reconcile the 7 opener drifts, then `allow_failure: false`) should be a
  named step in the fill/release plan so it is not forgotten.
- **N2. Per-archetype {na} legality still TODO** (bible-registry-check header). Nothing stops
  a silent beat claiming `allowedTools: filled`. The 5 exemplars now span MP3/auto-advance
  (coach-greeting, with real `{na}` sections), silent/auth (sign-up), interactive data-gate
  (profile-asks, with a real `pending-app-reconcile` persistence), and selection beats — so
  the tri-state IS exercised by exemplars now; only the legality table is missing.
- **N3. Coverage phrasing slightly overstates.** The 50 "all-pending" beats resolve NO manifest
  object; the check counts them honestly but validates no sections for them (by design). Fine
  for authoring; worth an explicit release-mode rule later (no all-pending beats at release).
- **N4. Committed dist-flow can go stale vs source.** The live Pages surface serves committed
  `dist-flow/`; a source edit without rebuild leaves the deployed render + `/parity.json`
  stale with no guard. CI rebuilds fresh so CI is safe; consider a dist-freshness check or
  build-on-deploy so the live QA surface can't lie.

## 5. Checks run (raw results)

- `npx tsc --noEmit` — exit 0.
- `npm run check:beats` — all 12 guards PASS.
- `node scripts/bible-registry-check.mjs` — PASS, exit 0 (34 registry ids, 5 bibles, 62/62
  manifests, no leak, no false filled claim).
- `node scripts/bible-registry-check.mjs --mode=release` — FAIL, exit 1, 32 planned `eval:*`
  must-rule violations only (as designed).
- `npm run check:app-parity` — FAIL (report mode, expected): 7 real opener drifts, 8 app-only
  screenIds informational, 77/77 clips on disk.
- Mutations A (leak), B (filled-claim), C (second-source) — each forced exit 1 with the right
  error, each reverted clean.
- Live: page 200, `/parity.json` schemaVersion 2 / 62 beats / 10 keys, deployed bundle matches
  d0cfb06e (banned wording absent, fixed wording present x4).

## 6. Bottom line

The enforcement machinery is scale-grade and proven to bite on this exact commit. The one
thing that would multiply badly is the unowned voice modality of dynamic replies (F1'): decide
it, write it into the global layer + exemplars, extend the audio guard's scope, then fill.
S1-S3 ride in the same MR as planned. Everything else is release-phase work (CI flip, opener
reconciliation, qa-eval fleet), not fill-phase.
