# Voice-Driven Onboarding via Flow 3 (transcript → process-command → form fill)

**Date:** 2026-05-22
**Scope:** All onboarding pages (beginner Steps 1–9, advanced flow, plan review). Path 1 onboarding voice transport (Vapi) is untouched.
**Status:** Design approved 2026-05-22. Implementation plan TBD.

---

## Goal

Let the user speak any field value, on any onboarding screen, at any time, and have the form fill. Same UX whether or not the onboarding chat overlay is open.

## Decision: Flow 3, not Vapi tool calling

Three architectures were considered:

1. **Server-tool calling** — Vapi LLM emits tool calls → webhook → DB writes → Supabase Realtime → UI. Highest latency, most new infrastructure.
2. **Client-tool calling** — Vapi LLM emits tool calls → SDK `message` event → browser fills form. Initially picked, then rejected on 2026-05-22 after verifying Vapi's SDK types (`@vapi-ai/web/dist/api.d.ts:1738`): `async: true` still requires a `server.url` on every function tool. There is no purely-browser tool delivery path.
3. **Transcript → `/api/process-command` → form fill** — Vapi acts as STT+TTS+chat LLM only. Frontend POSTs the user's transcript to a small backend LLM that parses intent and returns a structured action. Browser fills the form. **Already wired on `Step1Page.tsx`.**

Picked (3). Reasons:

- Reference implementation works today on Step 1.
- Zero Vapi assistant config changes — no dashboard surgery, no public webhook, no `/api/vapi-tool` to build.
- Backend `/api/process-command` already exists; we extend its prompt, not its surface.
- Latency cost (~200–500 ms for the parsing LLM) is hidden behind Vapi's own ~500–1500 ms first-audio latency — the form fills around the time Vapi starts speaking, perceived as simultaneous.

What we give up: the LLM can't act without an utterance (no silent tool calls). Onboarding never needs that.

## Architecture (existing pipeline + extensions)

```
User speaks
   ↓
Vapi STT → user transcript
   ↓
useRealtimeVoice subscribeTranscripts → OnboardingVoiceProvider fans out
   ↓
OnboardingChatOverlay (or any subscriber) → useOnboardingVoice.processTranscript()
   ↓
POST /api/process-command  { transcript, onboarding_context: {step, screen_id, options, prompt, focusedField} }
   ↓
buildOnboardingPrompt(ctx) → GPT-4o-mini → returns {action, params, confidence, message}
   ↓
OnboardingLayout.handleVoiceAction → page-level onVoiceAction(result)
   ↓
Page switches on result.action → setNickname / setCategory / addHabit / etc.
   ↓
User presses Continue → existing saveStep() / complete() persists to onboarding_states
```

No new infrastructure. The hooks, components, and endpoints already exist. We extend the **action vocabulary** of `process-command` and add `onVoiceAction` handlers to 13 more pages.

## Action vocabulary (the contract)

`/api/process-command` returns one of these on an onboarding screen:

| Action                  | When the LLM should emit it                          | Params                                                                    | Pages                                                                                                        |
| ----------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `fill_field`            | User volunteers a value for a text/number input      | `{fieldName: string, value: string}`                                      | Step 1 (nickname, age, referralOtherText), AdvancedInput (brainDumpText), AdvancedCustomPrompts (per prompt) |
| `select_option`         | User picks one from a chip set                       | `{fieldName: string, value: string}`                                      | Step 1 (gender, referralSource), Step 2 (path), Step 3 (category), AdvancedStep6 (reflectionSchedule)        |
| `select_multiple`       | User picks multiple chips at once                    | `{fieldName: string, values: string[]}`                                   | Step 4 (goals)                                                                                               |
| `add_habit`             | "I want to meditate at 7am daily"                    | `{name: string, days?: number[], time?: string, reminder?: boolean}`      | Step 5, AdvancedResults (edit), EditHabitPage                                                                |
| `update_habit`          | "change meditation to 8am"                           | `{name: string, patch: Partial<HabitConfig>}`                             | Step 5, AdvancedResults                                                                                      |
| `remove_habit`          | "drop the reading one"                               | `{name: string}`                                                          | Step 5, AdvancedResults                                                                                      |
| `set_reflection_config` | "remind me Sundays at 7pm"                           | `{time?: string, days?: number[], reminder?: boolean, schedule?: string}` | Step 6, AdvancedStep6, EditJournal                                                                           |
| `set_path`              | "I'll do it myself" / "use brain dump"               | `{value: 'simple' \| 'braindump'}`                                        | Step 2                                                                                                       |
| `confirm_plan`          | "looks good, start"                                  | `{}`                                                                      | PlanReviewPage                                                                                               |
| `navigate_next`         | "continue" / "next" (when current screen accepts it) | `{}`                                                                      | All — implemented as router navigate in handler                                                              |

**Action selection rule:** the LLM picks one action per utterance. If the user packs multiple field values into one breath (rare in chip-driven screens, common on Step 1), the LLM picks the highest-value action; the user re-speaks the rest or fills via tap. (We do not return arrays of actions — that's a structural change to the existing `OnboardingVoiceResult` shape.)

**Return shape (unchanged):**

```ts
interface OnboardingVoiceResult {
  success: boolean;
  action: string;
  params: Record<string, unknown>;
  message: string;
  confidence: number;
}
```

Confidence-gating in `useOnboardingVoice.ts:91–100` already drops <0.5 and gives a step-specific fallback. Reuse the existing branch; add fallbacks for new screens in the same lookup.

## `process-command` prompt structure

Today (`api/process-command.ts:272–`): `buildOnboardingPrompt(ctx)` interpolates `{step, options, prompt, focusedField}`. The system prompt has per-step blocks (`### Step 1: Demographics`, `### Step 2: Path Selection`, …) that describe what params to return.

**Changes:**

1. Add `screen_id` to the context payload (`useOnboardingVoice.ts:73–80` callsite + `process-command.ts:273` reader). Lets us key off the canonical screen id instead of a raw integer step, which is robust to advanced-flow detours.
2. Rewrite the step-specific blocks as **screen-specific blocks** keyed by `screen_id`. One block per screen, listing:
   - Valid actions on this screen
   - Field names and enums (the contract the page expects)
   - 2–3 example utterance → JSON pairs (the existing pattern, kept terse)
3. Keep the focused-field section as-is — it remains the disambiguation hint for text inputs (`process-command.ts:281–289`).
4. Strip per-screen fallback prose from the system prompt if it grows — the response `message` field is for spoken UX, not parsing.

Token budget: each screen block ~80–150 tokens. 14 screens ~1.5–2k tokens added. GPT-4o-mini handles 128k input — well within budget. Per-call cost stays at fractions of a cent.

## Per-page work

Each page below gets a `handleVoiceAction(result: OnboardingVoiceResult)` callback passed to `OnboardingLayout`'s `onVoiceAction` prop (mirroring `Step1Page.tsx:47–52`). The callback switches on `result.action` and routes to the page's state setters or React Query mutations.

| Page                      | Screen ID            | Actions to wire                                                                                      | Notes                                                                                                                                       |
| ------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Step1Page                 | ONBOARD-01--FORM     | fill_field (nickname, age, referralOtherText), select_option (gender, referralSource), navigate_next | **Already wired** for nickname; extend to other fields                                                                                      |
| Step2Page (shared)        | ONBOARD-02--PATH     | set_path, navigate_next                                                                              | Path determines beginner vs advanced fork                                                                                                   |
| Step3Page (beginner)      | ONBOARD-03--CATEGORY | select_option (category), navigate_next                                                              | Chip select                                                                                                                                 |
| Step4Page (beginner)      | ONBOARD-04--GOALS    | select_multiple (goals), navigate_next                                                               | 1–2 picks                                                                                                                                   |
| Step5Page (beginner)      | ONBOARD-05--HABITS   | add_habit, update_habit, remove_habit, navigate_next                                                 | Most complex; LLM emits one habit per turn                                                                                                  |
| Step6Page (beginner)      | ONBOARD-06--REFLECT  | set_reflection_config, navigate_next                                                                 | Partial patches OK ("Sundays at 7" → days+time only)                                                                                        |
| AdvancedInputPage         | ONBOARD-ADV-INPUT    | fill_field (brainDumpText), navigate_next                                                            | Brain-dump textarea; voice fills it directly                                                                                                |
| AdvancedResultsPage       | ONBOARD-ADV-RESULTS  | update_habit, remove_habit, navigate_next                                                            | AI-generated habits are editable                                                                                                            |
| AdvancedStep6Page         | ONBOARD-ADV-STEP6    | set_reflection_config, select_option (reflectionSchedule), navigate_next                             |                                                                                                                                             |
| AdvancedCustomPromptsPage | ONBOARD-ADV-CUSTOM   | fill_field (per-prompt index), navigate_next                                                         | Index encoded in fieldName as `customPrompts[0]`, `customPrompts[1]`, … (square-bracket form; page handler parses the index off the string) |
| EditHabitPage             | (modal)              | update_habit, navigate_next (back)                                                                   | Returns via location.state                                                                                                                  |
| EditJournalPage           | (modal)              | set_reflection_config, navigate_next (back)                                                          | Returns via location.state                                                                                                                  |
| PlanReviewPage            | ONBOARD-07--REVIEW   | confirm_plan (→ triggers existing `complete()` mutation), navigate_next                              | navigate_next here = go back                                                                                                                |

Per-page diff is ~20–40 lines: import `OnboardingVoiceResult`, add the handler, pass to `<OnboardingLayout onVoiceAction={...} />`.

## Chip select integration

Chip selects (`ChipSelect.tsx`) don't have focused inputs, so the `data-voice-field` / `useFocusedFieldContext` mechanism doesn't reach them. Two ways to bridge:

1. **Add `data-voice-field` to the chip wrapper** — extends focus-tracking to chips. Requires DOM focus on the chip group, which conflicts with the chip-tap UX (chips don't claim focus normally).
2. **Let the LLM read `screen_id` and emit `select_option` with the right `fieldName`** — no DOM focus signal needed. The page's `onVoiceAction` handler uses `fieldName` to disambiguate (`gender` vs `referralSource` on Step 1).

**Picked (2).** Cleaner, no DOM-focus contortions, generalizes to multi-chip and add/remove patterns. `ChipSelect` itself stays unchanged.

`data-voice-field` stays on text inputs (`OnboardingInput.tsx:28`) — it's still the disambiguation hint for the LLM when multiple text inputs coexist on one screen (Step 1: nickname + age + referralOtherText).

## Screen context updates

Each screen's `context_block` in `src/generated/screen_contexts.json` gains a **VOICE_ACTIONS** appendix. Format:

```
VOICE_ACTIONS (this screen):
- select_option(field='category', enum=['Focus', 'Energy', 'Sleep', ...])
- navigate_next when user says 'continue' / 'next' / 'let's go'
```

Two-step rollout:

1. **Hand-edit `screen_contexts.json`** for the first 2–3 screens to prove the pattern. Direct file edits, no Sheet involvement.
2. Once the appendix format is stable, **add a "Voice Actions" column to the Master Sheet** and extend `scripts/voice-sync/seed_contexts.py` to read it. Yair owns the Sheet edits going forward.

The context block is also pushed to Vapi via `OnboardingVoiceProvider.pushScreenContext()`. The new VOICE_ACTIONS appendix will sit in Vapi's system prompt too — harmless (Vapi LLM ignores it; we're not registering Vapi tools), and arguably useful (Vapi LLM can verbally guide the user toward sayable options).

## Rollout order

Each step is independently shippable and verifiable in the deployed app.

1. **Extend `/api/process-command` system prompt + unit tests** with the new action vocabulary. No UI changes. Verify by curl-ing the endpoint with example transcripts.
2. **Step 3 (chip-select POC)** — wire `onVoiceAction`, hand-edit `screen_contexts.json` for `ONBOARD-03--CATEGORY`. End-to-end test: say "I want to focus on sleep" on Step 3, expect category chip selected.
3. **Step 1 extension** — add `select_option` handling for gender + referralSource alongside existing nickname `fill_field`.
4. **Step 4 (multi-select), Step 2 (path)** — add `select_multiple`, `set_path`.
5. **Step 5 (habits)** — most complex; add_habit / update_habit / remove_habit. Each turn handles one habit.
6. **Step 6 (reflection), advanced reflection** — `set_reflection_config` with partial patches.
7. **Advanced flow** — AdvancedInput, AdvancedResults, AdvancedStep6, AdvancedCustomPrompts.
8. **PlanReview** — `confirm_plan` triggers `complete()`.
9. **Sheet sync** — once the VOICE_ACTIONS column is stable, move from hand-edits to Master Sheet → seed script.

Each step is a separate PR. Don't batch.

## Persistence & save semantics (unchanged)

Voice fills React state. The user (or `navigate_next` action) triggers the existing **Continue button** → `saveStep(n, {...})` → `/api/onboarding` PUT → `onboarding_states.data` jsonb merge. Final commit (`/api/onboarding/complete`) explodes `habitConfigs` into `user_habits` and copies profile fields to `profiles`.

No new persistence paths. No backend writes from `process-command`. No Supabase Realtime subscriptions. Form state lives in React only between Continue presses — same as today.

## Out of scope

- Vapi assistant config changes.
- The `fill_field` Vapi tool the user created in the dashboard on 2026-05-22 — leave it; don't attach it to the assistant. Delete later or repurpose for a future server-tool effort.
- `api/_lib/llm/tools.ts` — used by `/api/llm` (Path 3 text chat); unaffected.
- A `/api/vapi-tool` webhook.
- Multi-action utterances (LLM returns one action per turn).
- Voice-driven onboarding once the user is past onboarding (post-MVP).

## Verification (manual, per screen)

For each screen wired:

1. Open the screen with mic on.
2. Speak a representative utterance from the VOICE_ACTIONS list.
3. Confirm: form state updates within ~1s, before or roughly as Vapi finishes its spoken reply.
4. Press Continue (or say "continue") → next screen loads with the data persisted in `onboarding_states.data`.
5. Refresh the screen mid-flow → form rehydrates from `onboarding_states.data` (proves persistence).

For multi-field screens, run the test once per field. For chip selects, test both spoken name ("male") and spoken phrase ("I'm a guy").

## Risks

- **LLM picks wrong action on chip-heavy screens** with overlapping vocabulary (Step 1 has both `gender` and `referralSource` chip sets). Mitigation: explicit field-name disambiguation in the per-screen prompt block; tests with adversarial transcripts.
- **`add_habit` is a structural rather than free-form change** — the LLM has to emit a typed object, not a string. Examples in the prompt drive accuracy; budget for prompt tuning.
- **VOICE_ACTIONS prose drift** between `screen_contexts.json` and the page's actual `onVoiceAction` handler. Mitigation: keep the list in the spec for each screen; reconcile in code review.
- **Confidence threshold (<0.5 → fallback)** may be too strict for novel screens — calibrate per screen if false-rejects show up in testing.

## Open questions (none blocking)

- Once Step 1 has both `fill_field` (nickname/age/referralOtherText) and `select_option` (gender/referralSource), should the legacy "extract three fields at once" prose in `process-command.ts:313–316` be removed, or kept as a hybrid until validated? Recommend: remove during step 3 of rollout once the new vocabulary proves out.
- Do we want voice-driven `navigate_next` to require a positive confirmation utterance ("yes, continue") or accept implicit advance after a successful fill ("my nickname is Sam" → fills + advances)? Recommend: explicit only, to avoid surprise advances.

## File touch list (preview for the implementation plan)

- `api/process-command.ts` — replace step-block prose with screen-block prose; add new actions
- `src/hooks/useOnboardingVoice.ts` — pass `screen_id` in context; extend fallback table
- `src/generated/screen_contexts.json` — append VOICE_ACTIONS per onboarding screen
- `src/pages/onboarding/shared/Step1Page.tsx` — add select_option handlers
- `src/pages/onboarding/shared/Step2Page.tsx` — add handler (currently none)
- `src/pages/onboarding/beginner/Step3Page.tsx` — POC for chip select
- `src/pages/onboarding/beginner/Step4Page.tsx` — add multi-select handler
- `src/pages/onboarding/beginner/Step5Page.tsx` — habit CRUD handlers
- `src/pages/onboarding/beginner/Step6Page.tsx` — reflection-config handler
- `src/pages/onboarding/advanced/AdvancedInputPage.tsx` — fill_field for brainDumpText
- `src/pages/onboarding/advanced/AdvancedResultsPage.tsx` — update_habit / remove_habit
- `src/pages/onboarding/advanced/AdvancedStep6Page.tsx` — reflection-config handler
- `src/pages/onboarding/advanced/AdvancedCustomPromptsPage.tsx` — indexed fill_field
- `src/pages/onboarding/advanced/EditHabitPage.tsx` — update_habit handler
- `src/pages/onboarding/advanced/EditJournalPage.tsx` — reflection-config handler
- `src/pages/onboarding/shared/PlanReviewPage.tsx` — confirm_plan handler
- `api/_lib/llm/__tests__/process-command.test.ts` (new or existing) — per-screen parsing tests

Implementation plan to follow in a separate document.
