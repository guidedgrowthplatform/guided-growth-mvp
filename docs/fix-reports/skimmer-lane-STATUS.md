# Live-skimmer lane — STATUS

Lane doc: gg-spec/docs/fable-lane-live-skimmer-2026-07-04.md (parent: fable-window-plan-2026-07-03.md).
Closes: B26 (advanced path never consults the LLM, renders raw text fragments as habit names).
Status branch: skimmer-lane-status-2026-07-04 (docs-only, never merged until the end).

## LAUNCH GATE: NOT MET (checked 2026-07-04)

Gate: builder-lane bug bundle B32–B35 merged into the integration branch before this lane forks.

- B32 (no advanced-lane step ladder in systemPromptAddendum.ts; coordinate with !411): NO MR exists. !411 (derive step maps, L1-3) is open, PARKED, awaiting review.
- B33 (MAX_HABITS=2 silently drops the advanced 3rd habit; NEEDS-YAIR on the cap): NO MR exists.
- B34 (addendum SPECIAL CASE collects schedule on BEGINNER-03 vs the separate BEGINNER-04 beat): NO MR exists.
- B35 (dynamic replies never spoken in voice mode; carried as B39 in the central numbering): draft !425 OPEN, not merged.

B32–B34 definitions verified in the context lane's ledger (docs/fix-reports/context-lane-STATUS.md on
context-lane-status-2026-07-03, C4/C5 sections). No branch fork, no code work until the bundle lands.
This lane re-checks the gate on a ~30-minute cadence and does read-only prep meanwhile.

## ENVIRONMENT CHANGE the plan did not anticipate

`staging` NO LONGER EXISTS on origin. !427 "Release: staging to main" merged (main tip 5df99b72) and the
staging branch was deleted with it. Project default branch is `main`.

- Consequence for this lane: "branch off CURRENT origin/staging" becomes "branch off CURRENT origin/main"
  unless the conductor recreates staging.
- FLAG FOR CONDUCTOR: open MRs !425 (B39) and !426 (parser queue X1–X4) still target the deleted
  `staging` branch — they cannot merge until retargeted (or staging is recreated). Not this lane's call.

## Work ledger

| ID | Item | Status | MR |
|---|---|---|---|
| S1 | Port the skimmer core (BrainDumpCapture.tsx, useBrainDumpCapture, parseBrainDumpRegex.ts + regex unit tests, drop sim fallback) | BLOCKED (gate + port source, see blockers) | |
| S2 | Register + schema (ADAPTER_REGISTRY advanced-capture → BrainDumpCapture; per-habit days/polarity in the capture contract; replay renders cards) | open, gated | |
| S3 | Voice-in + reconcile verification (interim STT hookup; ~1s/clause card formation; LLM refine after pauses; typed parity) | open, gated | |
| S4 | Preview proof + B26 closure (phone viewport, spoken + typed dumps, edits/deletes survive reconcile, replay after refresh) | open, gated | |
| S5 | Daily-reporting scoping note (phase 2 stub, no code) | open — not gated, can be written during the hold | |

## Blockers

1. **NEEDS-HUMAN (Yair): the port source is not reachable from this machine.** The skimmer v1 lives at
   `/Users/yairamsel/Developer/ggmvp-skimmer` (per docs/live-capture-surfaces-2026-06-27.md), branch
   feat/capture-real-beat @ e0000659 (feat/live-skimmer is an ancestor). That commit was never pushed
   (GitLab API: 404) and improvement-plan-2026-07-02.md item 11 records the checkout carries UNCOMMITTED
   work. Ask: commit + push feat/capture-real-beat (or hand over BrainDumpCapture.tsx,
   useBrainDumpCapture.ts, parseBrainDumpRegex.ts). Fallback if unavailable: reimplement from the survey's
   architecture spec (two-tier parse, 450ms debounce, Map + order array + override maps + deleted-set) —
   worse fidelity, lane doc prefers a port.
2. Launch gate (above): B32–B35 not merged; B33 additionally NEEDS-YAIR on the intended advanced cap.

## Read-only prep findings (verified on origin/main @ 5df99b72)

- `/api/llm/parse-brain-dump` live: route in api/llm/[...path].ts:135 → api/_lib/llm/parseBrainDump.ts;
  client wrapper src/api/parseHabits.ts. Survey gap item 6 confirmed.
- ADAPTER_REGISTRY (src/onboarding-flow/renderer/componentRegistry.tsx:1744) is `satisfies
  Record<FlowComponentType, ...>` — the typed-registry safety net from !410 is in; swapping
  `'advanced-capture': BrainDumpAdapter` (plain textarea card) to the ported component is the S2 edit
  point, and FROZEN_BY_TYPE will demand an explicit freeze decision for the new card.
- Capture contract today persists only `brainDumpText` (designer-source.json:658 captureFields; generated
  flow; stepMapParity/serverCaptureForBeat/resumeFromServerRow tests). The S2 schema gap is real and the
  tests to update through authored sources + flow:sync are identified.
- `useVoiceInCapture` exists on main (src/contexts/OnboardingVoiceProvider.tsx + hook tests) — S3's
  expected interim-STT feed is present; gating flag check still to do at fork time.
- Landmines re-confirmed current: useLiveSkimmer/liveSkimmer ghost-fill is a separate system (do not
  conflate); parseHabitsFromText stays untouched; flow-designer LiveScan preview out of scope.

## Usage / discipline

- Ultracode OFF confirmed. frugal-fable vendored skill installed to ~/.claude/skills/frugal-fable from
  gg-spec origin/main (SKILL.md inspected before install).
- Weekly-cap telemetry is not readable from inside the session; operator's usage pill is authoritative.
  Standing rule honored: at 60% stop opening new work, finish review-ready, snapshot, pause.
- Main checkout (/Users/jonah/Documents/guided-growth-mvp) is on feat/onboarding-voice-track1 with
  uncommitted changes belonging to another session — this lane works only in its own worktrees.

Updated: 2026-07-04 — lane bootstrapped; gate checked NOT MET; port-source blocker filed; re-check loop armed.
