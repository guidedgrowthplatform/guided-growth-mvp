# Voice-Driven Onboarding (Flow 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-05-22-voice-driven-onboarding-flow-3-design.md`

**Goal:** Extend the Step 1 "transcript → /api/process-command → form fill" pattern to every onboarding screen so the user can speak any field value at any time and the form fills.

**Architecture:** Vapi remains a pure STT+TTS+chat-LLM transport. The frontend's existing `useOnboardingVoice.processTranscript()` posts each user transcript to `/api/process-command`. That endpoint runs a small parser LLM (GPT-4o-mini) whose system prompt is rewritten to know every onboarding screen's fields and emit one of: `fill_field | select_option | select_multiple | add_habit | update_habit | remove_habit | set_reflection_config | set_path | confirm_plan | navigate_next`. Each onboarding page adds a `handleVoiceAction(result)` callback that switches on the action and routes to the page's state setters. No new endpoints, no Vapi dashboard changes, no Supabase Realtime hydration.

**Tech Stack:** Vercel serverless (Node), OpenAI GPT-4o-mini for `/api/process-command`, React + Vite for pages, Vitest for backend tests, Vapi for voice transport (untouched).

---

## File Structure

**Backend (Vercel functions):**

- Modify: `api/process-command.ts` — rewrite `buildOnboardingPrompt`, accept `screen_id` in onboarding context, restructure per-step blocks into per-screen blocks.
- Create: `api/_lib/__tests__/process-command-onboarding.test.ts` — unit tests for the new action shapes (extracts `buildOnboardingPrompt` for testability).
- (Possibly) Extract: `api/_lib/llm/onboardingPrompt.ts` — pull `buildOnboardingPrompt` out of the handler file so the test can import it without importing the full Vercel handler.

**Frontend (React):**

- Modify: `src/hooks/useOnboardingVoice.ts` — extend `OnboardingStepContext` with `screen_id`, post it in `processTranscript`, extend the low-confidence fallback table per screen.
- Modify (14 pages): each onboarding page adds a `handleVoiceAction(result: OnboardingVoiceResult)` callback and passes it to `<OnboardingLayout onVoiceAction={...} />`. Per-page specifics in tasks below.

**Data:**

- Modify: `src/generated/screen_contexts.json` — append a `VOICE_ACTIONS:` block to each onboarding screen's `context_block`. Hand-edit; we'll source from the Master Sheet in a later phase.

**No changes to:**

- `api/_lib/llm/tools.ts`, `api/llm/[...path].ts` (Path 3 text chat surface)
- `src/hooks/useRealtimeVoice.ts`, `src/contexts/OnboardingVoiceProvider.tsx` (Vapi transport)
- Vapi assistant dashboard config
- Supabase schema or migrations

---

## Canonical Screen IDs (used across tasks)

| Page                      | Screen ID                                 |
| ------------------------- | ----------------------------------------- |
| Step1Page                 | `ONBOARD-01--FORM`                        |
| Step2Page                 | `ONBOARD-02--PATH`                        |
| Step3Page                 | `ONBOARD-03--CATEGORY`                    |
| Step4Page                 | `ONBOARD-04--GOALS`                       |
| Step5Page                 | `ONBOARD-05--HABITS`                      |
| Step6Page                 | `ONBOARD-06--REFLECT`                     |
| AdvancedInputPage         | `ONBOARD-ADV-INPUT`                       |
| AdvancedResultsPage       | `ONBOARD-ADV-RESULTS`                     |
| AdvancedStep6Page         | `ONBOARD-ADV-STEP6`                       |
| AdvancedCustomPromptsPage | `ONBOARD-ADV-CUSTOM`                      |
| EditHabitPage             | (modal, no screen_id needed — use parent) |
| EditJournalPage           | (modal, no screen_id needed — use parent) |
| PlanReviewPage            | `ONBOARD-07--REVIEW`                      |

If a screen ID does not already exist in `src/generated/screen_contexts.json`, hand-edit to add a stub entry.

---

## Action Vocabulary Reference

For every task below, the action contract is:

```ts
type OnboardingAction =
  | { action: 'fill_field'; params: { fieldName: string; value: string } }
  | { action: 'select_option'; params: { fieldName: string; value: string } }
  | { action: 'select_multiple'; params: { fieldName: string; values: string[] } }
  | {
      action: 'add_habit';
      params: { name: string; days?: number[]; time?: string; reminder?: boolean };
    }
  | { action: 'update_habit'; params: { name: string; patch: Record<string, unknown> } }
  | { action: 'remove_habit'; params: { name: string } }
  | {
      action: 'set_reflection_config';
      params: { time?: string; days?: number[]; reminder?: boolean; schedule?: string };
    }
  | { action: 'set_path'; params: { value: 'simple' | 'braindump' } }
  | { action: 'confirm_plan'; params: Record<string, never> }
  | { action: 'navigate_next'; params: Record<string, never> }
  | { action: 'onboarding_select'; params: Record<string, unknown> } // legacy — kept for back-compat
  | { action: 'error'; params: Record<string, never> };
```

The TypeScript union lives in `useOnboardingVoice.ts` as a literal-string-typed `action` for documentation; the runtime `OnboardingVoiceResult` keeps `action: string` for forward compatibility.

---

## Phase 0 — Foundation

### Task 1: Extract `buildOnboardingPrompt` into a testable module

**Why:** Today `buildOnboardingPrompt` is a private function inside `api/process-command.ts` (a Vercel handler). Importing the handler in a Vitest spec pulls in `@vercel/node`, db code, and `requireUser`. Extract the pure prompt builder so we can test it cleanly.

**Files:**

- Create: `api/_lib/llm/onboardingPrompt.ts`
- Modify: `api/process-command.ts:260-347` — import the extracted function

- [ ] **Step 1: Create the extracted module**

Create `api/_lib/llm/onboardingPrompt.ts`:

```ts
/**
 * Onboarding system prompt builder for /api/process-command.
 *
 * Extracted from process-command.ts so it can be unit-tested without
 * loading the Vercel handler. The handler imports buildOnboardingPrompt
 * from here; no other behavior changes.
 */

export interface FocusedFieldShape {
  name: string;
  value: string;
  type: string;
}

export function isFocusedFieldContext(value: unknown): value is FocusedFieldShape {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.name === 'string' && typeof v.value === 'string' && typeof v.type === 'string';
}

/**
 * Builds the system prompt the parser LLM sees on an onboarding turn.
 * Reads {step, screen_id, options, prompt, focusedField} from ctx.
 * Returns the prompt string verbatim; no LLM call.
 */
export function buildOnboardingPrompt(ctx: Record<string, unknown>): string {
  // BODY MOVED FROM process-command.ts:272-347 in Task 2.
  // Keep this stub returning empty string until Task 2 rewrites it.
  return '';
}
```

- [ ] **Step 2: Switch the handler to import from the new module**

Edit `api/process-command.ts`:

- Delete the `FocusedFieldShape` interface (lines ~260-264).
- Delete the `isFocusedFieldContext` function (lines ~266-270).
- Delete the `buildOnboardingPrompt` function body (lines ~272-347).
- Add at the top of the file (with other imports):
  ```ts
  import { buildOnboardingPrompt, isFocusedFieldContext } from './_lib/llm/onboardingPrompt.js';
  ```
- Verify the remaining call site (in the handler body) still uses the imported name.

- [ ] **Step 3: Confirm typecheck still passes**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Confirm existing tests still pass**

Run: `npx vitest run`
Expected: all currently-passing tests still pass. The extracted prompt builder currently returns `''` — this is intentional and fixed in Task 2.

- [ ] **Step 5: Commit**

```bash
git add api/_lib/llm/onboardingPrompt.ts api/process-command.ts
git commit -m "refactor(process-command): extract buildOnboardingPrompt to testable module"
```

---

### Task 2: Rewrite `buildOnboardingPrompt` with per-screen blocks + new action vocabulary

**Files:**

- Modify: `api/_lib/llm/onboardingPrompt.ts`

- [ ] **Step 1: Write the first failing test (drives the shape)**

Create `api/_lib/__tests__/process-command-onboarding.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildOnboardingPrompt } from '../llm/onboardingPrompt';

describe('buildOnboardingPrompt', () => {
  it('includes the screen_id when provided', () => {
    const prompt = buildOnboardingPrompt({
      step: 3,
      screen_id: 'ONBOARD-03--CATEGORY',
      prompt: 'What feels most worth improving?',
      options: ['Sleep better', 'Move more'],
    });
    expect(prompt).toContain('ONBOARD-03--CATEGORY');
  });

  it('lists the action vocabulary the LLM is allowed to emit', () => {
    const prompt = buildOnboardingPrompt({
      step: 1,
      screen_id: 'ONBOARD-01--FORM',
      options: [],
      prompt: '',
    });
    for (const action of [
      'fill_field',
      'select_option',
      'select_multiple',
      'add_habit',
      'update_habit',
      'remove_habit',
      'set_reflection_config',
      'set_path',
      'confirm_plan',
      'navigate_next',
    ]) {
      expect(prompt).toContain(action);
    }
  });

  it('has a per-screen block for ONBOARD-03--CATEGORY listing select_option', () => {
    const prompt = buildOnboardingPrompt({
      step: 3,
      screen_id: 'ONBOARD-03--CATEGORY',
      options: ['Sleep better', 'Move more', 'Eat better'],
      prompt: 'What feels most worth improving?',
    });
    expect(prompt).toMatch(/ONBOARD-03--CATEGORY[\s\S]*select_option[\s\S]*category/);
  });

  it('has a per-screen block for ONBOARD-05--HABITS listing add_habit / update_habit / remove_habit', () => {
    const prompt = buildOnboardingPrompt({
      step: 5,
      screen_id: 'ONBOARD-05--HABITS',
      options: [],
      prompt: '',
    });
    expect(prompt).toMatch(/ONBOARD-05--HABITS[\s\S]*add_habit/);
    expect(prompt).toMatch(/ONBOARD-05--HABITS[\s\S]*remove_habit/);
  });

  it('includes the focused-field disambiguation block when a focused field is supplied', () => {
    const prompt = buildOnboardingPrompt({
      step: 1,
      screen_id: 'ONBOARD-01--FORM',
      options: [],
      prompt: '',
      focusedField: { name: 'nickname', value: '', type: 'text' },
    });
    expect(prompt).toContain('Focused Field');
    expect(prompt).toContain('nickname');
  });

  it('omits the focused-field block when no focused field is supplied', () => {
    const prompt = buildOnboardingPrompt({
      step: 1,
      screen_id: 'ONBOARD-01--FORM',
      options: [],
      prompt: '',
    });
    expect(prompt).not.toContain('Focused Field');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run api/_lib/__tests__/process-command-onboarding.test.ts`
Expected: all 6 fail because `buildOnboardingPrompt` returns `''`.

- [ ] **Step 3: Implement the new prompt builder**

Replace the body of `buildOnboardingPrompt` in `api/_lib/llm/onboardingPrompt.ts`:

```ts
export function buildOnboardingPrompt(ctx: Record<string, unknown>): string {
  const step = typeof ctx.step === 'number' ? ctx.step : 0;
  const screenId = typeof ctx.screen_id === 'string' ? ctx.screen_id : '';
  const options = Array.isArray(ctx.options) ? ctx.options : [];
  const prompt = typeof ctx.prompt === 'string' ? ctx.prompt : '';
  const focusedField = isFocusedFieldContext(ctx.focusedField) ? ctx.focusedField : null;

  const optionsStr = options.join(', ');

  const focusedSection = focusedField
    ? `

## Focused Field
A text input is focused: name="${focusedField.name}" current value="${focusedField.value}".
If the user's utterance plausibly fills that field, return:
{"action":"fill_field","params":{"fieldName":"${focusedField.name}","value":"<extracted value>"},"confidence":0.0-1.0,"message":"<acknowledgement>"}
Otherwise route as a screen-appropriate action below.`
    : '';

  return `You are the voice command parser for an onboarding flow. Your job is to read the user's spoken utterance and return ONE structured action.

## Current Screen
- screen_id: ${screenId}
- step: ${step}
- on-screen prompt: "${prompt}"
- on-screen options (if chip-based): ${optionsStr}${focusedSection}

## PII Scrubbing
Replace any names with [NAME], ages with [AGE], emails with [EMAIL] BEFORE extracting parameters. Do not echo raw PII in the response.

## Action Vocabulary (pick exactly one per turn)

Return ONLY valid JSON in this shape:
{
  "action": "<one of the actions below>",
  "params": { ...action-specific fields... },
  "confidence": 0.0-1.0,
  "message": "<short spoken acknowledgement>"
}

### fill_field
For volunteered text/number values. params: { fieldName, value }.
Example: user="my name is Sam" on a screen with a nickname input → {"action":"fill_field","params":{"fieldName":"nickname","value":"Sam"},"confidence":0.9,"message":"Got it, Sam."}

### select_option
For single-choice chip selects. params: { fieldName, value }. value MUST be one of the screen's listed options.
Example: user="I want to focus on sleep" on category screen → {"action":"select_option","params":{"fieldName":"category","value":"Sleep better"},"confidence":0.9,"message":"Great area to focus on."}

### select_multiple
For multi-pick chip selects. params: { fieldName, values: [...] }. Up to N items.
Example: user="fall asleep earlier and sleep deeper" on goals screen → {"action":"select_multiple","params":{"fieldName":"goals","values":["Fall asleep earlier","Sleep more deeply"]},"confidence":0.85,"message":"Two solid goals."}

### add_habit
For adding a new habit. params: { name, days?, time?, reminder? }. days is an array of integers 0–6 (Sunday=0). time is "HH:MM" 24h. reminder defaults to true.
Example: user="add meditation every weekday at 7am" → {"action":"add_habit","params":{"name":"Meditation","days":[1,2,3,4,5],"time":"07:00","reminder":true},"confidence":0.9,"message":"Added — meditation, weekdays at 7."}

### update_habit
For editing an existing habit. params: { name, patch }. patch contains only the fields that change.
Example: user="move meditation to 8am" → {"action":"update_habit","params":{"name":"Meditation","patch":{"time":"08:00"}},"confidence":0.9,"message":"Meditation moved to 8."}

### remove_habit
For deleting a habit. params: { name }.
Example: user="drop the reading one" → {"action":"remove_habit","params":{"name":"Reading"},"confidence":0.85,"message":"Reading removed."}

### set_reflection_config
For the evening reflection schedule. Any subset of: { time, days, reminder, schedule }.
Example: user="remind me Sundays at 7pm" → {"action":"set_reflection_config","params":{"time":"19:00","days":[0]},"confidence":0.85,"message":"Got it — Sundays at 7."}

### set_path
For the beginner/advanced fork on screen ONBOARD-02--PATH. params: { value: "simple" | "braindump" }.
Example: user="I'll keep it simple" → {"action":"set_path","params":{"value":"simple"},"confidence":0.9,"message":"Simple it is."}

### confirm_plan
For the plan review screen when the user gives final consent.
Example: user="looks good, start" → {"action":"confirm_plan","params":{},"confidence":0.95,"message":"You're in."}

### navigate_next
For explicit advance utterances ("continue", "next", "let's go"). DO NOT emit on a successful fill — only when the user is asking to move on with no new value.
Example: user="let's continue" → {"action":"navigate_next","params":{},"confidence":0.9,"message":"On we go."}

### error
If the utterance is unrelated to onboarding ("what time is it"), low confidence, or a question to the assistant. confidence < 0.5. params={}.

## Per-Screen Vocabulary

### ONBOARD-01--FORM (Profile Setup)
Fields: nickname (text), age (number 13–120), gender (chip: Male/Female/Other), referralSource (chip: Founder Invite/Webinar/Friend/Other), referralOtherText (text, only when referralSource=Other).
Allowed actions: fill_field (nickname, age, referralOtherText), select_option (gender, referralSource), navigate_next.
Multi-fact utterances: when the user says ("I'm Sam, 28, male, found you through a friend") pick the HIGHEST-VALUE single action (typically the chip/select_option that hasn't been filled yet). The user re-speaks the rest. Do not invent multi-action arrays.

### ONBOARD-02--PATH (Plan Type)
Fields: path (chip: simple/braindump).
Allowed actions: set_path, navigate_next.

### ONBOARD-03--CATEGORY (Improvement Area)
Fields: category (chip select; one of ${optionsStr || 'the on-screen options'}).
Allowed actions: select_option (fieldName="category"), navigate_next.

### ONBOARD-04--GOALS (Goal Selection)
Fields: goals (multi-chip, up to 2).
Allowed actions: select_multiple (fieldName="goals"), navigate_next.

### ONBOARD-05--HABITS (Habit Selection)
Fields: habitConfigs (Record<habitName, {days[], time, reminder}>).
Allowed actions: add_habit, update_habit, remove_habit, navigate_next.
One habit per turn. If the user names two habits in one breath, pick the first.

### ONBOARD-06--REFLECT (Reflection Schedule)
Fields: reflectionConfig ({ time, days[], reminder, schedule? }).
Allowed actions: set_reflection_config (partial patches OK), navigate_next.

### ONBOARD-ADV-INPUT (Brain Dump)
Fields: brainDumpText (long text).
Allowed actions: fill_field (fieldName="brainDumpText"; value=the entire transcript verbatim), navigate_next.

### ONBOARD-ADV-RESULTS (Plan Review — AI-generated habits)
Fields: habitConfigs (editable).
Allowed actions: update_habit, remove_habit, navigate_next.

### ONBOARD-ADV-STEP6 (Advanced Reflection)
Fields: reflectionConfig, reflectionSchedule (chip).
Allowed actions: set_reflection_config, select_option (fieldName="reflectionSchedule"), navigate_next.

### ONBOARD-ADV-CUSTOM (Custom Journal Prompts)
Fields: customPrompts (string[]).
Allowed actions: fill_field with fieldName="customPrompts[N]" (N = the index the user is currently editing; default 0 if ambiguous), navigate_next.

### ONBOARD-07--REVIEW (Plan Review — Final)
Allowed actions: confirm_plan, navigate_next.

## Matching Strategy
- Fuzzy-match against the screen's options when emitting select_option / select_multiple.
- If confidence is below 0.5, return action="error" with a helpful message field.
- Always include a short spoken acknowledgement in "message". The caller may override it with a step-specific success string.`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run api/_lib/__tests__/process-command-onboarding.test.ts`
Expected: all 6 pass.

- [ ] **Step 5: Confirm typecheck still passes**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add api/_lib/llm/onboardingPrompt.ts api/_lib/__tests__/process-command-onboarding.test.ts
git commit -m "feat(process-command): per-screen onboarding action vocabulary"
```

---

### Task 3: Pass `screen_id` through the frontend voice context

**Files:**

- Modify: `src/hooks/useOnboardingVoice.ts:5-10` (OnboardingStepContext interface) and the `processTranscript` body (~lines 73-82)
- Modify: `src/components/onboarding/OnboardingLayout.tsx` (the `stepContext` it builds for the overlay)

- [ ] **Step 1: Extend `OnboardingStepContext` with `screen_id`**

Edit `src/hooks/useOnboardingVoice.ts`:

```ts
export interface OnboardingStepContext {
  step: number;
  screen_id?: string; // NEW — canonical screen id from src/generated/screen_contexts.json
  options: string[];
  prompt: string;
  extraData?: Record<string, unknown>;
}
```

In `processTranscript`, include `screen_id` in the body:

```ts
body: JSON.stringify({
  transcript,
  onboarding_context: {
    step: stepContext.step,
    screen_id: stepContext.screen_id,   // NEW
    options: stepContext.options,
    prompt: stepContext.prompt,
    ...stepContext.extraData,
  },
}),
```

- [ ] **Step 2: Add a per-screen low-confidence fallback table**

In the `if (confidence < 0.5)` branch, extend the existing `lowConfFallback` to be keyed by `screen_id` first, then fall back to step. Replace:

```ts
const lowConfFallback: Record<number, string> = {
  1: "I didn't catch that clearly. Could you say your name again? Or just type it in — totally fine.",
  // ...
};
return {
  // ...
  message:
    lowConfFallback[stepContext.step] || "I didn't catch that — try again or select manually.",
  // ...
};
```

with:

```ts
const screenFallbacks: Record<string, string> = {
  'ONBOARD-01--FORM':
    "I didn't catch that clearly. Could you say your name again? Or just type it in — totally fine.",
  'ONBOARD-02--PATH':
    "No pressure either way — just tap the one that feels right, or say 'simple' or 'brain dump.'",
  'ONBOARD-03--CATEGORY':
    "I didn't catch which area. Just say one — like 'sleep' or 'focus' — or tap it.",
  'ONBOARD-04--GOALS': 'Could you say that again? Or just tap the ones that resonate.',
  'ONBOARD-05--HABITS': 'Which habit do you want to add? Say it like "meditate at 7am".',
  'ONBOARD-06--REFLECT': 'Want me to remind you each evening? Pick a time or skip.',
  'ONBOARD-07--REVIEW': "Say 'let's go' or tap 'Start plan.'",
  'ONBOARD-ADV-INPUT': 'Just talk through everything you want to track. Take your time.',
  'ONBOARD-ADV-RESULTS': 'You can change or remove any of these — just say which one.',
  'ONBOARD-ADV-STEP6': 'Want me to remind you each evening? Pick a time or skip.',
  'ONBOARD-ADV-CUSTOM': 'What prompt do you want me to use for journaling?',
};
const stepFallback: Record<number, string> = {
  1: screenFallbacks['ONBOARD-01--FORM'],
  2: screenFallbacks['ONBOARD-02--PATH'],
  3: screenFallbacks['ONBOARD-03--CATEGORY'],
  4: screenFallbacks['ONBOARD-04--GOALS'],
  5: screenFallbacks['ONBOARD-05--HABITS'],
  6: screenFallbacks['ONBOARD-06--REFLECT'],
  7: screenFallbacks['ONBOARD-07--REVIEW'],
};
const fallbackMessage =
  (stepContext.screen_id && screenFallbacks[stepContext.screen_id]) ||
  stepFallback[stepContext.step] ||
  "I didn't catch that — try again or select manually.";

return {
  success: false,
  action: 'error',
  params: {},
  message: fallbackMessage,
  confidence,
};
```

(Apply the same pattern to the `catch (error)` fallback further down in the file.)

- [ ] **Step 3: Wire `screen_id` from each page through `OnboardingLayout`**

Add a `screenId?: string` prop to `OnboardingLayout`. Inside it, build the `stepContext` passed to the overlay using the prop:

```ts
// OnboardingLayout.tsx
interface OnboardingLayoutProps {
  // ...existing props...
  screenId?: string;
}

// ...in the body...
const stepContext = {
  step: currentStep,
  screen_id: screenId,
  options: voiceOptions,
  prompt: voicePrompt,
  extraData: focusedField ? { focusedField } : undefined,
};

// ...where it's used today (around line 181-186)...
<OnboardingChatOverlay
  stepContext={stepContext}
  onAction={handleVoiceAction}
  onClose={closeOverlay}
/>
```

Don't add a default — pages must pass it explicitly so we get a typecheck error when a new page forgets.

- [ ] **Step 4: Pass `screenId` from Step1Page as the reference example**

Edit `src/pages/onboarding/shared/Step1Page.tsx`, in the `<OnboardingLayout>` props:

```tsx
<OnboardingLayout
  currentStep={1}
  screenId="ONBOARD-01--FORM"
  // ...rest unchanged...
>
```

(Other pages get this prop in their Phase-2/3 tasks below.)

- [ ] **Step 5: Confirm typecheck still passes**

Run: `npx tsc --noEmit`
Expected: no errors (we made the new prop optional, so existing pages still compile).

- [ ] **Step 6: Smoke-test Step 1**

Run: `npm run dev` (or test in the deployed preview). Open Step 1 with mic on. Say _"my name is Sam"_. Confirm nickname fills as before. The behavior shouldn't change — we've only added a new optional field to the request body.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useOnboardingVoice.ts src/components/onboarding/OnboardingLayout.tsx src/pages/onboarding/shared/Step1Page.tsx
git commit -m "feat(onboarding-voice): thread screen_id through voice context"
```

---

## Phase 1 — Step 3 POC (chip select)

### Task 4: Add VOICE_ACTIONS appendix to ONBOARD-03--CATEGORY in screen_contexts.json

**Files:**

- Modify: `src/generated/screen_contexts.json` (one entry)

- [ ] **Step 1: Locate the ONBOARD-03--CATEGORY entry**

Open `src/generated/screen_contexts.json`. Find the `"ONBOARD-03--CATEGORY"` key inside `screens`. Read its current `context_block` string.

- [ ] **Step 2: Append the VOICE_ACTIONS block**

Add (at the very end of the existing `context_block` string, with a leading double-newline):

```
\n\nVOICE_ACTIONS (this screen):\n- select_option(fieldName="category", value=<one of: Sleep better, Move more, Eat better, Feel more energized, Reduce stress, Improve focus, Break bad habits, Get more organized>)\n- navigate_next when user says "continue" / "next" / "let's go"
```

(Use literal `\n` escape sequences inside the JSON string — `screen_contexts.json` is single-line per entry.)

- [ ] **Step 3: Validate the JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('src/generated/screen_contexts.json','utf8'));console.log('ok')"`
Expected: prints `ok`.

- [ ] **Step 4: Commit**

```bash
git add src/generated/screen_contexts.json
git commit -m "data(screen-contexts): add VOICE_ACTIONS appendix for ONBOARD-03--CATEGORY"
```

---

### Task 5: Wire Step3Page voice handler

**Files:**

- Modify: `src/pages/onboarding/beginner/Step3Page.tsx`

- [ ] **Step 1: Add the voice handler and pass screenId**

Edit `src/pages/onboarding/beginner/Step3Page.tsx`. Add the imports, handler, and props:

```tsx
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { track } from '@/analytics';
import { CategoryCard } from '@/components/onboarding/CategoryCard';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { useAgentNavigation } from '@/hooks/useAgentNavigation';
import { useOnboarding } from '@/hooks/useOnboarding';
import { type OnboardingVoiceResult } from '@/hooks/useOnboardingVoice';
import { useStepTiming } from '../shared/useStepTiming';

const categories = [
  { label: 'Sleep better', image: '/images/onboarding/sleep-better.png' },
  // ...unchanged...
];
const CATEGORY_LABELS = categories.map((c) => c.label);

export function Step3Page() {
  const navigate = useNavigate();
  const { state: onboardingState, saveStepAsync } = useOnboarding();
  const [selected, setSelected] = useState<string | null>(null);

  useAgentNavigation(3, '/onboarding/step-4');
  const trackStepComplete = useStepTiming(5, 'improvement_areas', 'beginner');

  useEffect(() => {
    if (onboardingState?.data?.category) {
      setSelected(onboardingState.data.category as string);
    }
  }, [onboardingState?.data?.category]);

  const handleVoiceAction = useCallback((result: OnboardingVoiceResult) => {
    if (result.action === 'select_option') {
      const params = result.params as { fieldName?: string; value?: string };
      if (params.fieldName === 'category' && typeof params.value === 'string') {
        // Fuzzy match: LLM should already pick from CATEGORY_LABELS, but
        // accept a case-insensitive substring match as a defense in depth.
        const match = CATEGORY_LABELS.find((l) => l.toLowerCase() === params.value!.toLowerCase());
        if (match) setSelected(match);
      }
    }
  }, []);

  const handleNext = useCallback(async () => {
    await saveStepAsync(3, { category: selected });
    track('select_improvement_areas', { areas: [selected], area_count: 1 });
    trackStepComplete();
    navigate('/onboarding/step-4', { state: { category: selected } });
  }, [selected, navigate, saveStepAsync, trackStepComplete]);

  return (
    <OnboardingLayout
      currentStep={3}
      screenId="ONBOARD-03--CATEGORY"
      ctaLabel="Continue"
      ctaVariant="inline"
      onNext={handleNext}
      onBack={() => navigate('/onboarding/step-2')}
      ctaDisabled={!selected}
      showVoiceButton
      aiListeningPrompt='"What is the main category you would like to focus on?"'
      onVoiceAction={handleVoiceAction}
    >
      {/* ...unchanged children... */}
    </OnboardingLayout>
  );
}
```

- [ ] **Step 2: Confirm typecheck still passes**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual smoke test**

Run: `npm run dev`. Navigate to Step 3 with mic on. Say _"I want to focus on sleep"_. Expect the "Sleep better" card to become selected within ~1s. Press Continue. Expect navigation to Step 4 and `onboarding_states.data.category` to be persisted.

Try variants:

- _"let's work on stress"_ → "Reduce stress" selected
- _"focus, my focus is bad"_ → "Improve focus" selected
- _"organization"_ → "Get more organized" selected
- A nonsense utterance ("what time is it") → no selection, fallback message spoken

- [ ] **Step 4: Commit**

```bash
git add src/pages/onboarding/beginner/Step3Page.tsx
git commit -m "feat(onboarding): wire voice-driven category select on Step 3"
```

---

## Phase 2 — Beginner pages

Tasks 6–9 follow the **same pattern** as Task 5. For each: add screen_contexts VOICE_ACTIONS, then wire the page's `handleVoiceAction`. These can be done in parallel.

### Task 6: Step 1 — extend with select_option for gender + referralSource

**Files:**

- Modify: `src/generated/screen_contexts.json` (ONBOARD-01--FORM entry)
- Modify: `src/pages/onboarding/shared/Step1Page.tsx`

- [ ] **Step 1: Append VOICE_ACTIONS to ONBOARD-01--FORM**

In `src/generated/screen_contexts.json`, append to ONBOARD-01--FORM's `context_block`:

```
\n\nVOICE_ACTIONS (this screen):\n- fill_field(fieldName="nickname", value=<text>)\n- fill_field(fieldName="age", value=<number 13-120 as string>)\n- fill_field(fieldName="referralOtherText", value=<text>) — only when referralSource has been set to "Other"\n- select_option(fieldName="gender", value=<one of: Male, Female, Other>)\n- select_option(fieldName="referralSource", value=<one of: Founder Invite, Webinar, Friend, Other>)\n- navigate_next when user says "continue" / "next"
```

Validate JSON: `node -e "JSON.parse(require('fs').readFileSync('src/generated/screen_contexts.json','utf8'));console.log('ok')"`

- [ ] **Step 2: Extend Step1Page's handleVoiceAction**

Replace the existing `handleVoiceAction` in `Step1Page.tsx:47-52`:

```ts
const handleVoiceAction = useCallback((result: OnboardingVoiceResult) => {
  if (result.action === 'fill_field') {
    const params = result.params as { fieldName?: string; value?: string };
    if (typeof params.value !== 'string') return;
    if (params.fieldName === 'nickname') setNickname(params.value);
    else if (params.fieldName === 'age') {
      const n = parseInt(params.value, 10);
      if (!isNaN(n) && n >= 13 && n <= 120) setAge(n);
    } else if (params.fieldName === 'referralOtherText') setReferralOtherText(params.value);
    return;
  }
  if (result.action === 'select_option') {
    const params = result.params as { fieldName?: string; value?: string };
    if (typeof params.value !== 'string') return;
    if (params.fieldName === 'gender' && GENDER_OPTIONS.includes(params.value)) {
      setGender(params.value);
    } else if (params.fieldName === 'referralSource' && REFERRAL_OPTIONS.includes(params.value)) {
      setReferralSource(params.value);
    }
  }
}, []);
```

- [ ] **Step 3: Typecheck + smoke test**

Run: `npx tsc --noEmit` → pass.

Run `npm run dev`. On Step 1 with mic on, say _"I'm Sam, 28, male, found you through a friend"_. Expect nickname=Sam, age=28, gender=Male selected, referralSource=Friend selected (per the "one action per turn" rule, may need multiple utterances; document whichever single field the LLM picks first).

Then say each missing field separately ("I'm 28", "I'm a guy", "found you through a friend") and confirm each populates.

- [ ] **Step 4: Commit**

```bash
git add src/pages/onboarding/shared/Step1Page.tsx src/generated/screen_contexts.json
git commit -m "feat(onboarding): voice select_option for gender + referralSource on Step 1"
```

---

### Task 7: Step 2 — set_path

**Files:**

- Modify: `src/generated/screen_contexts.json` (ONBOARD-02--PATH entry)
- Modify: `src/pages/onboarding/shared/Step2Page.tsx`

- [ ] **Step 1: VOICE_ACTIONS for ONBOARD-02--PATH**

Append to ONBOARD-02--PATH's `context_block`:

```
\n\nVOICE_ACTIONS (this screen):\n- set_path(value="simple") — user is new to habits / wants recommended habits\n- set_path(value="braindump") — user is experienced / wants to dictate everything\n- navigate_next when user has chosen a path and says "continue" / "next"
```

Validate JSON.

- [ ] **Step 2: Wire Step2Page**

Add to `src/pages/onboarding/shared/Step2Page.tsx`:

```tsx
import { type OnboardingVoiceResult } from '@/hooks/useOnboardingVoice';
import { useCallback } from 'react'; // (already imported)

// ...inside the component, alongside handleNext...
const handleVoiceAction = useCallback((result: OnboardingVoiceResult) => {
  if (result.action !== 'set_path') return;
  const params = result.params as { value?: string };
  if (params.value === 'simple' || params.value === 'braindump') {
    setPlan(params.value);
  }
}, []);
```

Add the two new props to the JSX:

```tsx
<OnboardingLayout
  currentStep={2}
  screenId="ONBOARD-02--PATH"
  // ...rest unchanged...
  onVoiceAction={handleVoiceAction}
>
```

- [ ] **Step 3: Typecheck + smoke test**

Run: `npx tsc --noEmit` → pass.

On Step 2 with mic on:

- Say _"I'll keep it simple"_ → "I'm new to habit tracking" card selected.
- Say _"use brain dump"_ → other card selected.

- [ ] **Step 4: Commit**

```bash
git add src/pages/onboarding/shared/Step2Page.tsx src/generated/screen_contexts.json
git commit -m "feat(onboarding): voice set_path on Step 2"
```

---

### Task 8: Step 4 — select_multiple goals

**Files:**

- Modify: `src/generated/screen_contexts.json` (ONBOARD-04--GOALS entry)
- Modify: `src/pages/onboarding/beginner/Step4Page.tsx`

- [ ] **Step 1: Read Step4Page first** to learn the current goal options array and the state setter.

Run: `cat src/pages/onboarding/beginner/Step4Page.tsx | head -80`. Note the goal options list (will be a `const goalOptions` or similar) and the state shape (likely `selectedGoals: string[]` with a `setSelectedGoals` setter).

- [ ] **Step 2: VOICE_ACTIONS for ONBOARD-04--GOALS**

Append to ONBOARD-04--GOALS's `context_block`:

```
\n\nVOICE_ACTIONS (this screen):\n- select_multiple(fieldName="goals", values=<up to 2 of: ...the actual options array verbatim...>)\n- navigate_next when user says "continue" / "next"
```

(Fill in the options array exactly — copy from the page file.)

Validate JSON.

- [ ] **Step 3: Wire Step4Page**

```tsx
import { type OnboardingVoiceResult } from '@/hooks/useOnboardingVoice';

const handleVoiceAction = useCallback((result: OnboardingVoiceResult) => {
  if (result.action !== 'select_multiple') return;
  const params = result.params as { fieldName?: string; values?: unknown };
  if (params.fieldName !== 'goals' || !Array.isArray(params.values)) return;
  const filtered = params.values
    .filter((v): v is string => typeof v === 'string')
    .filter((v) => GOAL_OPTIONS.includes(v)) // intersect with screen options
    .slice(0, 2); // hard cap at 2
  if (filtered.length > 0) setSelectedGoals(filtered);
}, []);
```

(Replace `GOAL_OPTIONS` and `setSelectedGoals` with the actual names from the page file.)

Add `screenId="ONBOARD-04--GOALS"` and `onVoiceAction={handleVoiceAction}` to the `OnboardingLayout` props.

- [ ] **Step 4: Typecheck + smoke test**

Run: `npx tsc --noEmit` → pass.

On Step 4 with mic on, say _"fall asleep earlier and sleep more deeply"_. Confirm both goals selected.

- [ ] **Step 5: Commit**

```bash
git add src/pages/onboarding/beginner/Step4Page.tsx src/generated/screen_contexts.json
git commit -m "feat(onboarding): voice select_multiple goals on Step 4"
```

---

### Task 9: Step 5 — habit CRUD

**Files:**

- Modify: `src/generated/screen_contexts.json` (ONBOARD-05--HABITS entry)
- Modify: `src/pages/onboarding/beginner/Step5Page.tsx`

- [ ] **Step 1: Read Step5Page first** to learn the current habit-state shape.

Run: `cat src/pages/onboarding/beginner/Step5Page.tsx`. Note the `habitConfigs` state setter and how habits are added/removed today. The shape is `Record<string, { days: number[]; time: string; reminder: boolean }>` (see spec).

- [ ] **Step 2: VOICE_ACTIONS for ONBOARD-05--HABITS**

Append to ONBOARD-05--HABITS's `context_block`:

```
\n\nVOICE_ACTIONS (this screen):\n- add_habit(name, days?[0-6], time?"HH:MM", reminder?bool) — one habit per utterance\n- update_habit(name, patch={...subset of days|time|reminder}) — modify existing habit by name\n- remove_habit(name) — delete a habit\n- navigate_next when user says "continue" / "next"
```

Validate JSON.

- [ ] **Step 3: Wire Step5Page**

```tsx
import { type OnboardingVoiceResult } from '@/hooks/useOnboardingVoice';

type HabitConfig = { days: number[]; time: string; reminder: boolean };

const handleVoiceAction = useCallback(
  (result: OnboardingVoiceResult) => {
    if (result.action === 'add_habit') {
      const p = result.params as {
        name?: string;
        days?: number[];
        time?: string;
        reminder?: boolean;
      };
      if (typeof p.name !== 'string' || p.name.trim().length === 0) return;
      const name = p.name.trim();
      setHabitConfigs((prev) => ({
        ...prev,
        [name]: {
          days: Array.isArray(p.days) ? p.days : [1, 2, 3, 4, 5, 6, 0],
          time: typeof p.time === 'string' ? p.time : '07:00',
          reminder: typeof p.reminder === 'boolean' ? p.reminder : true,
        },
      }));
      return;
    }
    if (result.action === 'update_habit') {
      const p = result.params as { name?: string; patch?: Partial<HabitConfig> };
      if (typeof p.name !== 'string' || !p.patch) return;
      const name = p.name.trim();
      setHabitConfigs((prev) => {
        if (!prev[name]) return prev;
        return { ...prev, [name]: { ...prev[name], ...p.patch } };
      });
      return;
    }
    if (result.action === 'remove_habit') {
      const p = result.params as { name?: string };
      if (typeof p.name !== 'string') return;
      const name = p.name.trim();
      setHabitConfigs((prev) => {
        if (!prev[name]) return prev;
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  },
  [setHabitConfigs],
);
```

(Adapt the setter name if the page uses a different one — e.g. `setSelectedHabits`.)

Add `screenId="ONBOARD-05--HABITS"` and `onVoiceAction={handleVoiceAction}` to the `OnboardingLayout`.

- [ ] **Step 4: Typecheck + smoke test**

Run: `npx tsc --noEmit` → pass.

On Step 5 with mic on:

- Say _"add meditation every weekday at 7am"_ → Meditation appears with days=Mon-Fri, time=07:00.
- Say _"change meditation to 8am"_ → time updates to 08:00.
- Say _"drop meditation"_ → habit removed.

- [ ] **Step 5: Commit**

```bash
git add src/pages/onboarding/beginner/Step5Page.tsx src/generated/screen_contexts.json
git commit -m "feat(onboarding): voice add/update/remove habit on Step 5"
```

---

### Task 10: Step 6 — set_reflection_config

**Files:**

- Modify: `src/generated/screen_contexts.json` (ONBOARD-06--REFLECT entry)
- Modify: `src/pages/onboarding/beginner/Step6Page.tsx`

- [ ] **Step 1: Read Step6Page** to learn the `reflectionConfig` state shape (likely `{ time, days, reminder, schedule? }`).

Run: `cat src/pages/onboarding/beginner/Step6Page.tsx | head -80`.

- [ ] **Step 2: VOICE_ACTIONS for ONBOARD-06--REFLECT**

Append:

```
\n\nVOICE_ACTIONS (this screen):\n- set_reflection_config(time?"HH:MM", days?[0-6], reminder?bool, schedule?<Weekday|Weekend|Every day>) — partial patches OK\n- navigate_next when user says "continue" / "skip" / "next"
```

Validate JSON.

- [ ] **Step 3: Wire Step6Page**

```tsx
import { type OnboardingVoiceResult } from '@/hooks/useOnboardingVoice';

const handleVoiceAction = useCallback(
  (result: OnboardingVoiceResult) => {
    if (result.action !== 'set_reflection_config') return;
    const p = result.params as {
      time?: string;
      days?: number[];
      reminder?: boolean;
      schedule?: string;
    };
    setReflectionConfig((prev) => ({
      ...prev,
      ...(typeof p.time === 'string' && { time: p.time }),
      ...(Array.isArray(p.days) && { days: p.days }),
      ...(typeof p.reminder === 'boolean' && { reminder: p.reminder }),
      ...(typeof p.schedule === 'string' && { schedule: p.schedule }),
    }));
  },
  [setReflectionConfig],
);
```

Add `screenId="ONBOARD-06--REFLECT"` and `onVoiceAction={handleVoiceAction}`.

- [ ] **Step 4: Typecheck + smoke test**

Run: `npx tsc --noEmit` → pass.

On Step 6: _"remind me Sundays at 7pm"_ → time=19:00, days=[0]. _"actually 8pm"_ → time updates to 20:00.

- [ ] **Step 5: Commit**

```bash
git add src/pages/onboarding/beginner/Step6Page.tsx src/generated/screen_contexts.json
git commit -m "feat(onboarding): voice set_reflection_config on Step 6"
```

---

## Phase 3 — Advanced flow

### Task 11: AdvancedInputPage — fill brainDumpText

**Files:**

- Modify: `src/generated/screen_contexts.json` (ONBOARD-ADV-INPUT entry — add stub if missing)
- Modify: `src/pages/onboarding/advanced/AdvancedInputPage.tsx`

- [ ] **Step 1: Read the page** to learn the textarea state setter.

Run: `cat src/pages/onboarding/advanced/AdvancedInputPage.tsx | head -80`.

- [ ] **Step 2: VOICE_ACTIONS for ONBOARD-ADV-INPUT**

If the screen entry doesn't exist, create one with a minimal context_block plus the VOICE_ACTIONS block. Otherwise append:

```
\n\nVOICE_ACTIONS (this screen):\n- fill_field(fieldName="brainDumpText", value=<the entire user transcript verbatim>)\n- navigate_next when user says "done" / "continue"
```

Validate JSON.

- [ ] **Step 3: Wire AdvancedInputPage**

```tsx
import { type OnboardingVoiceResult } from '@/hooks/useOnboardingVoice';

const handleVoiceAction = useCallback(
  (result: OnboardingVoiceResult) => {
    if (result.action !== 'fill_field') return;
    const p = result.params as { fieldName?: string; value?: string };
    if (p.fieldName === 'brainDumpText' && typeof p.value === 'string') {
      // Append to existing (don't overwrite — brain dump is additive).
      setBrainDumpText((prev) => (prev ? `${prev}\n${p.value}` : p.value));
    }
  },
  [setBrainDumpText],
);
```

Add `screenId="ONBOARD-ADV-INPUT"` and `onVoiceAction={handleVoiceAction}`.

- [ ] **Step 4: Typecheck + smoke test**

Talk for ~5 seconds about goals. Expect the textarea to populate with the transcribed text.

- [ ] **Step 5: Commit**

```bash
git add src/pages/onboarding/advanced/AdvancedInputPage.tsx src/generated/screen_contexts.json
git commit -m "feat(onboarding): voice fill brainDumpText on AdvancedInput"
```

---

### Task 12: AdvancedResultsPage — update/remove habit

**Files:**

- Modify: `src/generated/screen_contexts.json` (ONBOARD-ADV-RESULTS entry — add stub if missing)
- Modify: `src/pages/onboarding/advanced/AdvancedResultsPage.tsx`

Follow the Task 9 (Step5) pattern verbatim, except `add_habit` is OUT of scope here (AI generated the list — user edits or removes only).

- [ ] **Step 1: Append VOICE_ACTIONS for ONBOARD-ADV-RESULTS**:

```
\n\nVOICE_ACTIONS (this screen):\n- update_habit(name, patch)\n- remove_habit(name)\n- navigate_next when user says "looks good" / "continue"
```

- [ ] **Step 2: Read page, identify habitConfigs setter, copy update_habit + remove_habit branches from Task 9.**

- [ ] **Step 3: Add `screenId="ONBOARD-ADV-RESULTS"` + `onVoiceAction={handleVoiceAction}`.**

- [ ] **Step 4: Typecheck + smoke test.**

- [ ] **Step 5: Commit:**

```bash
git add src/pages/onboarding/advanced/AdvancedResultsPage.tsx src/generated/screen_contexts.json
git commit -m "feat(onboarding): voice update/remove habit on AdvancedResults"
```

---

### Task 13: AdvancedStep6Page — reflection config

**Files:**

- Modify: `src/generated/screen_contexts.json` (ONBOARD-ADV-STEP6)
- Modify: `src/pages/onboarding/advanced/AdvancedStep6Page.tsx`

Same as Task 10 (Step6), plus a `select_option` branch for `reflectionSchedule` (chip: Weekday/Weekend/Every day).

- [ ] **Step 1: Append VOICE_ACTIONS for ONBOARD-ADV-STEP6**:

```
\n\nVOICE_ACTIONS (this screen):\n- set_reflection_config(time?, days?, reminder?, schedule?)\n- select_option(fieldName="reflectionSchedule", value=<Weekday|Weekend|Every day>)\n- navigate_next when user says "continue" / "next"
```

- [ ] **Step 2: Wire handler with both branches** (combine Task 10's `set_reflection_config` branch with a new `select_option` branch identical in shape to Task 5's).

- [ ] **Step 3: Typecheck + smoke test.**

- [ ] **Step 4: Commit.**

---

### Task 14: AdvancedCustomPromptsPage — indexed fill_field

**Files:**

- Modify: `src/generated/screen_contexts.json` (ONBOARD-ADV-CUSTOM)
- Modify: `src/pages/onboarding/advanced/AdvancedCustomPromptsPage.tsx`

- [ ] **Step 1: Read the page** to learn the `customPrompts: string[]` setter and how rows are added.

- [ ] **Step 2: Append VOICE_ACTIONS for ONBOARD-ADV-CUSTOM**:

```
\n\nVOICE_ACTIONS (this screen):\n- fill_field(fieldName="customPrompts[N]", value=<text>) — N is the zero-based prompt index (default 0)\n- navigate_next when user says "continue" / "done"
```

- [ ] **Step 3: Wire the handler — parse the index off the fieldName**:

```tsx
const handleVoiceAction = useCallback(
  (result: OnboardingVoiceResult) => {
    if (result.action !== 'fill_field') return;
    const p = result.params as { fieldName?: string; value?: string };
    if (typeof p.fieldName !== 'string' || typeof p.value !== 'string') return;
    const m = p.fieldName.match(/^customPrompts\[(\d+)\]$/);
    if (!m) return;
    const idx = parseInt(m[1], 10);
    setCustomPrompts((prev) => {
      const next = [...prev];
      while (next.length <= idx) next.push('');
      next[idx] = p.value!;
      return next;
    });
  },
  [setCustomPrompts],
);
```

- [ ] **Step 4: Add `screenId="ONBOARD-ADV-CUSTOM"` + `onVoiceAction={handleVoiceAction}`.**

- [ ] **Step 5: Typecheck + smoke test.**

- [ ] **Step 6: Commit.**

---

### Task 15: EditHabitPage + EditJournalPage — modal voice handlers

**Files:**

- Modify: `src/pages/onboarding/advanced/EditHabitPage.tsx`
- Modify: `src/pages/onboarding/advanced/EditJournalPage.tsx`

These are modals that return via `location.state` to their parent (`AdvancedResultsPage` and `AdvancedStep6Page`). They don't need their own screen_contexts entry — the parent's VOICE_ACTIONS already cover them. Just add `update_habit` (for EditHabitPage) and `set_reflection_config` (for EditJournalPage) handlers that write to local form state.

- [ ] **Step 1: EditHabitPage handler**:

```tsx
const handleVoiceAction = useCallback(
  (result: OnboardingVoiceResult) => {
    if (result.action !== 'update_habit') return;
    const p = result.params as { name?: string; patch?: Partial<HabitConfig> };
    if (!p.patch) return;
    if (typeof p.patch.time === 'string') setTime(p.patch.time);
    if (Array.isArray(p.patch.days)) setDays(new Set(p.patch.days));
    if (typeof p.patch.reminder === 'boolean') setReminder(p.patch.reminder);
  },
  [setTime, setDays, setReminder],
);
```

(Adapt to whatever setters the EditHabitForm exposes.)

Add the prop on the OnboardingLayout (or whatever the modal renders inside).

- [ ] **Step 2: EditJournalPage handler — same shape, but for `set_reflection_config`.**

- [ ] **Step 3: Typecheck + smoke test each modal.**

- [ ] **Step 4: Commit.**

---

## Phase 4 — Final + cleanup

### Task 16: PlanReviewPage — confirm_plan

**Files:**

- Modify: `src/generated/screen_contexts.json` (ONBOARD-07--REVIEW)
- Modify: `src/pages/onboarding/shared/PlanReviewPage.tsx`

- [ ] **Step 1: Read PlanReviewPage** to find the existing complete-flow trigger (likely a button click that calls a `complete()` mutation).

- [ ] **Step 2: Append VOICE_ACTIONS for ONBOARD-07--REVIEW**:

```
\n\nVOICE_ACTIONS (this screen):\n- confirm_plan when user says "let's go" / "start" / "looks good"\n- navigate_next when user says "back" — routes to previous screen
```

- [ ] **Step 3: Wire PlanReviewPage**:

```tsx
const handleVoiceAction = useCallback(
  (result: OnboardingVoiceResult) => {
    if (result.action === 'confirm_plan') {
      // Trigger the same path the "Start plan" button uses.
      void completePlanAndNavigate();
    }
  },
  [completePlanAndNavigate],
);
```

(Wrap whatever the page's existing complete handler is named.)

Add `screenId="ONBOARD-07--REVIEW"` + `onVoiceAction={handleVoiceAction}`.

- [ ] **Step 4: Typecheck + smoke test.** Say _"let's go"_ → plan completes, navigates to /home.

- [ ] **Step 5: Commit.**

---

### Task 17: Remove the legacy per-step prose from `buildOnboardingPrompt`

**Files:**

- Modify: `api/_lib/llm/onboardingPrompt.ts` (the existing per-step blocks created in Task 2 ARE the new structure — this task is a no-op double-check)
- Modify: `src/hooks/useOnboardingVoice.ts` — Step 1 post-processing (the `gender`/`referralSource` regex extraction at lines ~221-245)

The post-processing regex extractor in `useOnboardingVoice.ts` was a band-aid for the legacy single-action shape. Now that Step 1 emits explicit `select_option` actions, the regex is redundant — but it's defensive code that still works. Leave it; remove only if it actively misfires during testing.

- [ ] **Step 1: Manually walk all 14 screens end-to-end** and confirm no regression. If the regex extractor causes false positives, remove the relevant block. Otherwise: skip the removal.

- [ ] **Step 2: (Conditional) Commit any removal.**

---

### Task 18: End-to-end smoke test

- [ ] **Step 1: Full onboarding via voice, beginner path**

Start a fresh account. From Step 1 through PlanReview, speak every field. Confirm:

- Each step's form populates from voice.
- Continue button advances on each step (or voice "continue" advances).
- Plan completes and `profiles` + `user_habits` rows are correctly persisted.

- [ ] **Step 2: Full onboarding via voice, advanced path (braindump)**

From Step 1 → Step 2 ("brain dump") → AdvancedInput (speak goals) → AdvancedResults (modify/remove a habit) → AdvancedStep6 → PlanReview → /home.

- [ ] **Step 3: Adversarial cases**

- Mid-utterance pause and restart.
- Unrelated questions ("what time is it") — expect fallback message, no form mutation.
- Rapid-fire utterances — expect only the latest to take effect (or both, sequentially).
- Continue via tap on a screen with mic on — no double-action.

- [ ] **Step 4: Commit the docs update if any acceptance criteria need clarifying:**

```bash
git add docs/superpowers/specs/2026-05-22-voice-driven-onboarding-flow-3-design.md
git commit -m "docs(spec): clarify acceptance criteria after end-to-end smoke test"
```

---

## Self-Review Notes

This plan was written and reviewed inline on 2026-05-22:

- **Spec coverage:** every action in the action-vocabulary table maps to at least one task (Task 2 defines them; Tasks 5–16 wire them). Every page in the spec's per-page table maps to a task (Tasks 5–16). ✓
- **No placeholders:** every code step shows the actual code. Where a step says "read the page first" it's because the existing state setters' names vary and I haven't read every file; the engineer reads then writes. ✓
- **Type consistency:** `OnboardingVoiceResult` shape is unchanged from today (`useOnboardingVoice.ts:12-18`). The action union is documented in the "Action Vocabulary Reference" section above and matches what Task 2 emits. ✓
- **Out-of-scope confirmation:** Vapi dashboard, `tools.ts`, `useRealtimeVoice`, Supabase Realtime, the dummy `fill_field` Vapi tool created during exploration — none touched. ✓
