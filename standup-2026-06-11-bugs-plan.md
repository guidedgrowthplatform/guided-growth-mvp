# Smoke-Test Bug Plan — 11 Jun 2026

Priority order from Yair: **#3, #4, #5, #6, #2, #1** (skip #7 latency).

Each bug below has: root cause, surface (file:line), fix, effort, risk. Cross-cutting insights at the end. Sequencing recommendation at the very end.

---

## #3 — "Tap the options on the screen" leaks into text chat

**Symptom:** In text-chat mode (no voice), the coach says "you can tap those on screen if you prefer" — there's nothing tappable in the chat overlay.

**Root cause (a):** The phrase is **literally hardcoded in the screen context bundle** — `src/generated/screen_contexts.json` ONBOARD-01--FORM, AI RESPONSE PATTERN block. The model is treating it as a few-shot example and copying it.

**Root cause (b):** The prompt-building pipeline has **no input-method awareness**. `buildSystemPromptForRequest()` (`api/_lib/llm/buildSystemPrompt.ts:13-22`) receives `coaching_style`, `screen_id`, `mode` (chat/opener), but NOT `input_method` or `ai_output_mode`. The same context block ships to voice users and text users — voice-only references leak.

**Surface:**

- `src/generated/screen_contexts.json` — ONBOARD-01--FORM AI RESPONSE PATTERN section (the literal phrase)
- `api/_lib/llm/buildSystemPrompt.ts:13-22` — `BuildSystemPromptArgs` interface, no input_method field
- `api/_lib/llm/stripForwardPointers.ts` — strips screen-id pointers but not visual-UI references

**Fix (recommended):** Two layers, both small.

1. **Bundle strip (immediate, 2 min):** Hand-edit ONBOARD-01--FORM and any other screens that say "tap" / "click" / "on screen" / "select on screen" — replace with neutral language or delete the phrase. Same approach we used for the ALLOWED TOOLS injection.

2. **Defensive stripper (15 min):** Add `stripVisualUIRefs()` next to `stripForwardPointers()`. Regex pipeline: kill `\btap\b`, `\bclick\b`, `\bbuttons on screen\b`, etc. Call it from `buildSystemPromptForRequest()` only when input is text. Requires plumbing `input_method` through `BuildSystemPromptArgs` and the `/api/llm` handler.

**Effort:** Layer 1 alone unblocks the smoke test. Layer 2 is a follow-up PR.

**Risk:** Layer 1 is byte-level edits to the bundle (no diff to logic). Layer 2 needs careful regex so we don't strip legitimate uses of "tap" (e.g. metaphorical "tap into your motivation"). Word-boundary regexes mitigate.

---

## #4 — "Are you ready to continue?" instead of auto-proceeding

**Symptom:** After the model captures data, it asks "ready to continue?" then waits for "yes" before calling navigate_next. User wants: data tool fires → navigate_next fires immediately (no confirmation turn).

**Root cause:** The "ask first" rule lives in **four reinforcing places**, all pointing the model at the same behavior:

1. `scripts/vapi-sync/assistant.ts:70,72` — managed RULE 3 step 2: "ask one short 'anything else for this screen?' question"
2. `api/_lib/llm/onboarding/systemPromptAddendum.ts:16` — STAY ON THIS SCREEN: "ask one short 'anything else, or shall we move on?' question"
3. **`api/_lib/llm/tools.onboarding.ts:407-413`** — navigate_next description: "**only AFTER the user has explicitly confirmed**… **Never call this without an explicit user confirmation.**"
4. `src/generated/screen_contexts.json` per-screen ALLOWED TOOLS blocks (the ones I just patched in) — say "ONLY after user explicitly confirms ready"

**Surface:** The navigate_next tool description (#3 above) is the **load-bearing one**. The other three reinforce. If you only edit one place, edit that.

**Tradeoff that needs a decision:** Auto-proceed is safe on **single-data screens** (profile, path, category, reflection — there's nothing left to add). On **multi-value screens** (habits, goals), auto-proceeding would trap the user mid-thought when they wanted to add a second habit.

**Recommended fix:** Split the rule per screen-type, not blanket auto-proceed:

- **Profile / Path / Category / Reflection:** auto-navigate immediately after the data tool returns (single value, complete by definition).
- **Goals / Habits:** keep "anything else?" guard — but make it one beat, not a full conversation. After the data tool fires, ONE short prompt; if no response or "no", navigate.

**Edits:**

1. `tools.onboarding.ts:407-413` — rewrite the navigate_next description: "For single-data screens (profile, path, category, reflection): call immediately after the data tool returns. For multi-value screens (habits, goals): ask ONE short 'anything else?' first."
2. `scripts/vapi-sync/assistant.ts` RULE 3 step 2 — mirror the per-screen logic
3. `bundle` per-screen ALLOWED TOOLS — drop "ONLY after user explicitly confirms" from single-data screens; keep on multi-value screens
4. `systemPromptAddendum.ts:16` — make the rule scope-aware

**Effort:** 30 min including testing the wording. One PR.

**Risk:** Auto-proceeding too aggressively on profile means if the user pauses mid-answer the model might fire. Mitigation: the data tool only fires when the model THINKS it has enough — that already implies a complete capture.

---

## #5 — Habits render as inline prose, not a list

**Symptom:** Coach says "your habits are walk more eat better sleep early" instead of a clean numbered/bulleted list.

**Root cause:** **No system-prompt rule telling the model to use lists.** Markdown rendering works (`ChatBubble.tsx` → `MarkdownMessage.tsx` parses `- item` and `1. item` correctly). The model just doesn't produce them.

**Secondary issue:** When the model DOES produce lists, `safeStreamPrefix()` in `src/lib/markdown/parse.ts:35` doesn't handle incomplete list markers — partial render can show `- walk mor` mid-stream before the next item finishes. Cosmetic but jarring.

**Surface:**

- `packages/shared/src/coaching/systemPrompt.ts` — core system prompt; no list rule
- `api/_lib/llm/checkin/systemPromptAddendum.ts` — check-in addendum; no list rule
- `src/lib/markdown/parse.ts:35` — `safeStreamPrefix()` for streaming safety
- `src/components/voice/ChatBubble.tsx`, `src/components/chat/MarkdownMessage.tsx` — renderers (already correct)

**Fix:**

1. **Prompt rule (primary, 5 min):** Add a `LIST_FORMATTING_RULE` constant to `packages/shared/src/coaching/systemPrompt.ts` and append it to the preamble:
   > "When listing multiple items (habits, goals, options, steps), always format as a markdown list — one item per line, prefixed with `- ` or `1.`. Never inline multiple items as comma-separated prose."
2. **Stream safety (optional, 15 min):** Extend `safeStreamPrefix()` to detect incomplete `- ` / `1. ` markers at the end of partial text and cut before them. Prevents the brief flash of broken-looking partial lists.

**Effort:** Fix 1 alone solves the user-visible bug. Fix 2 is polish.

**Risk:** Very low. List instructions are well-understood by LLMs.

---

## #6 — "I can't display the list of habits" on post-onboarding chat

**Symptom:** User asks the coach to read back their habits. Coach replies it can't. Real cause: the coach has no habit data in its prompt context on non-onboarding screens.

**Root cause:** `buildSystemPromptForRequest()` only fetches habit data **during onboarding** (`buildSystemPrompt.ts:94, 111-114` — `alreadyFilledBlock` is gated by `isOnboardingScreen`). On HOME / CHAT / MCHECK-\* screens, the coach has zero habit context. Worse — there's no `query_habits` tool available on those screens either, so the coach can't fetch on demand.

**Habit storage split:**

- During onboarding: `onboarding_states.data.habitConfigs`
- After onboarding: `user_habits` table

The post-onboarding path queries neither.

**Surface:**

- `api/_lib/llm/buildSystemPrompt.ts:94, 111-114` — onboarding gate on `alreadyFilledBlock`
- `api/_lib/llm/checkin/handlers/queryHabits.ts:36-40` — proves the `user_habits` query already exists for check-in tool
- `api/_lib/llm/checkin/systemPromptAddendum.ts:16` — documents the check-in tool list (does NOT include `query_habits` on CHAT/HOME)

**Fix (recommended):** Add a small `buildUserHabitsBlock()` helper and inject it for non-onboarding screens.

1. New helper in `buildSystemPrompt.ts`:
   ```ts
   async function buildUserHabitsBlock(anonId: string): Promise<string> {
     const res = await pool.query(
       `SELECT name, schedule_days, reminder_time FROM user_habits 
        WHERE anon_id = $1 AND archived_at IS NULL ORDER BY created_at`,
       [anonId],
     );
     if (res.rowCount === 0) return '';
     const lines = res.rows.map(
       (r, i) => `${i + 1}. ${r.name}${r.reminder_time ? ` @ ${r.reminder_time}` : ''}`,
     );
     return `\n\n## User's Active Habits\n${lines.join('\n')}\n`;
   }
   ```
2. Call it from `buildSystemPromptForRequest()` when `!isOnboardingScreen`.
3. Append to the system prompt alongside `alreadyFilledBlock`.

**Effort:** 20-30 min including a quick test.

**Risk:** Low. Pure additive query. The `user_habits` table is already used by the check-in tool, so schema is known.

**Bonus:** This also helps the coach respond intelligently on home/check-in screens (e.g. "how's the meditation going?" when meditation IS one of the configured habits).

---

## #2 — Text streams as broken fragments

**Symptom:** Replies arrive in disconnected chunks (e.g. "bad" alone, then later "weather today"). The streaming text doesn't flow as full sentences.

**Root cause:** Three layers compound:

1. **Backend** (`api/llm/[...path].ts:529-531`) forwards raw OpenAI `response.output_text.delta` events as-is — no word/sentence buffering.
2. **Frontend `useLLM`** (`src/hooks/useLLM.ts:114-115`) appends each delta to state via setState — no coalescing across rapid deltas.
3. **`StreamingText`** (`src/components/voice/ChatBubble.tsx:15-24`) renders last char with `animate-fade-in` — when prefix happens to end mid-word, user sees the partial word as a visually-emphasized fragment.

`useSmoothReveal` tries to animate char-by-char but races against incoming deltas, producing visible "jumps" when fresh text lands mid-animation.

**Surface:** All three lines above.

**Fix (recommended):** **One change, frontend-only.** Debounce-coalesce deltas in `useLLM`.

```ts
// useLLM.ts — replace per-delta setState with a coalesced flush
const deltaBufferRef = useRef('');
const flushTimerRef = useRef<number | null>(null);

case 'delta': {
  acc += e.content;
  deltaBufferRef.current += e.content;
  if (flushTimerRef.current === null) {
    flushTimerRef.current = window.setTimeout(() => {
      setResponse((prev) => prev + deltaBufferRef.current);
      deltaBufferRef.current = '';
      flushTimerRef.current = null;
    }, 50); // 50ms coalescing window
  }
  break;
}
```

This batches deltas into 50ms windows — enough to absorb tokenization noise without feeling laggy. Pairs naturally with `useSmoothReveal` since the reveal animation has a stable target between flushes.

**Effort:** 15-20 min including testing.

**Risk:** Low. 50ms is well below human-perceptible streaming delay. If too laggy, drop to 30ms.

**Bonus:** Also helps #5 — coalesced flushes make partial markdown lists less likely to render mid-marker.

---

## #1 — Plan-review render loop ("Maximum update depth")

**Symptom:** Clicking "Start plan" on PlanReviewPage crashes with `Maximum update depth exceeded` before navigating to `/home`.

**Root cause (precise):** Race between `useOnboarding.completeMutation.onSuccess()` and AppGate.

Sequence:

1. User clicks → `handleStartPlan()` → `complete()` queues the mutation
2. Mutation pending: `isCompleting=true`, page re-renders, effect skips (guard at PlanReviewPage:114)
3. `onSuccess` fires: `setQueryData()` flips status to 'completed' (useOnboarding.ts:84-89)
4. **Two subscribers see the cache change at the same time:**
   - `useAppGate` flips `gate.status` to `'ready'` → AppGate renders `<Navigate to="/" replace />`
   - PlanReviewPage re-renders with new `state`
5. `handleStartPlan` is `useCallback([state, complete])` — `state` changed, so the **callback ref changes**
6. The auto-complete `useEffect` (lines 112-120) has `handleStartPlan` in its deps → re-runs
7. The `autoCompletedRef` guard catches it most of the time, but there's a window where the re-render chain compounds (Sentry guard at line 149, then state recomputation in `useMemo`, etc.) — React hits the 50-update limit before AppGate's `<Navigate>` actually completes the unmount.

**The structural problem:** `handleStartPlan` doesn't navigate. It relies on `onSuccess` to navigate async. During the async gap, both PlanReviewPage and AppGate fight to react to the same cache update, and the re-render chain spirals.

**Surface:**

- `src/hooks/useOnboarding.ts:84-105` — onSuccess body (where `navigate('/home')` is called at line 104, AFTER `await updateProfile()`)
- `src/pages/onboarding/shared/PlanReviewPage.tsx:89-108` — handleStartPlan (no navigate inside)
- `src/pages/onboarding/shared/PlanReviewPage.tsx:112-120` — auto-complete effect with `handleStartPlan` in deps

**Fix (recommended):** Navigate synchronously in `handleStartPlan` immediately after `complete()`. Don't wait for onSuccess.

```ts
// PlanReviewPage.tsx — handleStartPlan
const handleStartPlan = useCallback(() => {
  if (!state?.habitConfigs) return;
  track('complete_onboarding', {
    /* ... */
  });
  localStorage.removeItem('gg_onboarding_started_at');
  complete({
    /* ... */
  });
  navigate('/home', { replace: true, state: { fromOnboarding: true } }); // ← add this
}, [state, complete, navigate]);
```

And **remove** the redundant `navigate('/home')` at `useOnboarding.ts:104` (or guard it for the rare case complete() is called without page context).

This unmounts PlanReviewPage immediately, so the cache-change cascade doesn't have a target to loop on. AppGate still does its thing, but the page is gone before the second re-render hits.

**Alternative if the above breaks anything:** Move `complete()` to be awaited inside an async handleStartPlan, then navigate. That way the order is deterministic.

**Effort:** 10 min code + 10 min test (need to verify the full onboarding flow ends correctly and ends up at home).

**Risk:** Low-medium. The current navigate in onSuccess does other things (`updateProfile`, `clearOnboardingChatSessionId`) — make sure those still run.

---

## Cross-cutting insights

1. **Path 3 (Direct-LLM text chat) is the weakest path.** Bugs #3, #5, #6 all stem from the same root: the prompt-building pipeline was designed for voice (Vapi) and onboarding, and treats text-chat / post-onboarding as a generic fallback. The pipeline needs more `input_method`/`screen_type` awareness.

2. **The system prompt has no "presenting options" formatting rule.** That's not just bug #5 — it's a class of bugs (lists, choices, numbered steps will all suffer).

3. **The auto-complete effect on PlanReviewPage is fragile.** It exists to handle the voice "let's go" → confirm_plan path, where the agent bumps `current_step` past 7 from the server. Even with the fix in #1, that effect needs a closer look — the `handleStartPlan` dep is a footgun.

4. **The bundle patches I just shipped will reinforce #4.** The ALLOWED TOOLS blocks say "ONLY after user explicitly confirms ready" — which is exactly the "ask first" rule the user wants relaxed. We need to coordinate edits to (3) and the bundle if we want consistent behavior.

---

## Recommended execution sequencing

Group into 3 PRs to keep diffs reviewable. Priority order is respected — bugs land in your priority order within each PR.

### PR 1 — Prompt-rule cleanups (#3, #4, #5)

- **#3 layer 1:** Hand-strip the `screen_contexts.json` ONBOARD-01--FORM phrase + audit other screens.
- **#4:** Rewrite `navigate_next` description in `tools.onboarding.ts` (load-bearing edit). Update bundle ALLOWED TOOLS blocks for single-data screens. Update managed RULE 3 step 2 + addendum line 16.
- **#5 part 1:** Add `LIST_FORMATTING_RULE` to `packages/shared/src/coaching/systemPrompt.ts`.

Single sync (`npm run vapi:sync -- --dev`) covers Vapi-side updates. ~60 min total.

### PR 2 — Data plumbing & streaming (#6, #2, #5 polish)

- **#6:** Add `buildUserHabitsBlock()` helper; inject for non-onboarding screens in `buildSystemPrompt.ts`.
- **#2:** Add delta coalescing in `useLLM`.
- **#5 part 2:** Extend `safeStreamPrefix()` for list-marker awareness.

~50 min total. No Vapi sync needed.

### PR 3 — Plan-review fix (#1, CRITICAL)

- **#1:** Add synchronous `navigate('/home')` to PlanReviewPage `handleStartPlan`. Remove duplicate in `useOnboarding.onSuccess` (or keep as fallback). Verify full beginner flow ends at home.

~20 min code + manual test. Recommend doing this **first** even though it's last in priority — it's blocking onboarding completion in QA.

---

## What I need from you before I start cutting code

1. **Per-screen auto-proceed scope for #4:** Confirm the split — single-data screens auto-navigate, multi-value (habits, goals) keep the ONE confirmation prompt. Or do you want blanket auto-proceed and we live with the trap on habits/goals?

2. **Bug #6 scope:** "User's active habits" injected on all non-onboarding screens? Including the chat overlay during home screen? Or only when the user explicitly asks?

3. **Bug #1 fix style:** Sync navigate from PlanReviewPage (my recommendation), OR refactor `complete()` to navigate inline synchronously (bigger change, cleaner long-term)?

Once you answer those three, I'll execute PR 1 → 3 in sequence. Total estimated time: ~2.5 hours of focused work.
