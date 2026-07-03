# Context/AI-QA lane STATUS (Slot D)

Lane doc: gg-spec/docs/fable-lane-context-qa-2026-07-03.md. Branch: context-lane-status-2026-07-03.
Base at lane start: origin/staging 5750a2fb (merge train !398 !400 !401 !397 !403 !402 verified merged 2026-07-03).

MERGE HOLD in force: draft MRs only; nothing merges to staging until Yair clears the human walkthroughs.

| ID | Item | Status | MR |
|---|---|---|---|
| C1 | Context-chain audit (matrix skeleton) | DONE — matrix with 20 beat rows + mismatches M1–M9 (file:line evidence). Committed in gg-spec on branch context-qa-matrix-2026-07 (local, push blocked — see blockers) and mirrored at docs/qa/context-matrix-2026-07.md on this branch | gg-spec MR blocked |
| C2 | Anti-improvisation application | in progress | — |
| C3 | allowedTools codification | not started | — |
| C4 | Live QA matrix, text path | not started | — |
| C5 | Voice-parity spot pass (max 10 Vapi sessions) | not started | — |

## Ledger rows filed by this lane (for the central ledger)

- L-CTX-1 (from M1/M2/M3): Vapi lane consumes screens-era screen_contexts; BEGINNER-01/02 blocks instruct option-list narration; 11/20 flow screens missing from the bundle; no RULE 11 in scripts/vapi-sync/assistant.ts. Wording fixes = this lane (C2); the feed-mechanism decision (should the engine stop feeding screens-era blocks to Vapi where beat contexts exist?) = NEEDS-COORDINATION with anchor (OnboardingVoiceProvider is anchor territory).
- L-CTX-2 (from M4): persistStep collisions in the generated flow (state-check=6 AND reflection-setup=6; habit-schedule=5 duplicating habit-select) vs addendum step identities 6–8. Resume-by-step can land wrong. Lane 1 / anchor territory (builder step maps + resume walk). Evidence in the matrix doc.

## Blockers / notes

- 2026-07-03: push to gg-spec (branch context-qa-matrix-2026-07) + MR creation DENIED by the permission classifier (external-repo push). Not bypassed. The commit exists locally in gg-spec (4b959aa); the matrix is mirrored on THIS branch at docs/qa/context-matrix-2026-07.md. NEEDS-HUMAN: either push gg-spec branch context-qa-matrix-2026-07 + open the draft MR, or add a permission rule for gg-spec pushes. Will retry later per lane rules.

- 2026-07-03: frugal-fable skill install into ~/.claude/skills was DENIED by the Claude Code permission classifier (self-modification rule). Not bypassed. Session follows the skill's rules from the gg-spec copy directly (read in full); budget-capped workflows can run via scriptPath into gg-spec. NEEDS-YAIR only if he wants the skill installed machine-wide.
- Main checkout is dirty on feat/onboarding-voice-track1 (uncommitted track-1 voice edits, not mine). All lane work happens in worktrees under /Users/jonah/Documents/gg-mvp-worktrees/; main checkout untouched.
- Usage at lane start: 44% Fable weekly. Stop opening new work at 60%.
