# Whole-system onboarding QA re-run — integrated build

Date: 2026-07-10. Reviewer: Fable (adversarial re-QA on the integrated swarm build).
Artifact: `swarm/integrate` at `5ab47983`, worktree `~/Developer/claude-work/swarm-integrate`,
based on `trial/rebase-531` (`7ff51254`). Preview:
https://swarm-integrate.gg-onboarding-render.pages.dev
Grounding read in full: the NOT-READY gate (`gg-spec/docs/whole-system-onboarding-qa-2026-07-10.md`),
the beat-13 re-QA (`gg-status/scratch/re-qa-beat13.md`), the Bible spec/gap audit
(`render-bible-spec-and-gap-audit-2026-07-09.md`). All checks below were run by me on the
integrated worktree, not taken from the integration report.

## VERDICT: SCALE-WITH-CHANGES

The integration genuinely closed the machinery blockers. Every structural blocker from the
NOT-READY report (B1, B3, B4, B5) plus B1 from the beat-13 re-QA is closed AND proven to bite
by mutation test. The enforceability model is real now, not prose: I neutered the variant
substitution and the leak guard failed the build; I forced a bogus `filled` claim and the
coverage guard failed the build; I re-introduced a retired field into `beatMetadata.ts` and the
reconcile guard failed the build. The two-mode gate works (authoring passes, release fails on
the informative fleet-eval gap only). CI runs the guards. This is a different, scale-safe
artifact.

ONE blocking item survived integration untouched, and it is the SAME item both prior gates
ranked as a top blocker: the `category-women` exemplar still encodes the banned silent
tool-failure. Because exemplars are the copy template the 40+ fill clones, this one row must be
fixed before the fill runs, or it multiplies. It is a one-row content fix, not a machinery gap.
Hence SCALE-WITH-CHANGES, not NOT-READY (the machinery is ready) and not SCALE-READY (the
template still carries a contract-loosening edge).

---

## Re-check of every prior blocker

| Blocker (source) | Prior | Now | How I verified |
|---|---|---|---|
| B1 variant inheritance marks wrong category facts (NOT-READY B1 / re-qa B1) | FAIL / PARTIAL | **CLOSED** | Resolver now derives `components` (tiles from `goalsByCategory[props.category]`) and `voice` (clips from the beat's own `script`) fresh, and runs every other inherited section through `variantSubstitutions` (head category label, tile-count phrase, clip ids, screenId, rule-prefix, beatId all rewritten). Leak guard scans the resolver's ACTUAL output per derived section. Mutation test A (below) proves it bites. |
| B2 contract gate is opt-in, 60 beats uncontracted (NOT-READY B2) | FAIL | **CLOSED** | `bible-registry-check.mjs` coverage phase: all 62 beats resolve a manifest (4 owner-filled, 8 derived-variant, 50 all-pending). No beat silently skipped; every one of 14 keys must be owner-filled / derived / `pending-app-reconcile` / `{na}`. |
| B3 "every rule names an enforcer" is not enforceability (NOT-READY B3) | FAIL | **CLOSED** | 8 static enforcers built under `scripts/checks/` + wired into `check:beats`. Two-mode gate: `--mode=release` FAILS with 32 must-rule violations, all citing `eval:*` qa-eval enforcers still planned; zero static checks unbuilt. Authoring mode passes. |
| B4 parity not wired to CI, too thin to test behavior (NOT-READY B4) | FAIL | **CLOSED (report mode)** | `.gitlab-ci.yml` now has `render_guards` (bible-registry + render + links + check:beats) and `render_app_parity` (build:flow + check:app-parity), both `allow_failure: true`. `check:app-parity` compares opener copy, clip-on-disk, and order across render vs three app-consumed inputs; parity.json is schema v2 with 10 keys (was 4). |
| B5 second live consumer can overwrite render-owned data (NOT-READY B5) | FAIL | **CLOSED** | The 4 behavioral fields (voiceEngine/voiceMode/allowedTools/expectedResponse) retired from `beatMetadata.ts`; generator `gen_beat_metadata.py` no longer emits them; `FlowBuilder.withRenderFacts` live-reads them from `BEAT_BY_SCREEN_ID`; `beat-metadata-reconcile-check.mjs` bans their return. Mutation test C proves it bites. |
| **B6 / re-qa B2 category-women silent tool-failure** | FAIL / BLOCKING | **NOT FIXED (blocking)** | `beatsSource.ts:1906` (inside category-women, id@1603, next beat goals-sleep@2065) still reads: `submit_category errors: stay on the beat, do not narrate the failure, let the user pick again`. This is the exact silent failure the global TOOL_FAILURE contract bans. goals-sleep (2397) and profile-asks (1031) carry the approved wording; category-women was never reconciled. |

---

## Mutation tests (proof the guards actually bite — requirement #7)

All three reverted; worktree confirmed clean (`git diff --quiet`) after each.

- **Test A — leak guard.** Neutered `variantSubstitutions` to return `[]` (forcing shallow-copy).
  `bible-registry-check.mjs` FAILED with per-section leak errors on goals-move, goals-eat, and
  every goals variant, e.g. `goals-move: derived section 'contextProse' leaks head token
  "Sleep better" from goals-sleep`, `voice ... leaks "onboard_beginner_02_sleep"`. With
  substitution active (real state) it passes clean. This is the "deliberately-wrong variant must
  fail" proof the gate demanded.
- **Test B — filled-claim guard.** Forced `deriveVariantManifest` to mark every section `filled`.
  FAILED: `goals-move: manifest.identity claims 'filled' but the beat does not own that section
  (a variant may only inherit as 'derived', never claim authorship)` across all keys.
- **Test C — second-source reconcile guard.** Re-added `voiceEngine` to a `beatMetadata.ts`
  entry. FAILED: `carries retired field "voiceEngine" -- reintroducing it here reopens the
  second-source drift`.

## Guard suite results (run by me on 5ab47983)

- `npx tsc --noEmit` — PASS (exit 0).
- `check:beats` (all 12 guards) — PASS. id-alias (62 unique), reveal-timing (5 bibles),
  component-registry, audio-ownership (perLine covers every spoken seq), tool-contract,
  advance-gate, persistence-contract, decisions-coverage, plus render/links/rules-registry/
  beat-metadata all green.
- `bible-registry-check.mjs` authoring — PASS: 34 registry ids, 5 authored bibles, 62 beats
  resolve a manifest, no head-token leak, no non-owned filled claim.
- `bible-registry-check.mjs --mode=release` — FAILS as designed: 32 must-rule violations, all
  `eval:*` qa-eval (parity-walk, invalid-value-redirect, out-of-scope-decline, no-machinery-
  words, carry-forward, silent-after-pick, ack-each-habit, verbatim-opener, one-line-then-wait,
  no-read-options, no-contrarian, no-platitudes, single-select, brainstorm-then-yield,
  warm-opener, selection-cap). Zero static checks remain unbuilt.
- `check:app-parity` — FAIL (report mode, expected): 0 matched / 7 opener mismatches / 8
  app-only screenIds informational; audio 77 clip refs, 0 missing on disk.
- Preview `/parity.json` — serves schemaVersion 2, 62 beats, keys
  `index,id,order,screenId,variantOf,path,voiceEngine,voiceMode,opener,clips`.

## The 7 required areas + B1/B2

1. **render-as-permanent-source / second source (B5)** — CLOSED + proven (Test C).
2. **contract coverage across all 62 beats (B2)** — CLOSED; coverage phase enforces a manifest
   on every beat.
3. **variant inheritance no longer marks wrong category facts, verified on goals-move (B1)** —
   CLOSED; derived-fresh + substituted, leak guard proven (Test A). goals-move resolves its own
   MOVE clip / move category, no residual Sleep token in derived sections.
4. **enforceability + authoring-vs-scale gate modes (B3)** — CLOSED; 8 static enforcers built,
   release mode fails on the qa-eval gap only.
5. **parity wired to CI + tests behavior (B4)** — CLOSED report-mode; app-parity tests opener
   copy + clip existence + order, correctly fails on real render/app drift.
6. **uniform sections + 3 new exemplars** — DONE. The 3 new authored bibles are coach-greeting,
   sign-up, profile-asks (added to the original category-women + goals-sleep = 5). They span
   distinct archetypes (MP3/auto-advance, silent/auth, interactive data-gate).
7. **leak guard actually fails a wrong variant** — PROVEN (Test A).

---

## Findings, ranked

### BLOCKING (must land before the 40+ fill)

**F1. category-women exemplar still encodes the banned silent tool-failure.**
Location: `src/components/flow-designer/beatsSource.ts:1906` (category-women beat, id@1603).
Current: `submit_category errors: stay on the beat, do not narrate the failure, let the user
pick again`.
Fix: replace with the Yair-approved contract already used verbatim on goals-sleep (2397) and
profile-asks (1031): silent retry once; if it still fails SURFACE it, never advance; tap/text
path toast "Couldn't save that, tap to retry" with the selection retained; voice path one line
"That didn't go through, let me try again." One row. Exemplars are the fill's copy template, so
this multiplies into every category/goal fill if left. Both prior gates ranked this a top
blocker; it was not touched by the integration.

### SHOULD-FIX (ride-along in the fill MR, cheap)

**S1. Non-canonical gender vocabulary in category-women.** `beatsSource.ts` ~1767/1886/1959/1975
(rule `catw-women-variant`, flow.upstream, acceptance) use `gender == woman` / "men,
non-binary, undisclosed". CANONICAL_ENUMS locked Female/Male/Other with
`gender === 'Female'` as the only women-art selector. Mechanical text swap in the rule + flow +
acceptance rows; the beat that IS decision-3's render side should speak the locked enum.

**S2. VoiceMode type still contradicts the Bible vocabulary.** `beatsSource.ts:16`
`VoiceMode = 'Verbatim' | 'Improvise' | null`, while every voice row carries the awkward
"(enum is Verbatim / Generative)" parenthetical (395, 902, 1690, 2163). Pick one machine enum
(Verbatim/Generative), map legacy `Improvise` once, drop the parenthetical, enforce in the
source check.

**S3. UI badge overclaims contract completeness.** `FlowDesigner.tsx:1231` renders
"Bible fill · 12 sections" and 1246 "full contract" as static strings for any bible-bearing
beat, including variants whose sections are all derived and a 14-key model. Compute the badge
from the resolved manifest (e.g. "14 filled" / "12 filled · 2 derived") and settle the 12-vs-14
count in one place. Cosmetic but it is on the QA surface reviewers trust.

### NICE (pin in the fill brief, not gating)

**N1. Release mode is built but not wired to CI.** `render_guards` runs `bible-registry-check`
in authoring mode only. That is correct for the authoring phase; name `--mode=release` as the
explicit release trigger (flip when the qa-eval fleet lands) so it is not forgotten.

**N2. Per-archetype legality still a declared TODO** (`bible-registry-check` header). Nothing yet
stops a silent beat marking `allowedTools: filled` or a multi-turn beat marking
`conversation: {na}`. Acceptable for this gate only if the fill brief pins the archetype table
and the guard grows it in the fill's first slice.

**N3. No exemplar exercises `{na}` or `pending-app-reconcile` at the manifest level.** The
tri-state ships untested by the template; fill one silent/MP3-only beat (e.g. weekly-gaps) as a
third status exemplar before the 40 copies.

**N4. Both parity/guard CI jobs are `allow_failure: true` (report mode).** Correct while opener
drift is unreconciled, but the flip-to-blocking is the real release gate: reconcile the 7 opener
mismatches, prove a deliberately-wrong change fails, then set `allow_failure: false`.

---

## Bottom line for the conductor

The machinery gate is passed: scale is safe to turn ON because a wrong variant, a missing
contract, a bogus filled claim, and a resurrected second source all now fail a real check that I
proved bites. Land F1 (one row) before the fill starts; carry S1-S3 in the same MR; pin N1-N4 in
the fill brief. Do not flip the CI parity/guard jobs to blocking until the opener drift is
reconciled and release mode is wired.
