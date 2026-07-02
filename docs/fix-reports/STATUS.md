# Onboarding bugfix status — plan of 2026-07-02

Source ledger: `gg-spec/docs/onboarding-bugfix-plan-2026-07-02.md`. One row per bug ID.
Statuses: `open` / `in-progress` / `solved` / `blocked` / `merged-into-other`.
Updated the moment a status changes; this branch (`bugfix-status-2026-07-02`) is the single source of truth.

| ID | Bug | Loop | Status | MR | Notes |
|---|---|---|---|---|---|
| B1 | QA control: "Full onboarding" didn't start from beginning | 6 | partially solved | — | c8f85490 one-tap-fresh verified live 2026-07-02; remainder = QA screen audit (Loop 6) + downstream B17/B9 |
| B2 | Coach voice toggle OFF after refresh; must start ON | 2 | open | — | |
| B3 | Cartesia opener silent while captions render | 1 | open | — | |
| B4 | MP3 clips don't play; dead air + long LLM think after path answer | 1 | open | — | absorbs former B13 |
| B5 | Age + gender prompts merged into one bubble | 4 | open | — | |
| B6 | Chat bubbles disappear randomly | 4 | open | — | |
| B7 | Profile card disappears after age + gender given | 4 | open | — | |
| B8 | "You're signed in" banner shows during onboarding | 2 | open | — | |
| B9 | Refresh mid-onboarding lands on wrong component + injects extras | 2 | open | — | live repro 2026-07-02 pm: refresh while stuck on habit-selection jumped 5 beats to weekly projection, no components rendered; MUST be a Loop 2 verification-matrix case |
| B10 | Flow jumped welcome → profile, skipping in-between beat | 2 | open | — | |
| B11 | LLM calls fail repeatedly; flow wedged at habit render | 3 | open | — | |
| B12 | LLM invents process talk ("confirm your path choice") | 3 | open | — | likely falls out of Loop 2 map fix |
| B13 | (folded into B4) | — | merged-into-other | — | |
| B14 | First spoken word cut off at clip start | 1 | open | — | |
| B15 | Clips not pre-buffered; start rides the network | 1 | open | — | |
| B16 | Mic not armed early / not opened at clip end | 5 | open | — | needs Loops 1+2 |
| B17 | QA "Restart fresh" renders old chat thread (client cache not cleared) | 4 | open | — | root cause verified: QAControlScreen restart path never clears thread store |
| B18 | Recurring staging build error re-merged by diverged branches | — | tracked-elsewhere | — | handled separately; Loop 3 rules it out before B11 |
| B19 | Loading bubble renders/sticks on some beats when loading transcript/components | 4 | open | — | live QA walkthrough 2026-07-02 pm |
| B20 | Voice check-in save acked by coach, but card never updates and next beat never loads | 2 | open | — | confirms the record_checkin/submit_morning_checkin wiring gap already in Loop 2 scope |
| B21 | Completed subcategory beat removed from timeline; habit-selection + habit-schedule render simultaneously | 4 | open | — | removal = B6/B7 unmount class; double-render its own sequencing defect |

## Loop status

| Loop | Scope | Status | Branch | MR |
|---|---|---|---|---|
| 0 | Prior-fix archaeology | done | bugfix-status-2026-07-02 (docs/prior-fixes/) | — |
| 1 | B3 B4 B14 B15 | in-progress | — | — |
| 2 | B9 B10 B2 B8 | pending | — | — |
| 3 | B11 B12 | pending | — | — |
| 4 | B5 B6 B7 B17 | pending | — | — |
| 5 | B16 | pending (stacks on 1+2) | — | — |
| 6 | B1 remainder | pending | — | — |

## Blockers

_None yet._
