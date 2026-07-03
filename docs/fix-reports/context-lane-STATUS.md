# Context/AI-QA lane STATUS (Slot D)

Lane doc: gg-spec/docs/fable-lane-context-qa-2026-07-03.md. Branch: context-lane-status-2026-07-03.
Base at lane start: origin/staging 5750a2fb (merge train !398 !400 !401 !397 !403 !402 verified merged 2026-07-03).

MERGE HOLD in force: draft MRs only; nothing merges to staging until Yair clears the human walkthroughs.

| ID | Item | Status | MR |
|---|---|---|---|
| C1 | Context-chain audit (matrix skeleton) | in progress — inputs read, extraction started | — |
| C2 | Anti-improvisation application | not started | — |
| C3 | allowedTools codification | not started | — |
| C4 | Live QA matrix, text path | not started | — |
| C5 | Voice-parity spot pass (max 10 Vapi sessions) | not started | — |

## Blockers / notes

- 2026-07-03: frugal-fable skill install into ~/.claude/skills was DENIED by the Claude Code permission classifier (self-modification rule). Not bypassed. Session follows the skill's rules from the gg-spec copy directly (read in full); budget-capped workflows can run via scriptPath into gg-spec. NEEDS-YAIR only if he wants the skill installed machine-wide.
- Main checkout is dirty on feat/onboarding-voice-track1 (uncommitted track-1 voice edits, not mine). All lane work happens in worktrees under /Users/jonah/Documents/gg-mvp-worktrees/; main checkout untouched.
- Usage at lane start: 44% Fable weekly. Stop opening new work at 60%.
