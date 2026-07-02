# Fix report: fork live-advance failures (jump-to-end + answered-fork dead-end)

Branch `bugfix-loop2-resume`, MR !398. Follows the 2026-07-02 signed-in verification
batch (evidence `/tmp/gg-verify/L2-R1-matrix-*`, `L2-R2-advanced-*`; STATUS.md on
`bugfix-status-2026-07-02`).

## FAIL-A: full beginner run auto-passed the UNANSWERED fork and ran to the end

Verified live: after the reflection card tap, the next probe (3.5s) already showed
the into-app plan text and the weekly grid, with the fork radios empty; server row
ended `path=null, current_step=8` (L2-R1-matrix-end.png).

Root cause, two layers stacked:

1. Leading-edge climb race (orchestrator). Under V3 the persist steps are
   non-monotonic (1,6,7,8,2,3,4,5,5). The reflection save (step 8) is
   fire-and-forget: its current_step climb (7 to 8, optimistic or Realtime) lands
   AFTER the machine has moved to the branch node, so the fork's advance effect
   records a baseline of 7 and then sees 8: a genuine climb, and 8 is far past the
   fork's own step (2). It replayed the fork's server capture, which holds no path,
   as an empty capture.
2. Merge fallthrough (flow machine). `resolveNextNodeId` on a branch fell back to
   `mergeNodeId` when no lane matched, so that empty capture traversed the fork to
   into-app. The say-only tail (into-app + five weekly beats) then self-advanced to
   completion.

Fix, same two layers:

1. `captureCompletesBeat` gate before the live advance (kept byte-identical in
   semantics to MR !400's B21 gate so the branches merge clean): a persist-bearing
   beat only advances when the replayed capture carries its data (fork: its path).
   The once-per-beat latch is consumed only on a real advance, so a later, fuller
   row still advances the beat.
2. `applyCapture` / `resolveNextNodeId` now treat an unanswered branch as a HARD
   STOP (`undefined` = unresolvable, machine holds position, answers still merge).
   The merge fallthrough survives only behind an explicit `branchFallthrough`
   advance option, used solely by the QA `fastForwardToNode` walk so merge-side
   `?startAt` targets (into-app, weekly) stay reachable. Lane-side targets still
   stall at the fork here; MR !400's lane-aware walk composes with this flag.

## FAIL-B: answered fork "never advances into the lane"

Two distinct findings:

1. The reported tap-path wedge is a verification-harness artifact, not a product
   bug. The wire evidence shows the client advanced into the lane ~100ms after the
   tap: `[onboarding] form_submit (optimistic) ONBOARD-FORK`, the orchestrator form
   snapshot gaining `path: braindump`, and `/voice/onboarding/ONBOARD-ADVANCED.mp3`
   fetching immediately (L2-R2-advanced-wire.json); every "stuck" screenshot shows
   the advanced lane's opener and brain-dump textarea rendered and stable. The
   walker's `identifyBeat` matched the advanced beat by its textarea PLACEHOLDER
   text, which never appears in `document.body.innerText`, then fell through to the
   fork rule, which matched the still-visible past fork card's radio buttons, so it
   classified the page `path-fork` for the whole run and never typed into the
   textarea. Walker fix (out of app scope): match the brain-dump beat by the
   textarea's placeholder attribute or the `data-beat-active` tag !400 adds.
2. A real dead-end DID exist on the pure-voice path: Vapi's `submit_path_choice`
   runs server-side and writes the `path` column, but the GREATEST pin keeps
   `current_step` at 8, so no climb ever reaches the fork's leading-edge advance
   and the client would wedge at the fork. New effect in `useFlowOrchestrator`:
   at a branch node, advance on path EVIDENCE ARRIVAL (the row gains a lane value
   that was not there when the fork became active), no climb required. The entry
   baseline keeps a voice back-nav to an already-answered fork from being yanked
   forward by its own stale answer.

## Tests

`src/onboarding-flow/__tests__/liveAdvanceFork.test.ts` (new, flow-derived from the
generated V3 JSON): scripted live-advance run reproduces the race precondition
(row pinned at 8, no path, machine at the fork), asserts the gate refuses the empty
capture and the machine holds; both lanes enter on tap capture AND on server-row
path with no climb (the Vapi case); the full beginner run visits the whole lane
before the merge; `fastForwardToNode` still reaches merge-side targets and lands on
the branch node when targeted. `flowMachine.test.ts` updated to the new
branch contract. Refresh matrix + parity suites untouched and green:
tsc clean, 1379/1379.

## Conflict notes for the !400 merge

`useFlowOrchestrator.ts` is edited by both branches. `captureCompletesBeat` and the
gate placement are intentionally identical. !400's lane-aware `fastForwardToNode`
body supersedes this branch's; keep its lane seeding and add this branch's
`{ branchFallthrough: true }` option on its `applyCapture` call so merge-side
targets keep working against the hard-stop machine.
