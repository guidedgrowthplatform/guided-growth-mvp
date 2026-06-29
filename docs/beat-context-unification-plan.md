# Beat-context unification — one source feeds every path

_Planned 2026-06-28 (Yonas). Builds on `beat-context-sync-plan.md` (the sync is live)._

## Goal

Make the **synced beat-context** (`onboarding_globals` + `beat_contexts` → `beatContexts.ts`
/ `beatContexts.generated.json`) the **single source** that feeds onboarding context to
**every** runtime path — Direct-LLM, Vapi cold-start, and the Vapi per-beat heartbeat —
and **retire the old onboarding path** (the `screen_contexts` bundle/table + the
dashboard-only Vapi global). One edit in the Sheet → every path sees it.

## Where each path stands today (grounded)

| Path | Per-beat context | Global / persona | On synced source? |
|---|---|---|---|
| **Direct-LLM (3)** | `getBeatContext` (`buildSystemPrompt.ts:118`) | `GLOBAL_ONBOARDING_CONTEXT` (`:119`) | ✅ yes |
| **Vapi cold-start (1)** | `getScreenContext`→`screen_contexts.json` bundle (`buildAssistantOverrides.ts:61`) | — none sent | ❌ old bundle |
| **Vapi heartbeat (1)** | `pushScreenContext`→`getScreenContext` (`OnboardingVoiceProvider.tsx:297,1467`) `client.send(add-message)` | — | ❌ old bundle |
| **Vapi global** | — | **Vapi dashboard only** (drifts); code syncs only the tool-rules addendum (`vapi-sync/assistant.ts`) | ❌ not code |
| **get_user_context tool** | `SELECT … FROM screen_contexts` (`tools.ts:168`) | — | ❌ old table |

Shared renderer `buildContextMessage` (packages/shared) is used by BOTH paths — **keep it.**

## The structural problem to solve first

`beatContexts.ts` + `beatContexts.generated.json` live under `api/` (backend, Node). The
Vapi context path is **frontend** (`src/contexts/OnboardingVoiceProvider.tsx`,
`src/lib/context/getScreenContext.ts`). The frontend can't import the backend module. So
unification needs a **frontend-accessible beat bundle** — the same way `screen_contexts.json`
is the frontend bundle today.

## GROUNDED FINDINGS (2026-06-28, before building)

1. **WS3 is moot.** `get_user_context` is dead for onboarding — filtered out of Direct-LLM
   (`api/llm/[...path].ts:40`), absent from the Vapi prod lock, and the addendum tells the
   coach it's unavailable. Drop it from this effort (cleanup-only later).
2. **Vapi tool-gating is PROSE, not structural.** `buildAssistantOverrides.ts` only sets
   `firstMessageMode` + `variableValues.initial_screen_context` — the assistant always
   exposes its full tool set. The per-beat `ALLOWED`/`FORBIDDEN` lists + `navigate_next(target_step=N)`
   live INSIDE the `screen_contexts` block and are load-bearing. So removing `screen_contexts`
   for onboarding means **regenerating that machinery** for Vapi.
3. **The old machinery is messy — replace, don't reproduce.** Extracted from
   `screen_contexts.json`: several beats (`ONBOARD-01--FORM`, `BEGINNER-06`, all `ADVANCED-*`)
   have no machinery at all; it includes legacy non-v2 screens (`BEGINNER-08/09`, `ADVANCED-03`);
   it's old-order and hand-authored in the Screens tab.
4. **The engine code is the authority.** `beatForStep`/`stepForScreenId` (`src/lib/onboarding/
   onboardingStepBeats.ts`) gives target_step; `getBeatAllowedTools` (`beatContexts.ts`) gives
   the allowed set. Generate the machinery from these → engine-consistent, deterministic.

### Refined WS1 — compose, don't swap
Vapi onboarding context block = **[code-generated machinery] + [synced coach copy]**:
- **Machinery** (code, engine-consistent): `ALLOWED TOOLS` (data tools + `navigate_next(target_step=stepForScreenId+1)`), `FORBIDDEN` = all onboarding tools − allowed, AUTO-CALL hint. Translates the beat's `advance_step` → Vapi's `navigate_next`.
- **Coach copy** (synced Sheet): the clean beat `context` + `opener`.
- Clean separation also dodges the order-desync: machinery follows the engine (code), copy follows the Sheet.

## WS1 FINALIZED — Vapi flipped onto the unified source (2026-06-28)

Per Yonas: order authority = the flow builder; habits (03/04/05) = one step;
"give Vapi everything, integrate correctly." Done:

- **Machinery is flow-derived.** `build-beat-bundle.ts` now reads `step`/`target_step`
  from `onboarding-beginner-v1.generated.json` (`persist.step ?? ENGINE_PERSISTLESS_STEP`,
  target = next node's step skipping same-step nodes). Habit beats (both step 5) → target 6
  (plan-review). Tail follows the flow: 06→7 (morning), morning→8, 07→9, COMPLETE terminal
  (`confirm_plan`, navigate_next forbidden).
- **`getScreenContext` flipped**: `ONBOARD-*` now returns `composeOnboardingContextBlock`
  (code-gen machinery + synced coach copy) for BOTH Vapi cold-start and the heartbeat.
  Non-onboarding screens still use the `screen_contexts` bundle.
- **Locked** with `onboardingBeatBundle.test.ts` (6 tests). type-check clean, 1331+6 tests pass.
- **Regen chain**: `sync_beats_context.py` (Sheet→Supabase) → `sync_beat_contexts.py`
  (Supabase→`beatContexts.generated.json`) → `npm run beats:bundle` (→ `src/generated/beat_contexts.json`).

**Still open (flagged to Yair):**
- BEGINNER-06 **copy** is new-order ("ready to start?") but **machinery** follows the flow
  (→ morning-setup) — the held order-desync. Nav is correct; the coach line is slightly off
  until the order change lands.
- WS2 (push the synced global into the Vapi assistant via `vapi-sync/`, kill the dashboard
  drift + the duplicated GENERAL/GLOBAL globals) — not started; touches shared Vapi config.

## WS1 PROGRESS + DIFF RESULT (2026-06-28)

Built (additive, NOT wired into live nav — `getScreenContext` untouched):
- `scripts/build-beat-bundle.ts` → `src/generated/beat_contexts.json` (17 beats: synced
  copy + opener + code `allowedTools` + step; full tool universe for FORBIDDEN).
- `src/lib/context/onboardingBeatBundle.ts` — composer: machinery (from step model +
  allowedTools) + clean synced copy.
- `scripts/diff-beat-machinery.ts` — read-only old-vs-new machinery diff.

**Diff verdict: flip NOT safe yet.** Matches on BEGINNER-01/02/03/07 (same target_step +
tools); FORK new correctly *adds* the legit `ask_clarification`. Three genuine blockers,
all engine-step-model / order-desync (Yair's domain):
1. **BEGINNER-04 / -05** — `stepForScreenId` is undefined (they're sub-sheets of step 5),
   so generated machinery drops the `navigate_next` target the old block had (`6`). Need a
   canonical target_step for the habit-config sub-beats.
2. **BEGINNER-06** — code `allowedTools` = `advance_step` → target 8 (old-order → morning-setup);
   old block had `confirm_plan`, no nav. The held order-desync, made concrete.
3. **Advanced beats** — old had zero machinery; new adds it. Targets need a nav sanity check.

→ The composer is engine-faithful; the gaps are in the engine step model itself. Resolve
(1)–(3) — most likely as part of the held order change — THEN flip `getScreenContext` for
`ONBOARD-*`. Hand this diff to Yair.

## Plan — 4 workstreams

### WS1 — Frontend beat bundle (the enabler)
- Extend the Supabase→repo sync to ALSO emit `src/generated/beat_contexts.json`
  (`{ global, beats: { [screenId]: { context, opener, version } } }`) — same data already
  written to `beatContexts.generated.json`, just placed where the frontend bundles it.
- Add `getBundledBeatContext(screenId)` (mirror of `screenContextsBundle.ts`).
- In `getScreenContext`: for `ONBOARD-*` screens, read the beat bundle; non-onboarding
  screens keep the `screen_contexts.json` bundle. Single switch point, zero new round-trips.
- Net: Vapi cold-start AND heartbeat now pull the synced beat copy, via the existing
  mechanism (`variableValues` + `add-message`). No change to `buildContextMessage`.

### WS2 — Vapi global from one source (kill the drift)
- The synced `GLOBAL_ONBOARDING_CONTEXT` (from `onboarding_globals`) becomes the Vapi
  assistant's persona, pushed via `scripts/vapi-sync/` (code-owned, like the tool addendum)
  — replacing the hand-maintained dashboard copy. One source for both paths.
- While there: dedupe the double `{{initial_screen_context}}` slot in the assistant prompt.
- ⚠️ Touches the **shared Vapi assistant config** — flag Yair before applying (standing rule).

### WS3 — get_user_context reads the beat source
- `tools.ts:168` (`getUserContext`) → for `ONBOARD-*`, return the beat context
  (`getBeatContext`) instead of the `screen_contexts` row; non-onboarding unchanged.
- Keeps the tool a valid fallback that agrees with the rest of the pipeline.

### WS4 — Retire the old onboarding path
- Onboarding screens stop being sourced from `screen_contexts.json` bundle / `screen_contexts`
  table / dashboard global. Those artifacts STAY for **non-onboarding** screens (home,
  check-in screens still on screen_contexts) until they migrate separately.
- `seed_contexts.py` keeps syncing non-onboarding "Screens"; onboarding now flows through
  `sync_beats_context.py`. Document the split so no one re-seeds onboarding the old way.

## Key risks / decisions (need answers before executing WS1–WS2)

1. **Forward pointers (the big one).** `screen_contexts` carries Vapi nav machinery
   (`NEXT:`, `-> SCREEN` arrows) — gotcha #10 says Vapi needs them to navigate. `beat_contexts`
   is **clean coach-copy with none of that** (by design). Switching Vapi to beats assumes
   navigation is **fully tool-driven** (engine model: `advance_step`/`navigate_next` +
   orchestrator watching `current_step`), not prose forward-pointers. **Must confirm the
   forward pointers are no longer load-bearing for Vapi nav under the engine** before WS1
   flips the source. If they still matter, we either keep them in a Vapi-only addendum or
   finish the tool-driven nav first.
2. **Tool Notes.** The Sheet's "Tool Notes / Expected Answers / Coach Lines" columns are
   NOT synced into code (only the `Beat Context` paragraph + opener are). Vapi may rely on
   tool-notes for *when* to call `advance_step`. Decide: do those columns get folded into the
   synced beat context (richer Vapi prompt), or stay dashboard/QA-only?
3. **Shared Vapi config** — WS2 edits the live assistant; coordinate with Yair.
4. **Order desync unchanged** — unifying makes both paths equally *new-order*; it does NOT
   resolve the held engine order mismatch (`beat-context-sync-plan.md §STATUS`).

## Suggested sequence
WS1 (frontend bundle, safe, no shared-config touch) → WS3 (tool, backend, safe) → WS2
(Vapi global, needs Yair) → WS4 (retire, after WS1–WS3 verified live). Each its own commit;
type-check + tests before each; #MVP after each.
