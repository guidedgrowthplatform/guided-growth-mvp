# Beat-context migration — plan (2026-06-23)

Plan only. No implementation. Goal: replace the verbose **screen context** the
onboarding LLM sees with Yair's cleaned **beat context**, and stand up a
"beat-context pipeline" that feeds it to the LLM in the chat-native onboarding.

> Work in the LIVE repo `/Users/jonah/Documents/guided-growth-mvp`.

---

## SHIPPED (2026-06-23) — Stages 1 + 3 (beat file is live for onboarding)

- **NEW `api/_lib/llm/onboarding/beatContexts.ts`** — the source of truth.
  `BEAT_CONTEXTS: Record<screen_id, { context, allowedTools }>` with Yair's
  cleaned copy for every onboarding beat + `allowedTools` derived from the legacy
  prose ALLOWED-TOOLS lists. `getBeatContext()` + `BEAT_CONTEXT_VERSION = 1`.
- **`buildSystemPrompt.ts`** — for `ONBOARD-*` screens it now uses the beat file
  and **skips the Supabase `screen_contexts` read entirely**; non-onboarding
  screens are unchanged. Renders a `## Tools For This Beat` allow-list from
  `allowedTools` (replaces the inline prose ALLOWED/FORBIDDEN block).
  `contextVersion` returns `BEAT_CONTEXT_VERSION` for beats.
- **Tests** — `buildSystemPrompt.test.ts`: updated the onboarding mock (only
  `onboarding_states` fires now) + added a beat-behavior test. tsc clean; suite
  green except the 3 pre-existing `resolveCheckinWindow` failures.

**NOT yet done (deliberately):** Stage 2 (code-enforce gating by filtering the
OpenAI tools array in `registry.ts` using `allowedTools` — currently steering
only, preconditions still fail-closed); the JSON→Supabase sync automation; any
frontend/Vapi/bundle change (the bundle is not on the Direct-LLM path).

---

## DECIDED (2026-06-23) — JSON now, Supabase sync deferred

- **Source of truth = a JSON beat-context file**, authored/edited directly. The
  `seed_contexts.py` → Supabase path is **out of scope for now**; a later
  automation will sync JSON → Supabase (for Vapi / other consumers).
- **Consequence (critical):** the onboarding LLM currently reads its block from
  **Supabase** in `buildSystemPromptForRequest`. For "JSON now" to actually change
  what the LLM sees, **the backend must import the beat JSON directly** for
  onboarding screens and skip the Supabase read for them. Until the sync exists,
  Supabase onboarding rows are stale/unused on the Direct-LLM path.
- **Location:** the JSON must be importable by the **API runtime** (Node on
  Vercel), so it can NOT live under `src/` (frontend-only). Put it in a shared,
  build-traced location — recommended `packages/shared/src/coaching/onboarding/`
  (the `@gg/shared` lane both frontend + API already resolve, CLAUDE.md gotcha #3).
  Frontend can import the same file (Vite/tsconfig lanes). One file, both sides,
  no Supabase.
  - Build note: importing `.json` from the API runtime needs the file present in
    `packages/shared/dist`. tsc does NOT copy `.json` to `dist` by default — so
    either (a) ship it as a typed `.ts` module (`export const BEAT_CONTEXTS = …`,
    zero build fuss) or (b) add a copy-json step to the shared build. Recommend
    (a): same data, authored as a file, no dist-copy gotcha. (If product needs a
    literal `.json` to edit, (b) is the cost.)
- **`screen_contexts.json` (frontend bundle) stays as-is** for Vapi + fallback —
  the beat file is a separate, Direct-LLM-only store. Don't overload the Vapi
  bundle with beat text.

This supersedes §6's open question — option **C** (in-repo file, recommended
shipped as a `.ts` module) is chosen; §6 retained for rationale.

---

## 0. TL;DR / recommendation

1. **The bundle JSON is not the LLM's source for onboarding chat.** For
   Direct-LLM (Path 3 — what the chat-native page uses), the LLM context is read
   **server-side from Supabase `screen_contexts`** in `buildSystemPromptForRequest`.
   `/api/llm` receives only `screen_id`; the backend re-reads the block.
   `src/generated/screen_contexts.json` feeds **Vapi** (Path 1, dormant on the
   chat page) and the `/api/context` fallback. So "migrate the json" is the wrong
   mental model — **the migration target is the Supabase row content + the
   server prompt builder.**

2. **A beat context is the COACH layer only.** Yair's cleaned text deliberately
   drops the machinery the current prose secretly carries: the `ALLOWED/FORBIDDEN
TOOLS` block, `navigate_next(target_step=N)`, canonical option labels, parsing
   buckets, `NEXT:` pointers. If we just swap prose → beat prose, **tool gating
   and option/parsing guidance disappear.** The migration's real work is
   **relocating that machinery from prose into code**, where some of it already
   lives (`buildCanonicalOptionsBlock`, `renderScreenOptions`, `tools.onboarding.ts`).

3. **Keep `screen_id` as the key.** Each beat already maps to a canonical
   `screen_id` (`beatForStep` → `beat.screenId`), and Yair's table is keyed by
   screen_id. Don't introduce a new `beat_id` keyspace — re-author the _content_
   per onboarding `screen_id`, leave the key path (`beatForStep → /api/llm
screen_id → Supabase row`) untouched.

4. **Recommended source of truth: a typed in-repo module**
   (`packages/shared/src/coaching/onboarding/beatContexts.ts`) rather than the
   Sheet/Supabase round-trip — because chat-native is code-driven, Vapi is
   dormant, and the Sheet→Supabase→bundle triple-store is the #1 drift source
   (CLAUDE.md gotcha). This is a deviation from "Master Sheet = runtime source of
   truth," so it's the main decision for Yair (§6).

---

## 1. How context reaches the LLM today

### 1a. Direct-LLM path (the chat-native onboarding — Path 3)

```
OnboardingChatPage
  → beatForStep(step, path) → beat.screenId            (onboardingStepBeats.ts)
  → registerScreen(beat.screenId)                       (OnboardingVoiceProvider)
  → user turn / opener → streamLLM({ screen_id, user_message, mode,
       coaching_style, recent_events })  POST /api/llm  (src/api/llm.ts)
  → api/llm/[...path].ts
  → buildSystemPromptForRequest({ screen_id, anon_id, coaching_style,
       recent_events, mode, input_mode, timezone })     (buildSystemPrompt.ts)
       ├─ SELECT context_block FROM screen_contexts WHERE screen_id=$1   ← SUPABASE
       ├─ stripForwardPointers(block).replace(navigate_next → advance_step)
       ├─ + coaching preamble + NO_PRENARRATION + NO_INTERNAL_NARRATION
       ├─ + ONBOARDING_TOOL_ADDENDUM (isOnboardingScreen)
       ├─ + buildAlreadyFilledBlock(onboarding_states.data)
       ├─ + buildCanonicalOptionsBlock(screen_id, data)   ← canonical labels in CODE
       ├─ + OPENER_INSTRUCTIONS (mode === 'opener')        ← opener-turn tool ban
       └─ + buildContextMessage({ screen_id, context_block, state_delta })  (shared)
              ├─ "USER KNOWN STATE — READ FIRST" header (filled_form_state)
              └─ renderScreenOptions(BEGINNER-02/03)        ← filtered options in CODE
```

\*\*The LLM's onboarding context = the Supabase row's `context_block`, transformed

- wrapped + augmented by code addendums.\*\* Change the row content → change what
  the LLM sees. The frontend bundle is not in this path.

### 1b. What the Supabase rows are seeded from

`scripts/voice-sync/seed_contexts.py` reads the Master Sheet **"Screens"** tab,
hashes each row, upserts to Supabase `screen_contexts (screen_id, context_block,
version, content_hash, ...)`. Idempotent; never auto-deletes. This is the
authoring → runtime pipeline for the backend store.

### 1c. The frontend bundle (`src/generated/screen_contexts.json`)

- Shape: `{ version, scope, screens: { [screen_id]: {screen_id, screen_name,
route, context_block, content_hash, source} }, routes: [{screen_id, route}] }`.
- Consumed by `getScreenContext()` (`src/lib/context/getScreenContext.ts`):
  sync bundle lookup → on miss, `/api/context` fetch. Used by **Vapi** session
  start/push (`initial_screen_context` variableValue) and the fallback.
- Authored byte-identical to the Sheet. **Drifts from Supabase** — CLAUDE.md
  explicitly warns "backend reads Supabase, frontend reads the bundle."

### 1d. The current `context_block` anatomy (what's actually in the prose)

Using `ONBOARD-01--FORM` as the type specimen, one block bundles five concerns:

| Concern                         | Example lines                                                                                        | Who needs it                          |
| ------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------- |
| **Tool gating**                 | `ALLOWED TOOLS … submit_profile(...)`, `FORBIDDEN ON THIS SCREEN: …`, `navigate_next(target_step=2)` | The LLM, to pick/avoid tools          |
| **Coach behavior**              | `BEHAVIOR: Accept voice or taps…`, `DO NOT: Re-ask…`                                                 | The coach voice (← beat context)      |
| **Canonical options / parsing** | `PARSING: "twenty-five"→25-34`, gender/referral buckets                                              | Voice parsing + canonical labels      |
| **Forward pointers**            | `NEXT: … → ONBOARD-FORK--FORM`                                                                       | Stripped for Direct-LLM; **Vapi nav** |
| **Implementation / test prose** | `SYSTEM ACTION`, `VOICE INSTRUCTIONS`, `EDGE CASES`, `NOTES`, Figma nodes                            | Nobody at runtime (noise)             |

`stripForwardPointers` already removes the forward pointers + the entire
`--- SUPPLEMENTARY ---` tail for Direct-LLM. So **the Direct-LLM prompt today =
tool block + BEHAVIOR/STATE/FLOW/PARSING + DO NOT** (everything above SUPPLEMENTARY,
minus NEXT). Yair's beat context ≈ the BEHAVIOR/DO-NOT slice, rewritten in coach
voice, with tools + options + parsing **removed**.

---

## 2. What a beat context is (and what it drops)

From Yair's table, a beat context is:

- **One BEAT: header** + 2–4 sentences of "what this beat collects + how to
  behave," in coach voice.
- **Drops:** screen_id/route/state, ALLOWED/FORBIDDEN tools, `navigate_next`,
  NEXT pointers, SYSTEM ACTION, VOICE INSTRUCTIONS, Figma/Vapi notes, canonical
  option label tables, parsing buckets.
- **Keeps:** the collection target (which fields), soft-vs-hard fields,
  the one or two behavioral guardrails ("ask only for missing," "one category
  only," "don't pressure gender").

So the beat context is **strictly the human/coaching layer.** The migration must
supply the dropped machinery from elsewhere.

---

## 3. The core problem to solve

> If we replace each onboarding `context_block` with Yair's beat prose verbatim,
> we lose per-screen **tool gating**, **canonical option labels**, and **voice
> parsing buckets** that the LLM currently reads inline.

Where each dropped concern must move:

| Dropped from prose                                    | Already in code?                                                                                                  | Action                                                                                                            |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `ALLOWED/FORBIDDEN TOOLS` per screen                  | **No** — prose-only today (handoff: "confirm_plan offered on every beat, no per-screen gating in registry.ts")    | **New per-beat tool-gating config**, code-enforced (filter the OpenAI tools array) + optional short reminder line |
| Canonical option labels (goals/habits)                | **Yes** — `buildCanonicalOptionsBlock` (canonicalOptions.ts) + `renderScreenOptions` (shared)                     | Verify coverage per beat; drop from prose                                                                         |
| Parsing buckets (age range, gender/referral synonyms) | **Partial** — canonical values enforced server-side on submit; voice synonym mapping is prose                     | Add a small **parsing-hints** layer (only needed once voice/STT is live; low priority under STATIC_FEED_MODE)     |
| `navigate_next(target_step=N)`                        | Rewritten to `advance_step`; advancement also flows through optimistic client `advance()` + `advanceStep` handler | Keep `advance_step` in the tool registry; no prose needed                                                         |
| Forward pointers / SUPPLEMENTARY                      | Stripped already                                                                                                  | Nothing — beat context never had them                                                                             |

**Conclusion:** the beat-context pipeline = **(a)** a coach-voice beat block
(Yair's text) **+ (b)** a structured per-beat tool/option config in code. Today's
single prose blob splits into these two layers.

---

## 4. Target architecture — the beat-context pipeline

Introduce a **beat layer** that the server prompt builder composes for onboarding
screens, replacing the Supabase prose read for those screens.

```
beatForStep(step, path) → beat.screenId  (unchanged keying)
        │
        ▼
buildSystemPromptForRequest(screen_id …)
  if isOnboardingScreen:                      ← NEW branch
     beat = getBeatContext(screen_id)         ← typed module or Supabase 'beat' column
     coachBlock   = beat.context              ← Yair's cleaned prose (replaces stripped screen prose)
     toolGate     = beat.allowedTools         ← filter OpenAI tools array (CODE-ENFORCED)
     optionsBlock = buildCanonicalOptionsBlock(screen_id, data)   (unchanged)
     compose: preamble + addendums + alreadyFilled + optionsBlock
              + OPENER + buildContextMessage({ context_block: coachBlock, … })
  else:                                        ← check-ins, app screens unchanged
     screenRow = SELECT … FROM screen_contexts (today's path)
```

Key properties:

- **`screen_id` stays the key.** No change to `beatForStep`, the provider, or
  `/api/llm`. Only `buildSystemPromptForRequest` learns a new onboarding branch.
- **Tool gating becomes code-enforced** (filter the actual tools array, not just
  prose). Fixes the "confirm_plan offered on every beat" open bug.
- **`buildContextMessage` is reused unchanged** — it just wraps the shorter coach
  block instead of the long screen block. The "USER KNOWN STATE" header,
  `renderScreenOptions`, and state-delta rendering all keep working.
- **Check-in + app screens are untouched** — they still read `screen_contexts`.
  The branch is gated on `isOnboardingScreen` (already computed in the builder).

---

## 5. Keying: `screen_id` vs new `beat_id`

**Recommendation: keep `screen_id`.** Rationale:

- `beatForStep` already returns canonical screen_ids; Yair's table is keyed by
  them; `stepForScreenId` is the inverse. Reusing them = zero churn in the
  frontend/provider/nav.
- A beat that forks (step 3 beginner vs advanced) is already two screen_ids
  (`ONBOARD-BEGINNER-01` / `ONBOARD-ADVANCED`). The map handles forks for free.
- The combined-vs-split profile question (handoff §"structural splits") is a beat
  _granularity_ decision, independent of keying — if profile splits into 3 beats
  later, those get 3 screen_ids; the beat-context module gains 3 entries.

The beat layer is a **content + config swap behind the existing key**, not a new
addressing scheme.

---

## 6. Source of truth — the main decision for Yair

Where do beat contexts + per-beat tool config live? Three options:

**(A) New "Beats" tab in the Master Sheet** (mirrors "Screens"). Extend
`seed_contexts.py` to read it and upsert to a new `beat_contexts` table (or a
`beat_context` column on `screen_contexts`). Pros: stays in the Sheet-as-runtime
pattern; product-owned authoring. Cons: keeps the Sheet→Supabase→bundle drift;
tool config in a spreadsheet is awkward and error-prone.

**(B) Reuse "Screens" tab, add a "Beat Context" column.** seed writes both
`context_block` (legacy/Vapi) and `beat_context` (Direct-LLM). Backend picks
`beat_context` for onboarding. Pros: one tab; Vapi keeps its rich block, chat
gets the clean one — **resolves the "Vapi needs forward pointers" tension
cleanly**. Cons: still Sheet-coupled; tool config still needs a home.

**(C) Typed in-repo module** `packages/shared/src/coaching/onboarding/beatContexts.ts`:

```
export const BEAT_CONTEXTS: Record<string /*screen_id*/, {
  context: string;            // Yair's cleaned coach prose
  allowedTools: ToolName[];   // code-enforced gating
  // optional: parsingHints?: string;  (voice, later)
}> = { 'ONBOARD-01--FORM': { context: '…', allowedTools: ['submit_profile','advance_step'] }, … }
```

Backend imports it directly; no Supabase read for onboarding. Pros: **kills the
triple-store drift for onboarding**, tool config is typed + testable, lives with
the code that consumes it, version-controlled, reviewable in PRs. Cons: deviates
from "Master Sheet = runtime source of truth"; product can't edit copy without a
PR (mitigate: keep a Sheet "Beats" tab as the human draft, generate the module
from it on demand — author-time, not runtime).

**My recommendation: (C)**, optionally with a generator from a Sheet "Beats" tab
for Yair's authoring comfort. Onboarding is now fully code-driven (chat-native
default, Vapi dormant, STATIC_FEED_MODE); a runtime Sheet/Supabase fetch buys
nothing and costs drift. **If product must own copy live → (B).**

---

## 7. Staged migration plan

**Stage 0 — Lock decisions (Yair + Yonas).** Source of truth (§6), beat
granularity (combined profile vs split), whether Vapi keeps the rich screen
block (almost certainly yes → option B/C keep both layers).

**Stage 1 — Beat-context store + types (no behavior change).** Land the chosen
store (module or Supabase column) with Yair's text for all onboarding beats
(`ONBOARD-AUTH--FORM`, `01--FORM`, `FORK--FORM`, `BEGINNER-01/02/03/07/06`,
`ADVANCED/-02/-04/-05`, `ADV-CUSTOM`). Author the per-beat `allowedTools` from
the current prose `ALLOWED TOOLS` lists. Nothing reads it yet.

**Stage 2 — Per-beat tool gating (code-enforced).** In the `/api/llm` onboarding
tool assembly, filter the tools array by `beat.allowedTools`. Add a short
"allowed tools" reminder to the prompt (generated from config, not prose). Verify
against current prose lists — this is a _behavior-preserving_ relocation. Closes
the "confirm_plan on every beat" bug.

**Stage 3 — Swap the context block.** In `buildSystemPromptForRequest`, add the
`isOnboardingScreen` branch: use `getBeatContext(screen_id).context` instead of
the Supabase screen prose. `stripForwardPointers` becomes a no-op on beat text
(already clean) — keep it for safety/Vapi parity. Confirm `buildContextMessage`,
`buildCanonicalOptionsBlock`, `buildAlreadyFilledBlock`, `OPENER_INSTRUCTIONS`
still compose correctly with the shorter block.

**Stage 4 — Canonical options / parsing coverage check.** For each beat that used
to carry option/parsing prose (BEGINNER-02 goals, BEGINNER-03 habits, FORK path,
01 buckets), confirm `buildCanonicalOptionsBlock`/`renderScreenOptions` supply the
labels. Add a `parsingHints` field only where voice needs it (defer while
STATIC_FEED_MODE silences voice).

**Stage 5 — Frontend bundle + Vapi.** If keeping Vapi alive later: leave the
bundle/Supabase `context_block` as the _rich_ block for Vapi; the beat layer is a
parallel Direct-LLM-only store. If retiring Vapi for onboarding: the bundle's
onboarding entries become fallback-only and can be slimmed to beat text too.
**No bundle change is required to ship Stages 1–4** (bundle isn't in the
Direct-LLM path).

**Stage 6 — Cleanup.** Once beat contexts are authoritative for Direct-LLM,
optionally stop seeding onboarding rows into Supabase `screen_contexts` (or mark
them Vapi-only). Update CLAUDE.md gotchas + the screen-context skill docs.

---

## 8. File-by-file change map (where work lands)

- `packages/shared/src/coaching/onboarding/beatContexts.ts` — **NEW** (option C):
  beat text + `allowedTools` per screen_id. Source of the migration.
- `api/_lib/llm/buildSystemPrompt.ts` — **NEW onboarding branch**: select beat
  context for `isOnboardingScreen`; compose as today otherwise.
- `api/_lib/llm/tools.onboarding.ts` + the `/api/llm` tool assembly — **filter by
  `beat.allowedTools`** (code-enforced gating).
- `api/_lib/llm/onboarding/canonicalOptions.ts` — verify per-beat option coverage
  (likely already sufficient).
- `scripts/voice-sync/seed_contexts.py` — only if option A/B (read a Beats tab /
  Beat column; write `beat_contexts`/`beat_context`).
- `supabase/migrations/` — only if option A/B (new table/column).
- `src/generated/screen_contexts.json` + `screenContextsBundle.ts` — only at
  Stage 5 (Vapi/fallback), not for the core swap.
- Tests: `api/_lib/llm/onboarding/__tests__/` — assert per-beat allowed tools +
  that the onboarding prompt now uses beat text; snapshot the composed prompt for
  one beat per type.
- Docs: CLAUDE.md (screen-context gotchas), `.claude/skills/path-3-direct-llm`,
  `app-architecture` skill.

---

## 9. Vapi / voice-variant coexistence

- **Vapi (Path 1) legitimately needs the rich block** with forward pointers — it
  drives navigation off `navigate_next(target_screen=…)`. Do **not** feed Vapi
  the beat context. Keep the rich `context_block` (Supabase + bundle) for Vapi;
  the beat layer is **Direct-LLM-only**. This is why option **B/C** (two parallel
  blocks) is safer than overwriting the screen prose in place.
- **Voice vs text variants (UX-24):** the beat context is rendering-agnostic
  (it's coach intent, not UI). The existing `TEXT_INPUT_RULE` / input_mode
  addendum already handles "typing vs speaking" phrasing — beat text should stay
  channel-neutral and let that addendum specialize. Parsing hints (synonyms) are
  the only voice-specific add, deferred to when STT is live.

---

## 10. Drift, testing, rollback

- **Drift:** option C removes the Sheet→Supabase→bundle triple-store for
  onboarding (biggest win). Options A/B keep it; mitigate with the existing
  content-hash idempotency + a test asserting bundle vs beat-store parity.
- **Behavior-preserving stages:** Stage 2 (tool gating) and Stage 3 (block swap)
  are each independently shippable and reversible. Snapshot-test the composed
  system prompt for one beat per archetype (profile / fork / category / habits /
  reflection / plan-review) before & after.
- **Rollback:** keep the Supabase screen rows intact through Stage 5; the
  onboarding branch can fall back to the old `screen_contexts` read behind a flag
  if a beat block underperforms.
- **STATIC_FEED_MODE:** while the flag silences the LLM/voice, none of this is
  user-visible in onboarding — safe to land Stages 1–4 behind the silence and
  verify via prompt snapshots / a temporary un-silenced dev build.

---

## 11. Open decisions (need Yair / Yonas)

1. **Source of truth (§6):** typed module (C, recommended) vs Sheet column (B)
   vs new Beats tab + table (A)? Drives whether `seed_contexts.py` + a migration
   are in scope.
2. **Beat granularity:** keep the combined `ProfileCard` beat, or split profile
   into nickname/age/gender beats (handoff §"structural splits")? Affects how many
   beat entries + screen_ids.
3. **Vapi for onboarding — alive or retiring?** If alive, keep the rich block for
   Vapi and run the beat layer in parallel (B/C). If retiring, we can slim the
   bundle too (Stage 5).
4. **Tool-gating enforcement:** code-filter the tools array (recommended, fixes a
   bug) vs prose reminder only (less robust)?
5. **Per-beat parsing hints:** author now, or defer until voice (Stage C of the
   onboarding handoff) lands? (Recommend defer.)

```

```
