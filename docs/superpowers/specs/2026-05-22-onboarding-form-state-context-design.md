# Form-State Context for Vapi + process-command — Design Plan

**Date:** 2026-05-22
**Status:** Design proposal (not yet implemented)
**Prereq:** `2026-05-22-voice-driven-onboarding-flow-3-design.md` — this plan extends it.

---

## Problem

Both LLMs in the onboarding loop are blind to what the user has already entered.

- **Vapi (the live coach)** — receives the static `screen_contexts.json` block + a session-log-derived `state_delta` (events since last push), but **no view of `onboarding_states.data`**. So Vapi:
  - Greets the user as "there" on Step 2 even though Step 1 just captured a name.
  - Re-asks for fields that are already filled.
  - Has no continuity across screen transitions — every screen feels like a cold start.

- **`/api/process-command` (the parser)** — receives `step`, `screen_id`, `options`, `prompt`, `focusedField`, and the raw transcript. It has **no idea which fields on the current screen are already populated**. So:
  - Multi-field utterances like "I'm 28, male" on a screen where `age` is already filled will sometimes pick `fill_field age` again (overwrites with the same value, wasted turn) instead of `select_option gender Male` (the actually-empty field).
  - When the user says "what did I say my name was?", the parser can't answer — there's no state.
  - The recently-shipped STT-noise race (Male → Other) is partly mitigatable here: if the LLM knows gender was just set to Male, it can refuse the noisy "Other" with low confidence.

This was missed in the original Flow 3 spec — the spec assumed page-local React state would be enough, but the React state is in the **browser**, not the LLM's prompt.

## Goal

Give both consumers a reliable view of:

1. **Current page** — fields already filled (including in-flight, not-yet-saved React state).
2. **Prior pages** — everything persisted in `onboarding_states.data` so the AI can reference Step 1's name on Step 5.

Keep latency low (no per-keystroke DB writes), keep the consumer prompts focused (don't dump 5K tokens), and keep the existing state_delta / session_log architecture intact (don't fork it).

## Two consumers, two paths

| Consumer                     | How it gets context today                                                                                                                               | How it should get form state                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Vapi (live)**              | `add-message` system push via `pushScreenContext` on session start + each screen change; carries `screen_contexts.json` block + session_log state_delta | Same `add-message` push gets a new `FILLED FORM STATE` section prepended/appended to the context body |
| **process-command (parser)** | POST body `onboarding_context: {step, screen_id, options, prompt, focusedField}`                                                                        | Same POST body gets a new `filled_fields` key with the current snapshot                               |

Both consume the **same snapshot** built on the frontend. Single source of truth, two delivery paths.

---

## Approaches considered

### A. Static — session-start only

Snapshot pushed once at Vapi start; process-command never sees it. Lightweight but useless after the user fills anything.

### B. Live — `add-message` push on every fill

Each `fill_field` triggers an immediate `add-message` to Vapi with the new state. Process-command gets it too. **Reject** — bloats the Vapi system-message stream (LLMs degrade with many sequential system updates), and the `triggerResponseEnabled: true` flag would cause Vapi to respond after every field, which is annoying.

### C. Snapshot-on-screen-change + per-POST inclusion **← RECOMMEND**

- Vapi gets the form snapshot **prepended** to the screen context body on each `pushScreenContext` call (already triggered by screen change, session start, and explicit sub-screen pushes).
- `process-command` gets the snapshot in every POST body so it sees the **latest live state** including in-flight React edits that haven't saved yet.

### D. DB-driven (per-field write + Vapi reads `onboarding_states.data`)

Frontend writes to `onboarding_states.data` on every keystroke; Vapi context push reads it back. Process-command server reads it server-side, no body required. **Reject** — write storms (one PUT per keystroke), latency on transitions, doesn't capture in-flight (the "just spoke, not saved yet" case).

**C wins** because it gives the live LLM (Vapi) refresh on the natural break point (screen change), while giving the burst LLM (process-command) the most current view on every utterance. No per-keystroke DB writes. Adds two well-bounded fields to existing payloads instead of forking infrastructure.

---

## Design

### The snapshot shape

Single flat object, fields keyed by canonical name:

```ts
interface OnboardingFormSnapshot {
  // Step 1 — Profile
  nickname?: string;
  age?: number;
  gender?: 'Male' | 'Female' | 'Other';
  referralSource?: string;
  referralOtherText?: string;
  // Step 2 — Path fork
  path?: 'simple' | 'braindump';
  // Beginner flow
  category?: string;
  goals?: string[];
  habitConfigs?: Record<string, { days: number[]; time: string; reminder: boolean }>;
  reflectionConfig?: { time: string; days: number[]; reminder: boolean; schedule?: string };
  // Advanced flow
  brainDumpText?: string;
  customPrompts?: string[];
  reflectionSchedule?: string;
}
```

Empty / unset fields are **omitted** (not sent as `null`). The LLM treats absence as "not filled yet."

`habitConfigs` and similar nested fields are sent in full — they're small (a handful of keys) and the LLM needs the full picture to update or remove specific ones.

### Frontend: the snapshot builder

New hook `useOnboardingFormSnapshot()` in `src/hooks/`:

- Reads persisted state from `useOnboarding().state?.data` (already a React Query subscription — cheap and current).
- Accepts an optional `overrides` arg for in-flight React state from the current page:

```ts
function useOnboardingFormSnapshot(
  overrides?: Partial<OnboardingFormSnapshot>,
): OnboardingFormSnapshot {
  const { state } = useOnboarding();
  return useMemo(
    () => ({ ...(state?.data ?? {}), ...(overrides ?? {}) }),
    [state?.data, overrides],
  );
}
```

- Pages call it with their in-flight setters' values. Example for Step 1:

```ts
const snapshot = useOnboardingFormSnapshot({
  nickname,
  age: age === '' ? undefined : age,
  gender: gender ?? undefined,
  referralSource: referralSource ?? undefined,
  referralOtherText,
});
```

- Passed to `OnboardingLayout` via a new prop `formSnapshot?: OnboardingFormSnapshot`.

Pages that don't supply overrides still get the persisted-only snapshot (no regression).

### Frontend: deliver to process-command

`OnboardingLayout.tsx` already includes `screen_id` in the processTranscript call. Add the snapshot:

```ts
void processTranscript(text, {
  step: currentStep,
  screen_id: screenId,
  options: voiceOptions,
  prompt: voicePrompt,
  filled_fields: formSnapshot, // NEW
  extraData: focusedField ? { focusedField } : undefined,
});
```

`OnboardingStepContext` interface in `useOnboardingVoice.ts` gains an optional `filled_fields?: Record<string, unknown>` field, included in the POST body.

### Frontend: deliver to Vapi

`pushScreenContext(screenId, sinceTs)` becomes `pushScreenContext(screenId, sinceTs, formSnapshot?)`. The provider passes whatever snapshot is current at push time.

Wiring: `OnboardingVoiceProvider` doesn't have direct access to per-page in-flight state. Two options:

1. **Provider reads from `useOnboarding()` at push time** — gets persisted-only state. Misses in-flight. Simplest, no API change to the layout.
2. **Layout pushes the snapshot up via a context method** — `onboardingVoice.setFormSnapshot(snapshot)` called from each layout render. Provider keeps the latest in a ref and includes it on every push.

**Pick (2).** In-flight state matters when the user transitions screens immediately after filling something. Tiny API addition: one setter on the voice context.

`buildContextMessage` (in `packages/shared/src/context/buildContextMessage.ts`) gains an optional `filled_form_state?: Record<string, unknown>` arg and renders a new section between the screen block and the events:

```
*** ACTIVE SCREEN UPDATE ***
...

CURRENT SCREEN: ONBOARD-BEGINNER-03

What this screen is for:
<context_block>

FILLED FORM STATE (so far in this onboarding):
- nickname: Sam
- age: 28
- gender: Male
- referralSource: Friend
- path: simple
- category: Sleep better
- goals: [Fall asleep earlier, Sleep more deeply]

Recent events on this screen (most recent last):
<events>
```

Renderer omits fields with empty/undefined values. Order is fixed (declaration order in `OnboardingFormSnapshot`) for prompt stability.

### Backend: process-command consumes `filled_fields`

`api/_lib/llm/onboardingPrompt.ts` (`buildOnboardingPrompt`) gains:

```ts
const filledFields =
  ctx.filled_fields && typeof ctx.filled_fields === 'object'
    ? (ctx.filled_fields as Record<string, unknown>)
    : null;

const filledSection =
  filledFields && Object.keys(filledFields).length > 0
    ? `\n\n## Already-Filled Fields\nThe user has previously set:\n${renderFilled(filledFields)}\n\nWhen the user volunteers multiple fields in one utterance, PREFER the field that is currently unset. When the user explicitly re-asserts a filled field (e.g. "actually call me Jonas"), DO emit the fill_field — but raise the confidence threshold for fields that already have plausible values.`
    : '';
```

Slotted into the prompt before the "Per-Screen Vocabulary" section. The LLM sees what's filled and prefers empty fields on multi-field utterances.

Three new unit tests in `process-command-onboarding.test.ts`:

1. Prompt includes the `Already-Filled Fields` section when `filled_fields` is supplied.
2. Section is omitted when `filled_fields` is absent or empty.
3. Filled values render in the canonical order (nickname before age before gender, etc.).

### Backend: process-command body validation

The handler validates the incoming POST body. Add `filled_fields` as an optional `Record<string, unknown>` — no validation beyond "is object". The prompt builder's renderer is the only consumer; if the LLM gets garbage, the worst case is degraded reasoning, not a server error.

### Session-log emission (separate, optional follow-up)

The existing `state_delta` mechanism is event-based (`session_log`). Form fills are not logged as events today. **Out of scope for this plan** — adding `field_filled` events to `session_log` would let `state_delta` carry the form changes naturally, but it duplicates the snapshot in the context message. Punt until / unless we want event-stream-only context (Path 2 / Path 3 alignment).

---

## Per-page wiring

For each onboarding page that owns React state, add the snapshot call:

| Page                      | Snapshot overrides                                                |
| ------------------------- | ----------------------------------------------------------------- |
| Step1Page                 | `{nickname, age, gender, referralSource, referralOtherText}`      |
| Step2Page                 | `{path: plan ?? undefined}`                                       |
| Step3Page (beginner)      | `{category: selected ?? undefined}`                               |
| Step4Page (beginner)      | `{goals: Array.from(selected)}`                                   |
| Step5Page (beginner)      | `{habitConfigs}` (the existing state)                             |
| Step6Page (beginner)      | `{reflectionConfig: {time, days: [...days], reminder, schedule}}` |
| AdvancedInputPage         | `{brainDumpText: text}`                                           |
| AdvancedResultsPage       | `{habitConfigs: derivedFromHabits}`                               |
| AdvancedStep6Page         | `{reflectionConfig, reflectionSchedule}`                          |
| AdvancedCustomPromptsPage | `{customPrompts: prompts}`                                        |
| PlanReviewPage            | (no overrides — read-only)                                        |

Each page calls `useOnboardingFormSnapshot(overrides)` and passes the result to `<OnboardingLayout formSnapshot={snapshot}>`.

---

## Effect on existing behavior

- **Vapi system message size** grows by ~100–400 tokens per push (the FILLED FORM STATE section). On Step 7 with full state, this could be 500 tokens. Still negligible vs Vapi's ~8K context.
- **process-command request size** grows similarly. GPT-4o-mini handles 128K input; we're nowhere near the limit.
- **Latency** — zero net change on the parser path (one POST, same shape). Vapi push is unchanged in number — same `add-message` cadence, slightly larger body.
- **DB writes** — zero change. Reads from existing React Query subscription on `useOnboarding`.
- **Backward compat** — `filled_fields` is optional; pages that don't supply `formSnapshot` get persisted-only snapshot or none at all (provider falls back to its existing ref).

---

## Rollout order

Each step is independently shippable and testable.

1. **Backend prompt change + tests** — `buildOnboardingPrompt` accepts `filled_fields`, renders the new section, 3 unit tests. Ship behind an opt-in: nothing changes until frontends start sending the field.

2. **Frontend snapshot hook + layout prop** — `useOnboardingFormSnapshot`, `OnboardingLayout` accepts `formSnapshot`, threads it into `processTranscript`. POC: wire Step 1 only. Verify the parser respects already-filled fields by saying "I'm Sam, 28, male" after manually setting age.

3. **Frontend Vapi context** — extend `buildContextMessage` (shared package — touches both web + Vercel), add `setFormSnapshot` to the `OnboardingVoiceContextValue`, layout pushes the snapshot up. Vapi will start receiving FILLED FORM STATE on the next screen transition. Verify by listening to Vapi: after entering Step 1 then moving to Step 2, Vapi should reference the user's name without re-asking.

4. **Per-page wiring** — extend each onboarding page (~5 lines each, 11 pages including modals). Can be parallelized.

5. **(Optional follow-up)** — emit `session_log` `field_filled` events so state_delta carries the same information, then deprecate the inline snapshot in favor of state-delta reconstruction. Defer unless we hit prompt drift.

---

## Out of scope

- **Per-field session_log events** — covered above; punt.
- **Mid-call Vapi updates** — only refresh on screen change. Live per-fill push to Vapi rejected (approach B).
- **Vapi reading `onboarding_states.data` server-side** — process-command reads from POST body; Vapi reads from add-message. No backend-only path needed.
- **Snapshot schema validation** — prompt builder treats `filled_fields` as `Record<string, unknown>`. If a page sends garbage, the LLM degrades, no server error. Tighten in a follow-up if it becomes a problem.
- **EditHabitPage / EditJournalPage modals** — these are still deferred from the prior Flow 3 plan. Snapshot work doesn't unblock them.

---

## Risks

- **Token bloat** on Step 7 (last screen, full snapshot + all events). Worst-case ~700 tokens added to system message. Mitigation: cap rendering of `habitConfigs` to top-level names, drop nested days/time, if it becomes an issue. Not blocking for MVP.
- **Stale snapshot during screen transition** — if user fills a field and immediately navigates, the layout's `formSnapshot` for the new page might briefly miss the prior page's in-flight value if it wasn't already saved. Mitigation: `saveStep` runs in the page's Continue handler before navigation, so the persisted side always has it by the time the new page mounts. The hand-off is clean.
- **`buildContextMessage` is in `packages/shared/`** — used by both web and Vercel functions. Schema change must keep backward compatibility (optional arg, no required new field).
- **Vapi context-message ordering** — Vapi sees pushes in order. If two `pushScreenContext` calls fire near-simultaneously (rare; only happens on rapid screen transitions), the older snapshot could land last. Mitigation: provider already debounces / dedups by `lastPushedScreenIdRef`.
- **In-flight React state in `formSnapshot` is a snapshot of THIS render** — if the user types into nickname, then voice fires `processTranscript` 200ms later, the snapshot passed at the moment of the POST body construction may be one render stale. In practice React batches and the dep array on the snapshot memo refreshes; not a real bug.

---

## Open questions

1. **Should empty values be omitted or sent as `null`?** Recommend omit — LLMs are noisier on "what is null?" than "absence." Confirm.
2. **`age` formatting** — number or string in the snapshot? Page state is `number | ''`; persisted is `number`. Recommend always number in the snapshot, with the empty string normalized to omission.
3. **Order of rendered fields in Vapi's FILLED FORM STATE block** — declaration order (matches the spec hierarchy) vs alphabetical vs "step-filled-first." Recommend declaration order for prompt stability; the LLM reads top-down.
4. **Should `reflectionConfig.days` be rendered as a day-list ("Mon, Tue, …") or numeric array ([1, 2, 3])?** Recommend day-list for readability — both LLMs handle natural language better than numeric arrays for week days. Render via a tiny `DAYS_OF_WEEK[i]` lookup.

---

## File touch list (preview for the implementation plan)

- `packages/shared/src/context/buildContextMessage.ts` — add `filled_form_state?: Record<string, unknown>` arg + renderer.
- `api/_lib/llm/onboardingPrompt.ts` — read `ctx.filled_fields`, emit the Already-Filled section.
- `api/_lib/__tests__/process-command-onboarding.test.ts` — 3 new tests.
- `src/hooks/useOnboardingFormSnapshot.ts` — new hook.
- `src/hooks/useOnboardingVoice.ts` — `OnboardingStepContext` gains `filled_fields?`; included in POST body.
- `src/contexts/useOnboardingVoiceSession.ts` — `OnboardingVoiceContextValue` gains `setFormSnapshot`.
- `src/contexts/OnboardingVoiceProvider.tsx` — keep `formSnapshotRef`, include in `pushScreenContext`'s `buildContextMessage` call.
- `src/components/onboarding/OnboardingLayout.tsx` — new `formSnapshot?` prop; passes to provider via `setFormSnapshot` on render; passes to processTranscript via `filled_fields`.
- 11 page files — call `useOnboardingFormSnapshot(overrides)` and thread to layout.

Roughly 16 file edits, mostly mechanical after the snapshot hook + buildContextMessage extension land.
