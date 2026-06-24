# Chat-native onboarding — handoff (2026-06-23)

Handoff for an agent picking up the chat-native onboarding work. Self-contained: assumes no prior context.

> **Work in the LIVE repo** `/Users/jonah/Documents/guided-growth-mvp`. Subagents default to a stale git worktree that reads old code — always pass the live path explicitly.

---

## 1. What this is

Onboarding is being collapsed from a multi-screen routed form flow into **one chat surface at `/onboarding`** where the chat **is** the onboarding. Each step renders as an inline card under a coach bubble (like the check-in/coach chat renders `HabitSuggestionCard` etc.).

Pinned requirements (from the product owner, Yonas):

- `/onboarding` itself renders the chat — **a PAGE, not an overlay**, not a redirect to `/onboarding/chat`.
- Everything post-login lives in the chat, **starting from a preferences beat (Beat 0)**.
- **Beats render proactively**: when the coach asks a question, the beat's card renders _with_ that line (pre-filled from live state, editable, fillable by voice/typing).
- Voice = **Cartesia (TTS) + Soniox (STT)** conversational loop, mirroring the home check-in (`useCoachChat`), emulating Vapi. **No Vapi (Path 1) for now** — only Path 2 (async) + Path 3 (Direct-LLM).
- **No feature flag** — chat-native is the direct default.
- The preferences UI must be the same orb + Talk/Screen buttons as the existing voice-preference screen, and the page needs the main bottom orb.

Reference spec: sibling repo `/Users/jonah/Documents/gg-spec` → `screens/onboarding-chat-native-scenario-v1.md`.

---

## 2. Architecture you must understand

### The beat model

`current_step` (integer, in the `onboarding_states` table) selects which beat/screen renders. `beatForStep(step, path)` in `src/lib/onboarding/onboardingStepBeats.ts` maps step → `{ step, screenId, cardType }`. The page (`src/pages/onboarding/OnboardingChatPage.tsx`) registers `beat.screenId` with the provider, which drives the opener + screen context + LLM tool gating.

### Canonical screen ↔ step map (hard-won — verify before changing)

The server's `navigateNext.ts` / `saveStep(N)` is the source of truth. Steps are 1-indexed; step 0 (PREFS) is client-only.

| step | beginner screen_id  | advanced screen_id  | captures                                |
| ---- | ------------------- | ------------------- | --------------------------------------- |
| 0    | ONBOARD-00--PREFS   | (same)              | voice/type preference                   |
| 1    | ONBOARD-01--FORM    | (same)              | profile (nickname/age/gender/referral)  |
| 2    | ONBOARD-FORK--FORM  | (same)              | path choice (simple/braindump)          |
| 3    | ONBOARD-BEGINNER-01 | ONBOARD-ADVANCED    | category / brain-dump                   |
| 4    | ONBOARD-BEGINNER-02 | ONBOARD-ADVANCED-02 | goals / parsed habits                   |
| 5    | ONBOARD-BEGINNER-03 | ONBOARD-ADVANCED-04 | habits / reflection                     |
| 6    | ONBOARD-BEGINNER-07 | ONBOARD-ADVANCED-05 | reflection (beginner) / plan (advanced) |
| 7    | ONBOARD-BEGINNER-06 | ONBOARD-ADVANCED-05 | plan review / completion                |

- **`ONBOARD-BEGINNER-04`/`-05`/`-08`, `ONBOARD-ADV-CUSTOM` are NOT steps** — they're bottom-sheet sub-screens within a step (`pushSubScreen`). Don't add them to `SCREEN_TO_STEP`.
- `STARTING-PLAN` is the master-sheet completion screen_id but has **no chat opener** — do not use it as a beat screenId. The plan-review beat must be `ONBOARD-BEGINNER-06` / `ONBOARD-ADVANCED-05`.

### Two different nav tools (critical gotcha)

- **Vapi (Path 1):** tool `navigate_next(target_screen=<screen_id string>)` — `api/_lib/llm/tools.ts`.
- **Direct-LLM (Path 3, what the chat page uses):** the onboarding context_block text says `navigate_next(target_step=N)`, but `api/_lib/llm/buildSystemPrompt.ts:116-118` **rewrites `navigate_next` → `advance_step`**. So the chat-page LLM emits **`advance_step`**, handled in `useChatToolEvents.ts` (reads `result.current_step` from the server — **server-persisted**).
- The `chatNative` branch on `navigate_next` in `useChatToolEvents.ts` is effectively defensive/dead for the chat page; advancement actually flows through `advance_step` (and through optimistic client `advance()` for the inline-card taps).

### Completion

`confirm_plan` tool (screen `ONBOARD-BEGINNER-06` / `ONBOARD-ADVANCED-05`) requires `habitConfigs` + `reflectionConfig` in `onboarding_states.data` and `current_step >= 7`; on success the server bumps `current_step` to 8 (`GREATEST(...,8)`) but leaves `status='in_progress'`. The **client** flips status: watch `current_step > 7` → call `complete()` (→ `/home`). Both paths persist habits under the `habitConfigs` key, so `deriveStateFromOnboarding(state.data)` reconstructs the plan for both.

### Provider / session

`src/contexts/OnboardingVoiceProvider.tsx` wraps the app, owns the session, derives `chatScreenId = activeSubScreenId ?? registeredScreenId ?? currentScreenId`, renders the floating overlay only when `overlayOpen && !onChatPage` (suppressed on the chat page). `vapiShouldBeLive` is gated `&& !onChatPage` so Vapi stays dormant on the chat surface.

---

## 3. Session 1 — infra/plumbing (already done)

All typecheck-clean (`npx tsc --noEmit`), full suite green except 3 pre-existing `resolveCheckinWindow.test.ts` failures (unrelated — from already-modified `useCheckinEntry.ts`).

1. **Beat-0 greeting seeding race** — `src/generated/screen_contexts.json`: added an `ONBOARD-00--PREFS` screen entry + a `/onboarding` route so `currentScreenId` resolves on first paint (the opener effect was bailing because `chatScreenId` was null).
2. **Inline-frozen cards** — cards now attach to their beat's opener message (`cardForScreenId()` in `src/lib/onboarding/onboardingChatCards.ts`, gated on `chatNative` in `src/hooks/useOnboardingChat.ts`) and render **inline inside `messages.map`** in `OnboardingChatPage.tsx`. Removed the old single bottom-pinned `activeCard`. Old cards now stay frozen in scrollback (mirrors the coach overlay).
3. **Completion wiring** — `OnboardingChatPage.tsx`: new effect calls `complete()` when `current_step > 7` and plan data present; a fresh `confirm_plan` clears the single-fire latch for one retry after a failed `complete()` (no retry-storm). Imports `deriveStateFromOnboarding`.
4. **Beat 7 = real plan-review screen** — `beatForStep` step 7 returns `ONBOARD-BEGINNER-06` / `ONBOARD-ADVANCED-05` (not `STARTING-PLAN`). This gives the final beat an opener + the `confirm_plan` tool, and passes the `ONBOARD-` chat-enable gate. Steps 4/5/6 made path-aware.
5. **Nav map completed** — `SCREEN_TO_STEP` in `onboardingStepBeats.ts` now covers all beginner + advanced screens; `useChatToolEvents.ts` warns on an unmapped target instead of silently `+1`.
6. **Preferences step fix** — `handleSubmitPreferences` no longer calls `saveStepAsync(1,{})` (which emitted a bogus `ONBOARD-01` form_submit). It just persists the voice/screen preference + `advance(1)`.
7. **Idempotent advance** — `useOnboardingBeat.ts`: `advance(toStep?)` uses `Math.max`, so re-tapping a frozen earlier-beat card can't rewind or skip.
8. **Mislabel fix** — `useOnboarding.ts` `STEP_TO_SCREEN_ID[6]`: `ONBOARD-BEGINNER-04` → `ONBOARD-BEGINNER-07` (reflection).

### Files touched

- `src/lib/onboarding/onboardingStepBeats.ts`
- `src/lib/onboarding/onboardingChatCards.ts`
- `src/hooks/useOnboardingBeat.ts`
- `src/hooks/useOnboardingChat.ts`
- `src/hooks/useChatToolEvents.ts`
- `src/hooks/useOnboarding.ts`
- `src/pages/onboarding/OnboardingChatPage.tsx`
- `src/generated/screen_contexts.json`

---

## 3.5 Session 2 (2026-06-23 pm) — Stage B cards + bug-fix pass

**Stage B (inline beat cards) is DONE for the beginner path.** Every beat now renders a card frozen at its opener turn. New files in `src/components/onboarding/chat/`: `PathChoiceCard`, `CategoryPickerCard`, `GoalsCard`, `HabitsCard`, `OnboardingReflectionCard`, `PlanReviewCard`. Wiring: card data types in `onboardingChatTypes.ts`; derivers in `onboardingChatCards.ts` (`buildActiveBeatCard`); `cardType` per beat in `onboardingStepBeats.ts`; API + slot in `onboardingCardRegistry.tsx`; per-beat submit handlers + shared `finalize()` in `OnboardingChatPage.tsx`.

Card→step→persistence: 2 pathChoice→`saveStepAsync(2,{},{path})`, 3 category→`(3,{category})`, 4 goals→`(4,{goals})`, 5 habits→`(5,{habitConfigs})`, 6 reflection→`(6,{reflectionConfig,…})`, 7 planReview→`finalize()`→`/home`. Advanced beats 3–5 stay `cardType:'none'` (coach-driven; advanced cards not built).

**Bug-fix pass (all verified `tsc` clean + vitest 1134 pass; only 3 pre-existing `resolveCheckinWindow` failures remain):**

- `confirm_plan` voice/typed completion now works — `confirmPlan.ts` never bumps `current_step`, so the old `current_step>7` gate never fired; `OnboardingChatPage` `confirm_plan` listener now calls `finalize()` directly.
- Advanced path un-blocked at step 4→5 — `preconditions.ts` `checkAdvanceData` case 4 is now path-aware (braindump gates on the brain dump, not `data.goals`).
- `GoalsCard`/`HabitsCard` no longer dead-end — they read the gating field (category/goals) from LIVE `useOnboarding()` state, so a late coach-captured value self-heals instead of leaving an empty card.
- `HabitsCard` restored the `habit_added` session_log + `create_habit` PostHog events (LLM state-delta).
- `advance_step` clamps with `Math.max` when `chatNative` (was bare-set → could rewind the optimistically-ahead beat).

## 3.6 Session 3 (2026-06-23 evening) — bug-fix round + Yair visual port + flow plumbing

All `tsc --noEmit` clean, vitest 1134/1137 (only the 3 pre-existing `resolveCheckinWindow` failures remain).

### A. Bug-fix round — 19 of 22 in-scope bugs closed

Spread across two multi-agent workflow passes (server / page / cards / nits + opener-ban).

- **Server**
  - `advanceStep.ts` UPSERT now `current_step = GREATEST(onboarding_states.current_step, $2)` (was bare-SET → stale LLM call could rewind).
  - `submitPathChoice.ts` UPDATE branch raises `current_step` to GREATEST(...,2) (was only on INSERT).
  - `preconditions.ts` `case 0` added (explicit null; opener-turn ban lives in `buildSystemPrompt`); `case 1` tightened to require `data.nickname && data.age != null && data.gender`; `case 4` braindump-gated on `brainDumpRaw` for the advanced path (no `data.goals` then).
  - `buildSystemPrompt.ts` `OPENER_INSTRUCTIONS` now forbids `advance_step` + every onboarding mutating tool (`submit_profile`, `submit_path_choice`, `submit_category`, `submit_goals`, `submit_brain_dump`, `submit_reflection_config`, `add_habit`, `remove_habit`, `update_habit`, `confirm_plan`, ...). Closes the Beat-0 opener-turn premature-advance hole.

- **Page (`OnboardingChatPage.tsx`)**
  - Frozen-card handler gates: `handleSubmitPreferences` no-ops when `current_step !== 0`; `handleSubmitProfile` when `> 1`; `handleSubmitPathChoice` when `> 2`. (Mirrored later for `handleSubmitAuth` → no-op when `!== 0`.)
  - `handleSubmitPreferences` writes `voiceMode: mode` (not the prescribed-but-equivalent ternary — `mode` is already typed `'voice' | 'screen'`).
  - `STEP_TO_SCREEN_ID[1]` / `[2]` corrected to `ONBOARD-01--FORM` / `ONBOARD-FORK--FORM` (`useOnboarding.ts`) so `emitFormSubmit` events match the chat-native screen the user is actually on.
  - `select_onboarding_path` PostHog event fires from both tap (`handleSubmitPathChoice`) and voice (`useOnboardingVoiceActions` `set_path` branch) — was missing.

- **Cards**
  - `PreferencesCard`: local `hasChosen` state — orb stays neutral until first tap (was rendering voice-chosen on first paint).
  - `ProfileCard`: client-side `NICKNAME_REGEX` matches server `shared.ts` exactly + inline hint when invalid; `AGE_DEFAULT = 13` seed matches the picker's visual center; per-field `touchedRef` for bidirectional self-heal (live state wins for untouched fields, user input wins for touched); `referralOtherText` round-trips via `'Other: <text>'` encoding into `referralSource` (mirrors legacy `Step1Page`).
  - `PathChoiceCard`: live-mirror `state.data.path` until user touches (was one-shot `setPlan(p ?? next)`); `coercePath` defensively coerces legacy `'advanced'` → `'braindump'` for display.

- **Generated**
  - Icon bundle regenerated (`npm run icons:bundle`) for `mdi:email-outline`, `mdi:lock-outline`, `mdi:sparkles`, `mdi:account-outline`, `mdi:pencil-outline`.
  - `screen_contexts.json` routes: `ONBOARD-AUTH--FORM → /onboarding`; PREFS removed from routes array (PREFS keeps its `screens` map entry for fallback lookup).

### B. Supabase seed — `ONBOARD-00--PREFS` upserted to prod

Hand-authored row written to prod via REST API (`SUPABASE_URL` + service role from `.env.local`):

```
screen_id: ONBOARD-00--PREFS
content_hash: hand-authored-chat-native-beat-0  (sentinel — canonical seed_contexts.py will overwrite if Sheet row ever lands)
source_row: { "Screen ID": "ONBOARD-00--PREFS", source: "hand-authored" }
version: 1
```

Bypassed `seed_contexts.py` because (a) no `GOOGLE_SHEET_ID` or service-account JSON in `.env.local`, (b) PREFS isn't in the Master Sheet (`screen_contexts.json` flagged it `source: "hand-authored"`). Backend no longer falls through to `FALLBACK_CONTEXT_BLOCK` for Beat 0.

### C. Yair visual port — chat surface adapted to `flow-builder-onboarding` mock

> **`flow-builder-onboarding` is a UI MOCK only.** That branch is 99 commits behind main with no `OnboardingChatPage.tsx`. Treat `src/components/flow-designer/FlowBuilder.tsx` as a visual reference only — never base off, never merge. Read via `git show origin/flow-builder-onboarding:src/components/flow-designer/FlowBuilder.tsx`.

What shipped (multi-agent workflow passes):

- **New: AUTH beat at step 0** — replaces PREFS in the chat sequence. PREFS screen_id, Supabase row, bundle entry, and `PreferencesCard.tsx` are PRESERVED but no longer reachable through `beatForStep`.
  - `beatForStep(0, _)` returns `{ step: 0, screenId: 'ONBOARD-AUTH--FORM', cardType: 'auth' }`.
  - `SCREEN_TO_STEP['ONBOARD-AUTH--FORM'] = 0`; `['ONBOARD-00--PREFS'] = 0` kept for legacy.
  - `screen_contexts.json`: bundled `ONBOARD-AUTH--FORM` with hand-authored context_block (FLOW: "Stay silent"; FORBIDDEN: all data-capture tools — safety net if AI ever un-silences without a real signup wired).

- **New: `AuthSignupCard.tsx`** — VISUAL SHELL ONLY. Mirrors Yair's `AuthSignup()` (FlowBuilder.tsx:407-463) verbatim: "Create an Account" / "Welcome back" heading, "Your AI coach is ready" subtitle, Apple (`variant="social-dark"`) + Google (`variant="social-light"`, multi-color G) `size="auth"` buttons, "or continue with email" divider, email + password `OnboardingInput`, primary "Sign Up" / "Log In" CTA, "Already have an account? Log In" footer link toggles mode. Every CTA → `api.submitAuth?.()` → `handleSubmitAuth` → `advance(1)`. **No real Supabase wiring.** Password field is plaintext because `OnboardingInput` has no `type` prop — flagged.

- **New: `STATIC_FEED_MODE` silence switch** (`src/lib/onboarding/staticFeed.ts`):

  ```ts
  export const STATIC_FEED_MODE = import.meta.env.VITE_ONBOARDING_STATIC_FEED === 'true';
  ```

  Add `VITE_ONBOARDING_STATIC_FEED=true` to `.env.local` (already added) and **restart the dev server** (Vite reads env at boot). Gated sites:
  - `useOnboardingChat.ts` opener-seeding effect: early-return when `STATIC_FEED_MODE && chatNative` (no `/api/llm` opener fetch, no coach message seeded).
  - `useChatToolEvents.ts` tool-event dispatch: early-return on same condition (no `advance_step` / `submit_*` / `confirm_plan` fires from voice).
  - `OnboardingChatPage` `useOnboardingVoiceActions` callback: early-return on `STATIC_FEED_MODE`.
  - **The `chatNative` partial is intentional** — overlay surfaces (check-in, coach) share these hooks and MUST NOT be silenced by the flag.

- **Page layout overhaul** (`OnboardingChatPage.tsx`):
  - When `STATIC_FEED_MODE`, renders a local `<StaticFeed>` instead of the `messages.map` chat-bubble feed.
  - StaticFeed = vertical stack of beats 0..current_step. Each beat = `<div className="w-full max-w-md">` inside parent `<div className="flex w-full flex-col items-center gap-12 py-12">`. **Cards are content-height, NOT `min-h-screen`** (that was an early misread of "full-screen centered" and was corrected).
  - `activeBeatRef` (`HTMLDivElement | null`) + `scrollIntoView({ block: 'center' })` on `current_step` change brings the active beat into the viewport center.
  - **`ChatComposer` REMOVED** from the page bottom (user request). `draft` state + `handleSendText` callback removed with it. Restore both blocks at the bottom of OnboardingChatPage if a text input ever needs to come back.
  - **Untouched:** background gradient + backdrop-blur layers, `OrbControls` at the bottom.

- **Card chrome stripped** (matches Yair's bare-component preview pattern):
  - All 7 cards in `src/components/onboarding/chat/` (`AuthSignup`, `Profile`, `PathChoice`, `CategoryPicker`, `Goals`, `Habits`, `OnboardingReflection`, `PlanReview`) no longer wrap in `<Card>` or `<OnboardingSection>`. Each is a bare `<div className="flex w-full max-w-md flex-col gap-3">` containing real existing primitives (`OnboardingInput`, `ChipSelect` with `columns={3}`, `AgeScrollPicker`, `SelectionCard`, `CategoryCard`, `GoalCard`, `HabitPickerPanel`, `DailyReflectionCard`, `PlanSummaryCard`).
  - All `<OnboardingHeader>` blocks removed from the 7 cards (the titles/subtitles I had written were placeholder copy — Yair's mock has no per-beat headers). **Per-beat coach copy will arrive via chat bubbles when Yair sends the cleaned per-beat context.**
  - `AuthSignupCard` KEEPS its internal "Create an Account" / "Your AI coach is ready" text — those are Yair's verbatim copy inside the card body, not invented.

- **Single-select beats auto-advance** — `PathChoiceCard` and `CategoryPickerCard` dropped their Continue button. Tap a `SelectionCard` / `CategoryCard` → submit handler fires immediately. Multi-select beats (Profile, Goals, Habits, Reflection, Plan) still have their primary CTA because confirmation is needed.

- **Cache-race fix: `handleSubmitCategory` + `handleSubmitGoals`** now seed cache optimistically with `qc.setQueryData(queryKeys.onboarding.state, prev => prev ? { ...prev, data: { ...prev.data, key } } : prev)` BEFORE `advance(N)`. Previously they only called `void saveStepAsync(...)` — the next beat's card (Goals reads `state.data.category`, Habits reads `state.data.goals`) returned `null` mid-render because the cache hadn't updated yet, looking like "the flow stops after category". The path-choice handler already did this; category + goals now match the pattern.

### Files touched in Session 3

- Server: `api/_lib/llm/buildSystemPrompt.ts`, `api/_lib/llm/onboarding/preconditions.ts`, `api/_lib/llm/onboarding/handlers/advanceStep.ts`, `api/_lib/llm/onboarding/handlers/submitPathChoice.ts`, `api/_lib/llm/onboarding/__tests__/handlers.test.ts` (test updates for new GREATEST assertions).
- Lib: `src/lib/onboarding/staticFeed.ts` (NEW), `src/lib/onboarding/onboardingStepBeats.ts`, `src/lib/onboarding/onboardingChatCards.ts`, `src/lib/onboarding/onboardingChatTypes.ts`.
- Page: `src/pages/onboarding/OnboardingChatPage.tsx`, `src/hooks/useOnboardingChat.ts`, `src/hooks/useChatToolEvents.ts`, `src/hooks/useOnboarding.ts`.
- Cards: `src/components/onboarding/chat/AuthSignupCard.tsx` (NEW), `PreferencesCard.tsx`, `ProfileCard.tsx`, `PathChoiceCard.tsx`, `CategoryPickerCard.tsx`, `GoalsCard.tsx`, `HabitsCard.tsx`, `OnboardingReflectionCard.tsx`, `PlanReviewCard.tsx`, `onboardingCardRegistry.tsx`.
- Generated: `src/generated/screen_contexts.json`, `src/generated/icon-bundle.json`.
- Env: `.env.local` got `VITE_ONBOARDING_STATIC_FEED=true`.

---

## 4. Remaining work

### Closed (no longer open)

- ~~Seed `ONBOARD-00--PREFS` into Supabase `screen_contexts`~~ — done (hand-authored row in prod, sentinel hash so canonical seed will overwrite when Sheet row is authored).
- ~~`advance_step` server-side rewind via bare-SET~~ — GREATEST clamp shipped.
- ~~Beat-0 opener-turn premature advance~~ — `OPENER_INSTRUCTIONS` ban shipped.
- ~~Most card-tap state-data race~~ — `handleSubmitCategory` / `handleSubmitGoals` now seed cache like `handleSubmitPathChoice` did.
- ~~Past (frozen) cards re-firing~~ — handler-level gates on each submit (`current_step > beat.step` → no-op).

### Open — visual / copy (waiting on product)

- **Yair's cleaned per-beat context** (he's authoring "a sharp general context plus per-beat contexts"). When it lands:
  1. Render chat bubbles in the feed BEFORE each card section (one bubble per beat with the coach copy from his packet). Static seeding via `useOnboardingChat` is the cleanest hook (same surface that's silenced today by `STATIC_FEED_MODE && chatNative`; un-silence the seed step but keep the LLM call silenced).
  2. Update `screen_contexts.json` + Supabase `screen_contexts` for each beat (especially `ONBOARD-AUTH--FORM`, which is hand-authored placeholder today).

### Open — auth wiring (AuthSignupCard is a visual shell)

- Apple, Google, Email + password buttons currently → `api.submitAuth?.()` → `advance(1)`. No Supabase call.
- Real wiring:
  1. Apple / Google: existing handlers in `src/api/auth/` (signInWithApple, signInWithGoogle) — call from inside `AuthSignupCard`.
  2. Email + password: needs Supabase signUp/signIn call; respect existing email-callback redirect flow (`/auth/callback`).
  3. `OnboardingInput` needs a `type="password"` prop so the password input masks — currently plaintext.
  4. **`AppGate` widening:** `/onboarding` is gated `allow="onboarding"` which requires an authed user. For AuthSignup to actually be the auth entry point, the gate must allow unauthed users on `/onboarding` (or a new `/start` route renders the same page without the gate).

### Open — structural splits Yair's `DEFAULT_FLOW` implies (deferred from Session 3)

- Yair's flow-builder DEFAULT_FLOW: `auth-signup → coach-bubble → profile-input → age-picker → gender-chips → path-selection → category-grid → ...`. Profile is **three sequential beats**, not one combined card. We kept the combined `ProfileCard` for now (smaller refactor). If Yair confirms he wants three beats, split:
  - `beatForStep(1)` → `nickname` (just `OnboardingInput`)
  - `beatForStep(2)` → `age` (just `AgeScrollPicker`)
  - `beatForStep(3)` → `gender` (just `ChipSelect` + referral)
  - Renumber every downstream step + update preconditions accordingly.

### Open — deferred Session 3 bugs (NOT fixed)

- **Card-tap progress not durably persisted one step.** `saveStep(N)` raises server `current_step` to N while the cache optimistically shows N+1. A mid-onboarding RELOAD replays the just-completed beat (recoverable; card pre-fills). Clean fix collides with the `form_submit` screen-label in `emitFormSubmit` — needs a decision before touching `saveStep`.
- **Advanced reflection completeness:** `confirm_plan` requires `data.reflectionConfig`; the chat advanced flow may never capture it → `confirm_plan_too_early`.
- **`confirm_plan` offered on every beat** (no per-screen tool gating in `registry.ts`); defended by fail-closed preconditions, low priority.
- **`HabitsCard` selection live-sync:** a coach `add_habit` mid-chat updates `habitConfigs` in state but the card's local selection (frozen) won't reflect it.
- **`submitProfile` ON CONFLICT can't clear a field** (JSONB `||` concat). Edge case.
- **`OnboardingPath` type still allows legacy `'advanced'`** (`packages/shared/src/types/index.ts:221`). The chat-native flow only emits `simple|braindump`; legacy advanced/\* pages still reference `'advanced'`. Display-coerced at the card boundary; narrowing the union is a multi-file cascade — deferred.

### Open — Stage B (advanced-path cards, never built)

Braindump beats 3-5 (`ONBOARD-ADVANCED`/`-02`/`-04`) are still `cardType: 'none'` (coach-driven only). Build BrainDump (`GoalTextarea`) + ParsedPlan cards if the advanced path needs visual surfaces; otherwise the coach drives them.

### Open — Stage C (conversational voice)

"Talk to me" stores the preference but mic stays off — the conversational loop is not lifted yet. Bring the coach loop (`src/hooks/useCoachChat.ts` + `tts-service.ts` chunked `beginSpeechTurn`/`pushSpeechChunk`/`endSpeechTurn`, `sentenceChunks.ts`, `turnDecision.ts`, barge-in `interruptTts`, mic-mute-during-playback) into onboarding. Prefer extracting a shared turn-loop hook over duplicating.

**When Stage C lands or AI is otherwise re-enabled:** flip `VITE_ONBOARDING_STATIC_FEED=false` (or remove the env var). The silencing layers off cleanly — every gated site falls through to the existing LLM/voice path.

---

## 5. How to test

- Run the API/dev server: `CHOKIDAR_USEPOLLING=true WATCHPACK_POLLING=true npm run dev:api` (serves both frontend + `/api` on `http://localhost:3000`). Consider adding the two env vars to `~/.zshrc`.
- **Confirm the silence flag is set** in `.env.local`: `VITE_ONBOARDING_STATIC_FEED=true`. Restart the dev server after editing — Vite reads env at boot, not on hot reload.
- Verify: `npx tsc --noEmit` (must be clean), `npx vitest run` (only the 3 `resolveCheckinWindow` failures are expected/pre-existing).
- Manual (static-feed mode, today):
  1. Log in with an in-onboarding account → land on **`/onboarding`**.
  2. **Beat 0 (AUTH):** see `AuthSignupCard` centered in the viewport (gradient bg + bottom orb still visible; no `ChatComposer` at the bottom). Tap **any** of Apple / Google / "Sign Up" / "Continue with email" → advances to Beat 1.
  3. **Beat 1 (Profile):** nickname + age picker + gender chips + referral chips. Fill all required → tap "Continue".
  4. **Beat 2 (Path):** tap a `SelectionCard` (sparkles or lightning) → advances IMMEDIATELY (no Continue button).
  5. **Beat 3 (Category):** tap a `CategoryCard` → advances immediately. **If this step appears to dead-end, the cache-race fix in `handleSubmitCategory` regressed** — `state.data.category` must be seeded BEFORE `advance(4)` or `GoalsCard` returns null.
  6. **Beat 4 (Goals):** select up to 2 → "Continue".
  7. **Beat 5 (Habits):** pick habits per goal → "Continue".
  8. **Beat 6 (Reflection):** configure → "Continue".
  9. **Beat 7 (Plan Review):** "Start plan" / "Looks good" → `/home`.
- Past (frozen) beats stay in scrollback. Re-tapping a past card is a no-op — handler gates on `current_step > beat.step`.
- **What you should NOT see in static mode:** any coach chat bubble, any LLM call in the network tab, any voice activity from the orb. The orb stays in its idle gradient.

---

## 6. Key gotchas (don't relearn the hard way)

### Original gotchas (Sessions 1+2)

- Backend reads screen context from **Supabase**, frontend from the **bundle** (`src/generated/screen_contexts.json`). They can drift.
- Direct-LLM nav tool is **`advance_step`** (server-persisted), not `navigate_next`. Vapi uses `navigate_next`.
- The plan-review beat is `ONBOARD-BEGINNER-06` / `ONBOARD-ADVANCED-05`, NOT `STARTING-PLAN` (no opener there).
- `chatEnabled` requires the screenId to `startsWith('ONBOARD-')` — keep beat screenIds in that namespace.
- Cards used to be derived/stored **per-message** (frozen at opener turn) when AI drove the feed. In static mode the page derives cards directly from `beatForStep(s, path)` per render, no message frozen state — see Session 3 gotchas below.
- Don't increase the DB pool `max:1`; always scope user-data queries by `WHERE anon_id = $1` (RLS is bypassed by the service role).

### Session 3 gotchas (the easy way to break things now)

- **`STATIC_FEED_MODE` is the silence switch.** `src/lib/onboarding/staticFeed.ts` reads `VITE_ONBOARDING_STATIC_FEED === 'true'`. Default false. The flag must be set in `.env.local` AND the dev server restarted — Vite reads env at boot, not on hot reload. The hooks gate on `STATIC_FEED_MODE && chatNative` (not on `STATIC_FEED_MODE` alone) because `useOnboardingChat` / `useChatToolEvents` are SHARED with overlay surfaces (check-in, coach chat). Silencing those globally would break check-in.

- **Beat 0 is AUTH, not PREFS.** `beatForStep(0, _)` returns AUTH. `ONBOARD-00--PREFS` is still in the bundle + Supabase + as a `SCREEN_TO_STEP` entry (legacy compatibility), but no longer reachable through `beatForStep`. `PreferencesCard.tsx` is dead but not deleted — leave it.

- **AuthSignupCard is a VISUAL SHELL.** Every button → `api.submitAuth?.()` → `handleSubmitAuth` → `advance(1)`. No Supabase signup call. Real auth wiring is a future phase. Password input is plaintext (`OnboardingInput` has no `type` prop — needs primitive change).

- **Card-handler optimistic cache pattern.** When a beat's submit handler advances to the next beat, it MUST seed gating fields in the cache BEFORE calling `advance(N)`. The next beat's card reads `useOnboarding().state.data.X` and returns `null` if `X` is missing → flow appears stuck (this is the "stops after category" bug from Session 3). Pattern:

  ```tsx
  qc.setQueryData<OnboardingState | null>(queryKeys.onboarding.state, (prev) =>
    prev ? { ...prev, data: { ...prev.data, key: value } } : prev,
  );
  advance(N);
  void saveStepAsync(...);
  ```

  Already applied to `handleSubmitPathChoice`, `handleSubmitCategory`, `handleSubmitGoals`. Add to any future single-field beat handler.

- **No `<Card>` / `<OnboardingHeader>` / `<OnboardingSection>` wrappers on chat cards.** Yair's mock uses bare components in a `flex flex-col gap-3` column. Per-beat titles are intentionally absent — coach copy will come via chat bubbles once Yair sends cleaned per-beat context. Don't add headers back as placeholders.

- **No `min-h-screen` per beat.** That was an early misread of "full-screen centered" and was corrected. The `StaticFeed` renders beats at content height in a `gap-12 py-12` parent. Active beat scrolls into view via `scrollIntoView({ block: 'center' })`.

- **No `ChatComposer` at the bottom of `OnboardingChatPage`.** Removed at user request. If text input ever needs to come back, restore the JSX block + `draft`/`setDraft` state + `handleSendText` callback (was around old line 377). The `ChatComposer` import was also removed.

- **Single-select cards (`PathChoiceCard`, `CategoryPickerCard`) auto-advance on select.** No Continue button. If you add new single-select beats, follow the same pattern (`onSelect={() => api.submitX?.(value)}`); don't add a Continue button unless the card is multi-select or needs explicit confirmation.

- **Page-layout `activeBeatRef`** is typed `HTMLDivElement | null` (was `HTMLElement | null`). Don't widen it back — `scrollIntoView` typing depends on it.

- **Hand-authored `screen_contexts` rows have `content_hash: 'hand-authored-*'` sentinels.** The canonical `seed_contexts.py` will overwrite them on next sheet sync (the hash mismatch triggers an upsert). Don't change the sentinel to a real hash — that defeats the auto-overwrite.

- **`OPENER_INSTRUCTIONS` bans `advance_step` and every onboarding mutating tool on the opener turn** (`api/_lib/llm/buildSystemPrompt.ts`). When adding new onboarding tools, add them to that forbidden list to maintain the opener-turn invariant.

- **`OnboardingPath` type still includes legacy `'advanced'`** (`packages/shared/src/types/index.ts`). Chat-native only emits `simple|braindump`. `PathChoiceCard.coercePath` and `OnboardingChatPage.handleSubmitPathChoice` defensively coerce `'advanced'` → `'braindump'`. Don't remove the coercion; legacy advanced/\* pages still reference `'advanced'` directly.

- **Frontend bundle vs Supabase route map.** `screen_contexts.json` has TWO sections: `screens` (map of screen_id → context) and `routes` (array of `{screen_id, route}`). The `routes` array must have unique route values (a vitest asserts this). When changing route ownership (e.g. AUTH now owns `/onboarding`), either remove the prior owner's entry or move it to a different route — don't leave both.
