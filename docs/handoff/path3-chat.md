# Session Handoff — Path 3 Text Chat + Text-Driven Onboarding

_Updated: 2026-05-28 · Carved from `fix/orb-four-state-routing` (now merged to main; orb four-state work split into its own MR)._

Three related workstreams. Read top-to-bottom once, then jump to **Remaining Work**.

> **Note on orb four-state routing:** the four-state orb model (UX-26 States 1–4) is being carved
> into its own MR rather than landing with this docs/onboarding work. In the interim,
> `voice_in_only` mode is **non-functional** pending the Soniox realtime STT migration — surfaces
> that map to that state should fall back to text input until the migration lands.

---

## 0. TL;DR — where things stand

- **Workstream A (Path 3 chat-session hardening): DONE + committed** (`f4821db`, `bbfb8a7`).
- **Workstream B (Text-driven onboarding — sequential collection + client-owned advancement):
  committed as `d7d5478`.** tsc/eslint clean, 458 tests pass.
- **Post-commit fixes (UNCOMMITTED — see §2.1):** `[NAME]` placeholder, FORK yes/no mapping, and the
  dual-authority navigation race (the "works sometimes, sometimes tweaks" bug). Gates green.
- **⚠️ Architectural debt identified — read §5.1.** Onboarding advancement + state is _patched_, not
  _modeled_. Recommended next step is a single onboarding **state machine**. "Start again" = scope
  that refactor.
- **Not yet manually E2E-tested.** Test on a **FRESH account** — the test account (`J56664364`) has
  stale `current_step`/profile that confounds prefill + resume.
- **DB migrations 035 + 036 were APPLIED to PRODUCTION Supabase** (`pmunbflbjpoawicgimyc`) via the
  Supabase MCP — see §4. There is no separate dev DB.

---

## 1. Workstream A — Path 3 chat-session hardening (DONE, committed)

**What it is:** Path 3 = the **text chat** path (`/api/llm` streaming + `useLLM` +
`chat_messages` persistence). Surface: the post-onboarding CHAT screen.

**Headline fix:** client-computed `turn_index` desynced from the DB whenever a turn used a tool →
next message collided on `UNIQUE(chat_session_id, turn_index)` → rows lost, swallowed by silent
`catch {}`. Root cause: client owned state the server should own.

**Committed changes:** server-owned `turn_index` (`pg_advisory_xact_lock`, `MAX(turn_index)+1`,
dedicated `pool.connect()` client since `pool` is `max:1`); JSONB `tool_calls` stringified before
binding; server-owned session (`POST /api/chat/session`, in-memory id only, no localStorage);
ownership guard (403); retry idempotency; most-recent-N read ordering; RLS migration `036`.

**Key files:** `api/llm/[...path].ts`, `api/chat/[...path].ts`, `src/hooks/useChatSession.ts`,
`useLLM.ts`, `supabase/migrations/035_*`, `036_*`.

**Caveat:** the core `persistChatTurn` regression test was deferred (manual-E2E-only by choice) —
still CI-unguarded.

---

## 2. Workstream B — Text-driven onboarding (this commit)

### Problem

Typed onboarding must **drive the flow** (fill forms, navigate), not free-form chat. Two bugs drove
the design:

1. The old path asked a **combined** question (name + age + gender + referral at once) and routed to
   free-form chat → the LLM improvised / invented data.
2. **The LLM owned navigation** — it decided when a screen was complete and emitted `navigate_next`.
   That was flaky: it invented "let me confirm" turns, missed the advance, and `error`-ed on "yes"
   ("I didn't quite catch that"). Prompt-tuning couldn't make it reliable.

### Architecture decided & implemented: client owns advancement

- **The LLM does NLU only** — extract field values + phrase the next missing-field question. It
  **never** drives navigation (no `navigate_next` / `confirm_plan`).
- **The client owns advancement deterministically.** Two policies:
  - **Single-decision screens auto-advance** the moment required fields complete: Step1
    (`ONBOARD-01--FORM`), Step2 (`ONBOARD-FORK--FORM`), Step3 (`ONBOARD-BEGINNER-01`).
  - **Judgment-call screens advance by tapping Continue/Confirm** (chat only collects/edits): Step4
    goals, Step5 habits, Step6 reflection, Advanced\*, PlanReview.
- **Sequential collection:** one field at a time, but still fills everything volunteered in one turn,
  then asks for what's missing. Opener asks only for the first field.
- **Continuous-thread UX:** brief confirming line → ~800ms readable delay → navigate; the overlay
  stays open across navigation (provider state persists above the router) and the next screen's
  opener appends to the same thread.

### How it's wired

- **Engine** `api/_lib/llm/onboardingTurn.ts` + `route==='onboarding'` in `api/llm/[...path].ts`
  (`POST /api/llm/onboarding` → `{ message, actions }`). `MULTI_ACTION_OVERRIDE` enforces sequential
  collection, fill-all-volunteered, no confirmation/repeat-back, **no nav actions, no `error`**.
  `ALLOWED_ACTIONS` is field-extraction only — nav/error actions are dropped server-side (the client
  also skips them; defense-in-depth). Reuses the per-screen vocabulary from the shared
  `onboardingPrompt.ts` but `onboardingPrompt.ts` is **NOT modified** (it feeds the voice path).
- **Client** `src/api/onboarding.ts` → `parseOnboardingInput(...)`.
- **Openers** `src/components/onboarding/onboardingOpeners.ts` (deterministic, single-field).
- **Overlay** `OnboardingChatOverlay.tsx`: `autoAdvance` prop; `runOnboardingTurn` applies field
  actions, ignores nav/error, and on `autoAdvance` screens schedules a guarded deferred advance
  (`ADVANCE_DELAY_MS=800`, timer captured in `advanceTimerRef`, cleared before re-schedule and on
  unmount). Opener fires **once per screen** (so it continues an ongoing thread). `messages` memoized.
- **Layout** `OnboardingLayout.tsx`: `autoAdvance` prop threaded into the overlay.
- **Pages**: `autoAdvance` set on Step1/2/3; each page's `handleNext` self-guards (early-return
  mirroring its `ctaDisabled`) so neither auto-advance nor a programmatic call can save blanks —
  guards added to Step1/2/3/4 + AdvancedInput, verified exact match to `ctaDisabled`.

### Verified safe (no other path regressed)

- **Voice (Vapi)** advances via `useAgentNavigation` → `navigate()`, which **never calls
  `handleNext`** — the new page guards cannot block voice. Voice form-fill (`onVoiceAction`) untouched.
- **Free-form CHAT** path (`llm.sendMessage` / `llm.toolEvents`) is independent of `runOnboardingTurn`.
- **`onboardingPrompt.ts`** (shared with voice `process-command.ts`) unchanged.

### 2.1 Post-commit fixes (UNCOMMITTED, on top of `d7d5478`)

Found during the first manual E2E. Gates green (tsc/eslint/458 tests). Decide whether to commit
these before the §5.1 refactor, or fold them in.

1. **`[NAME]` placeholder echoed instead of the real name** (e.g. "Thanks, [NAME]!"). Cause: the
   shared base prompt's "PII Scrubbing" section tells the LLM to placeholder names in its _reply_.
   Fix: `onboardingTurn.ts` override **rule 7** — use the real name, never emit `[NAME]/[AGE]/[EMAIL]`.
   ⚠️ Relies on LLM compliance; if it recurs, post-process the message server-side (swap `[NAME]` for
   `filled_fields.nickname`).
2. **"Yes, I have" not recognized on the FORK** → "It seems like you're affirming something." Cause:
   override rule 6 treated a valid yes/no answer as a content-free affirmation. Fix: **rule 6** now
   maps input to the screen's field FIRST (yes/"I have" → `set_path` braindump, no/"new" → simple);
   only re-asks when truly unmappable; never `error`.
3. **The "works sometimes, sometimes tweaks" inconsistency.** Root cause: TWO navigation authorities
   were live — the new client auto-advance AND `useAgentNavigation` (the VOICE hook), which fires
   whenever `current_step` climbs (`saveStep` bumps it) → nondeterministic race vs Realtime/cache
   timing. Fix: **gated `useAgentNavigation` to voice mode only** (`voiceOn || micOn` via
   `useDualButtonControls`) — its documented purpose. `voiceActive === !textOnlyMode`, so exactly ONE
   authority is live per mode (text → client advance; voice → agent nav). Pure
   `shouldAdvanceToNextScreen` unchanged (tests pass); voice behavior unchanged.

---

## 3. What is NOT done (next sessions)

### Required before trusting in production

- **Manual E2E** in the live app (`npm run dev` + `npm run dev:api`, text-only mode). Walk Step1
  (name→age→gender→referral → auto-advance), Step2 fork, Step3 category; confirm continuous thread,
  no premature/blank advance, "yes" never dead-ends. Nothing here has run live yet.
- **`persistChatTurn` regression test** (Workstream A) — still CI-unguarded.

### Phases 2–4 — per-screen text collection NOT verified in text mode

The **advancement** is generalized, but the actual field-collection for these screens is unverified
in text-only mode (the engine prompt + page `onVoiceAction` handlers exist, built for voice):

- **Phase 2:** Step2 FORK branch routing, Step3 category, Step4 goals — confirm real `voiceOptions`
  reach the engine so it selects real options.
- **Phase 3:** Step5 habit selection. **Known conflict:** override rule 1 ("emit one action per
  volunteered field") vs base prompt "one habit per turn, pick the first" (`onboardingPrompt.ts:177`).
  Resolve before enabling text habits.
- **Phase 4:** Step6/7 reflection + review, advanced path, tap/text parity, fallback edges.

> NOTE: Phases 2–4 may be partly subsumed by the §5.1 state-machine refactor — if you do that
> refactor, build the remaining screens on the machine rather than the current per-page pattern.

### Architectural debt + cleanup

See **§5.1** (recommended state-machine refactor — the main "start again" item) and **§5.2** (naming,
habit-screen conflict, sessionLogStore, deferred test).

---

## 4. ⚠️ Database migrations — APPLIED TO PRODUCTION

**No separate dev database.** `.env`, `.env.local`, `.env.production` all point at Supabase project
**`pmunbflbjpoawicgimyc`** (real `profiles`). With explicit go-ahead, applied via Supabase MCP (NOT
the repo migration runner):

- `035_chat_messages` — created `chat_messages` (RLS enabled, indexes, unique `(chat_session_id, turn_index)`).
- `036_chat_messages_rls` — policies `anon_isolation` (dormant under service-role) + `service_role_only`.

**Reconciliation gap:** these ran via MCP, so a future migration-runner replay of `035`/`036` would
error on "already exists." Reconcile before any automated migration run against this DB.

---

## 5. Architecture decisions & rationale (don't re-litigate)

- **The LLM never owns navigation in the text path.** It does NLU; the client decides advancement
  from deterministic completeness (single-decision screens) or an explicit Continue tap (judgment
  screens). This is the durable fix for the flaky-`navigate_next` class of bugs.
- **Text and voice are decoupled.** Voice = Vapi + `useAgentNavigation` (Realtime `current_step`);
  text = overlay + guarded `handleNext`. They share the page `onVoiceAction` field-appliers and the
  per-screen vocabulary in `onboardingPrompt.ts`, but NOT advancement code.
- **`onboardingPrompt.ts` is shared with voice — do not edit it for text-only changes.** Text-only
  rules live in `MULTI_ACTION_OVERRIDE` (`onboardingTurn.ts`).
- **Openers are deterministic** (spec-authored), not LLM-generated → no question drift.

### 5.1 ⚠️ Known architectural debt → recommended next refactor ("start again")

The _principles_ above are correct and standard (LLM = NLU; deterministic control flow; server owns
durable state; client owns the SPA route). The _implementation_ is patched, not modeled. Senior-dev
assessment of the current smells:

- **Completeness logic is duplicated 3×:** each page's `ctaDisabled`, the mirrored `handleNext`
  guards (added this workstream), and the LLM prompt's per-screen "required fields." One truth,
  three copies → where bugs breed.
- **No single onboarding state machine.** State is page-local `useState` + prefill `useEffect`s
  syncing from server data; "what step / what's next / are we done" is smeared across pages,
  `current_step` in the DB, and the router.
- **Advancement was two competing mechanisms** (client auto-advance vs `useAgentNavigation`); §2.1
  fix #3 mode-gates one off — a _symptom_ patch. The real fix is having one authority by design.

**Recommended target architecture:** a single onboarding **state machine** (reducer or XState) as
the source of truth — holds collected data, knows each step's required fields, computes `canAdvance`,
exposes `next()`. **Every transport (voice action, text action, tap) dispatches the SAME events.**
Navigation becomes a pure projection of the machine's current step. This deletes the per-page guard
duplication, the dual-authority race, the prefill-sync effects, and most of the "sometimes it tweaks"
class. The LLM is unchanged — it still emits actions, now dispatched as events. This is "one engine,
two transports" done properly (today the transports share the NLU contract but still have separate
advancement code).

**Scope/risk:** touches every onboarding page + the voice integration. Do it as a deliberate plan,
NOT mid-MVP-sneak — and ideally once the voice stack settles (it's migrating Cartesia → Vapi).

### 5.2 Other flagged debt (non-blocking)

- **Naming:** the text chat reads state from `OnboardingVoiceProvider` / `useOnboardingVoiceSession`
  even with no voice. A mechanical rename to a transport-neutral name is low-risk (~8 import sites);
  physically separating chat state out of the 846-line Vapi provider is entangled.
- **Habit screen (BEGINNER-03):** override rule 1 ("emit every volunteered field") conflicts with the
  base prompt's "one habit per turn" (`onboardingPrompt.ts:177`). Resolve before enabling text habits.
- `sessionLogStore` persists to `localStorage` (shared-device) → move to `sessionStorage`.
- `persistChatTurn` regression test (Workstream A) still CI-unguarded.

---

## 6. How to run / manually E2E test

```
npm run dev        # Vite frontend
npm run dev:api    # vercel dev (serves /api/llm/onboarding); loads .env.local (OPENAI_API_KEY)
```

Text-only mode (AI output off, mic off) on `/onboarding/step-1` → walk through to step-3.
Gates: `npx tsc --noEmit` (clean), `npx vitest run` (458 pass), `npx eslint <touched files>` (0).

---

## 7. Gotchas

- `api/` is ESM with `.js` import suffixes; serverless can't import from `src/`.
- `pool` is `max:1` (serverless-safe) — multi-statement txns need `pool.connect()`.
- screen-id divergence: bundle/vocab use `ONBOARD-01--FORM`; `STEP_TO_SCREEN_ID` gives `ONBOARD-01`.
  Overlay prefers `stepContext.screen_id` (canonical); opener map carries both keys.
- Onboarding form state is **page-local React state** — the overlay reaches it via the
  `onAction`→page `handleVoiceAction` bridge. The 800ms advance delay lets that state commit before
  the guarded `handleNext` reads it.
- `overlayOpen` + `messages` live in `OnboardingVoiceProvider` (above the router, `App.tsx`), so they
  persist across onboarding navigation — that's what makes the continuous chat thread work.

---

## 8. Reference

- **gg-spec** (sibling repo): nav model in `data/nav.json`; per-screen packets `screens/ONBOARD-*.md`.
  ONBOARD-01 → FORK → BEGINNER-01→02→03(step-5)→…
- **Key code:** `api/_lib/llm/onboardingPrompt.ts` (action vocabulary), `src/hooks/useOnboarding.ts`
  (`saveStep`, `STEP_TO_SCREEN_ID`), `src/hooks/useAgentNavigation.ts` (voice advance-on-current_step),
  `src/pages/onboarding/shared/Step1Page.tsx` (`handleVoiceAction` = per-screen action applier).
- **Memory:** `project_text_onboarding_engine`, `project_voice_migrating_to_vapi`,
  `feedback_no_auto_commit`, `feedback_migration_approval`, `feedback_no_narrative_comments`.
