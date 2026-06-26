# STEP-0 — Canonical Onboarding Step Table (static derivation)

> Derived 2026-06-27 by static analysis of the merged `vapi-integration` tree.
> This is the single source of truth that B1 (`checkAdvanceData` remap), C2 (RULE-2
> target_step maps), B5 (`confirm_plan` directive), and B6 (step-5 collision) all
> build on. **The beginner spine below is derived deterministically and is high
> confidence. The advanced lane and the +2 skip-guard interactions are flagged as
> requiring a live instrumented run before the shared guard is flipped** — that
> guard is shared with the live Direct-LLM path (see "Live-users risk").

## How the numbers are forced

Two independent mechanisms must agree on the server `current_step`:

1. **Frontend leading-edge** (`useFlowOrchestrator.ts:225-269`): beat `B` advances when
   `serverStep > beatStep(B)` **and** `serverStep > entryBaseline(B)`, where
   `entryBaseline(B)` is the server step observed when `B` became active.
   `beatStep` = `persist.step`, or `ENGINE_PERSISTLESS_STEP` (only `ONBOARD-BEGINNER-06 → 6`),
   or `undefined` for the terminal `ONBOARD-COMPLETE`.
2. **Backend `navigate_next`** (`navigateNext.ts`): writes `current_step = target_step`
   (no GREATEST), rejects `target > current+2`, and on `target = current+1` calls
   `checkAdvanceData(sourceStep=current)` which must return `null` (data present).

Let `L(B)` = the `target_step` the coach emits to LEAVE beat `B`. The entry server
step of `B` equals `L(prev)`. The leading-edge rule forces:

```
L(B) > max(beatStep(B), L(prev))   →   L is strictly increasing and clears each beatStep
```

The `beatStep` sequence along the merged beginner chain is
`1, 2, 3, 4, 5, 5, 6, 7, 8, (terminal)` — note **two consecutive 5s** (habit-select +
habit-schedule) and the **persist-less 6** (plan-cards). Solving the recurrence:

## The canonical beginner spine

| beat           | screenId                | engine `beatStep` | enters at `current_step` | leaves via `navigate_next(target=)` | `checkAdvanceData(source)` must require                     |
| -------------- | ----------------------- | ----------------- | ------------------------ | ----------------------------------- | ----------------------------------------------------------- |
| profile        | `ONBOARD-01--FORM`      | 1                 | 1                        | **2**                               | case 1: `nickname` ✅ today                                 |
| fork           | `ONBOARD-FORK--FORM`    | 2                 | 2                        | **3**                               | case 2: `path` ✅ today                                     |
| category       | `ONBOARD-BEGINNER-01`   | 3                 | 3                        | **4**                               | case 3: category/braindump ✅ today                         |
| goals          | `ONBOARD-BEGINNER-02`   | 4                 | 4                        | **5**                               | case 4: `goals` ✅ today                                    |
| habit-select   | `ONBOARD-BEGINNER-03`   | 5                 | 5                        | **6**                               | case 5: `habitConfigs` ✅ today                             |
| habit-schedule | `ONBOARD-BEGINNER-04`   | 5                 | 6                        | **7**                               | case 6: **CHANGE → `habitConfigs`** (today = reflection ❌) |
| plan-review    | `ONBOARD-BEGINNER-06`   | 6 (engine-local)  | 7                        | **8**                               | case 7: pass-through `null` (review beat, no new data)      |
| morning        | `ONBOARD-MORNING-SETUP` | 7                 | 8                        | **9**                               | case 8: **NEW → `morningCheckin`** (today = `null` ❌)      |
| reflection     | `ONBOARD-BEGINNER-07`   | 8                 | 9                        | **10**                              | case 9: **NEW → `reflectionConfig`** (today = `null` ❌)    |
| complete       | `ONBOARD-COMPLETE`      | terminal          | 10                       | `confirm_plan` (not navigate)       | `checkPlanReady` (habits + reflection)                      |

The walk is `current_step: 1→2→3→4→5→6→7→8→9→10`, every advance a clean `+1`, peaking
at `MAX_STEP=10` (`navigateNext.ts:38`) — exactly at the ceiling, no headroom change needed.

## The required `checkAdvanceData` remap (B1)

`preconditions.ts` cases were built for the OLD tail (`reflection=6`, `plan=7`). For the
resync tail they must become:

| sourceStep | OLD gate              | NEW gate (this flow)                                        |
| ---------- | --------------------- | ----------------------------------------------------------- |
| 1          | nickname              | nickname (unchanged)                                        |
| 2          | path                  | path (unchanged)                                            |
| 3          | category OR braindump | unchanged                                                   |
| 4          | goals                 | goals (unchanged)                                           |
| 5          | habitConfigs          | habitConfigs (unchanged)                                    |
| **6**      | **reflectionConfig**  | **`habitConfigs`** (leaving habit-schedule, not reflection) |
| **7**      | default `null`        | `null` pass-through (leaving plan-review)                   |
| **8**      | default `null`        | **`morningCheckin`** (leaving morning)                      |
| **9**      | default `null`        | **`reflectionConfig`** (leaving reflection)                 |
| ≥10        | `null`                | `null`                                                      |

Because every happy-path advance is `+1`, the `+2` skip-guard loop
(`navigateNext.ts:119-130`) never fires on the beginner spine — but a tap/voice
catch-up could, so the gates above must be correct at every source step, not just the
ones the LLM normally emits.

## The required RULE-2 / target_step map updates (C2 — both files, identical numbering)

Both prompt maps currently stop at `reflection(6)→7` and omit the new beats. They must
become the table above. Files:

- **Direct-LLM:** `api/_lib/llm/onboarding/systemPromptAddendum.ts:11` (the
  `profile(1)→2 … reflection(6)→7` line) + line 7 (PLAN REVIEW screen id).
- **Vapi:** `scripts/vapi-sync/assistant.ts:46-58` RULE-2 table (add `ONBOARD-BEGINNER-04`,
  `ONBOARD-MORNING-SETUP`; fix `ONBOARD-BEGINNER-07` from "step 6" to step 9-leave),
  plus the worked examples at `:150-265` that hardcode `navigate_next(target_step=6/7)`.
- **navigate_next tool description:** `api/_lib/llm/tools.onboarding.ts` (the
  `step-5 (habits) → 6, step-6 (reflection) → 7` map inside the `navigate_next` def).

**B1 and C2 must use identical numbering** — they are one atomic change. Splitting them
reintroduces the off-by-one that strands the tail.

## B5 — `confirm_plan` directive (`api/_lib/vapi/handlers/confirmPlan.ts`)

Its coach-facing recovery text says "until current_step is 7"; on this flow plan-review is
entered at `current_step=7` and COMPLETE at `10`. Update the directive text to the table
above. The completion write itself (terminal `nextId:null` → engine `status='complete'`)
is unchanged; `checkPlanReady` (habits + reflection) stays correct.

## Live-users risk (why this is gated, not auto-applied)

`checkAdvanceData` is **shared**: `navigateNext.ts:34` imports it (the
`preconditions.ts:1-2` "Vapi path left untouched" comment is **stale** — verified). So the
B1 remap changes gating for **every** onboarding user on BOTH paths the moment it deploys.
It deploys atomically with the new flow (both are on this branch), so there's no
old-flow/new-guard mismatch — but a _wrong_ remap breaks onboarding for everyone. Hence:
confirm with a live instrumented run before flipping it.

## Open items requiring a live instrumented run (do NOT hand-assert)

1. **Advanced lane.** `ONBOARD-ADVANCED` (brain-dump, `beatStep=3`) merges directly to
   `ONBOARD-BEGINNER-06` (`beatStep=6`), skipping category/goals/habits. A jump from
   `current_step=3` toward plan-review would exceed the `+2` skip-guard. The advanced
   lane's server-step climb and its `checkAdvanceData` path need an instrumented advanced
   run to lock — the beginner table above does NOT cover it.
2. **Two-navigate cascade for the shared step-5.** habit-select and habit-schedule both
   `beatStep=5`; the engine needs the coach to emit `navigate_next(6)` then `(7)` across
   the two beats. Confirm the LLM actually emits two distinct advances rather than one
   `(6)` that strands habit-schedule.
3. **`+2` catch-up after a tap.** A tap into a screen doesn't bump `current_step`, so a
   following voice advance can land `+2`; confirm the gate loop accepts the legitimate
   catch-ups across the new tail.

## How to run STEP-0 (the live trace)

`VITE_ONBOARDING_USE_ENGINE=true`, `/onboarding/flow`, a fresh `qa-onboarding` reset, drive
a full **Direct-LLM** (`advance_step`) walk through COMPLETE on both beginner and advanced
lanes, and log per beat: entry `current_step`, emitted `target_step`, `sourceStep` passed to
`checkAdvanceData`, and the data precondition present. Reconcile against this table; the
beginner spine should match exactly. Then implement B1+C2 atomically and re-run on both paths
and both engines.
