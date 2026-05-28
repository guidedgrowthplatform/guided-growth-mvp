# Path 3 — Side Effects, session_log, and the "Caught Up" Pattern

How Path 3 surfaces (UX-26 States 2/3/4) trigger DB writes, frontend changes, and LLM awareness — without going through Vapi.

## Two kinds of side effects

### 1. LLM-driven (chat surface returns an intent)

The user types something in a chat surface. callLLM returns a response that includes a CRUD intent (snake_case tool name like `update_profile`, `navigate_next`, or `log_event`). The intent is dispatched the same way path-2-async does it.

```
User types: "I just finished my morning meditation"
    ↓
callLLM()
    ↓
LLM returns: { reply: "Nice! Logged.", tool: "log_event", params: { entity: "habit", name: "meditation" }, confidence: 0.92 }
    ↓
Frontend renders reply text
    ↓
ActionDispatcher dispatches the intent → DataService → Supabase
    ↓
session_log write: event_type='habit_completed', payload={...}
```

The dispatcher branch is the same as path-2-async — just invoked from a text response instead of a transcribed voice utterance.

### 2. Tap-driven (no LLM involved right now)

The user taps an action button. We write to Supabase directly via DataService and write to session_log. No LLM call.

```
User taps "Add habit: water" button
    ↓
DataService.createHabit({ name: "water" }) → Supabase
    ↓
session_log write: event_type='habit_added', payload={ habit_name: 'water' }
    ↓
React Query invalidates → UI updates
```

The LLM finds out next time `callLLM()` runs (anywhere in the app).

## Why both patterns matter

Both keep `session_log` honest. The LLM's awareness depends on **every meaningful event** being in the log — not just the ones routed through it. Skipping a session_log write to "save a request" breaks the delta and gives the LLM a stale picture.

## The "caught up" sequence

```
Time 0: User opens a screen that calls the LLM.
        callLLM() runs.
        Last LLM timestamp recorded: T0.

Time 1: User taps "complete habit: meditation".
        DataService writes habit_completion row.
        session_log write: event_type='habit_completed', timestamp T1.
        No LLM call.

Time 2: User taps "log goal: walk 5000 steps".
        DataService writes daily_goals row.
        session_log write: event_type='goal_logged', timestamp T2.
        No LLM call.

Time 3: User opens the next screen that calls the LLM.
        callLLM() runs.
        Reads session_log rows for user since T0.
        Sees: habit_completed (T1), goal_logged (T2).
        Prepends to prompt as state delta.
        LLM can say: "Nice work yesterday — you completed meditation and walked 5000 steps. Same goals today?"
        Last LLM timestamp updated to T3.
```

The LLM was silent during the taps. It's fully aware by the next call. **Cheap and aware.**

## When a tap *should* call the LLM

Most taps shouldn't. But these do:

- **Tap explicitly asks for LLM help** — "Suggest a new habit", "Summarize my week", "Why am I missing my goals?". These taps map to a synthesized prompt → callLLM → render response.
- **Tap submits a form whose meaning needs interpretation** — e.g. a free-form journal entry that should produce a coaching reply. The save itself is a DataService write; the LLM call is a separate `callLLM()` invocation triggered by the same tap.

When in doubt: if the tap's purpose is "do this thing", skip the LLM. If the tap's purpose is "tell me / suggest / interpret", call the LLM.

## Side-effect chain — same shape as Path 1 and path-2-async

The pattern repeats across all three paths:

```
Source of intent → Side-effect handler → Supabase write → UI updates
```

| Path | Source | Handler | UI bridge |
|---|---|---|---|
| Path 1 | Vapi tool call | Vapi tool webhook (`/api/vapi-tool`) | Supabase Realtime → useOnboardingRealtimeSync |
| path-2-async | callLLM intent (or legacy `/api/process-command` intent) | ActionDispatcher | React Query invalidate |
| Path 3 (chat / STT) | callLLM intent OR onboarding tool call OR tap action | ActionDispatcher OR onboarding dispatch OR direct DataService | React Query invalidate; Supabase Realtime; session_log write |

Same shape, different sources. Don't invent new patterns.

## Onboarding tool-driven side effects (path-3)

On `ONBOARD-*` screens path-3 routes tool calls through a dedicated dispatcher with its own handlers. This is the same data sink as path-1 (Vapi) but invoked in-process by `/api/llm` rather than via a Vapi webhook.

```
User types in OnboardingChatOverlay (text_only / voice_in_only / voice_out_only)
    ↓
useLLM.sendMessage → /api/llm streaming
    ↓
OpenAI Responses API returns tool_call (e.g. submit_profile)
    ↓
dispatchOnboardingToolCall (api/_lib/llm/onboarding/dispatch.ts)
    ↓
handler UPSERTs onboarding_states (anon_id key, GREATEST(current_step, X), JSONB || merge)
    ↓
tool_result emitted on SSE; handler echoes merged `data` + `current_step`
    ↓
Two parallel UI bridges converge:
  (a) Supabase Realtime → useOnboardingRealtimeSync → queryKeys.onboarding.state cache
  (b) OnboardingChatOverlay merges tool_result.result.data into the cache (Realtime fallback)
    ↓
page-level handleVoiceAction (via the toolEventToVoiceActions adapter) updates local form state
    ↓
auto-advance ~200ms after a successful submit_* (gated by handleNext page validation)
```

Notes:
- `anon_id` is injected from the session inside `dispatchOnboardingToolCall`; the LLM schemas never expose it.
- Path-1 and path-3 hit the same `onboarding_states` rows; the `GREATEST` guard + JSONB `||` merge make concurrent writes commutative.
- The local cache merge (b) is shape-preserving: it never writes a partial `OnboardingState`, only patches `data` + `current_step` + `updated_at` on existing rows.
- "## Already-Filled Fields" is injected into the system prompt from `onboarding_states.data` (see `buildSystemPromptForRequest`) so the LLM doesn't re-ask across session restart.

## When NOT to use ActionDispatcher

ActionDispatcher is for intents that fit the `{ action, entity, params, confidence }` shape (CRUD-ish operations). It's the right destination for:
- Things the LLM might also do via a single-utterance command (path-2-async)
- Tap actions that mirror a voice command

It's the wrong destination for:
- Pure form submits with structured data (just call DataService directly)
- Multi-step flows (those need their own state machine)
- Side effects on the UI that aren't DB writes (toasts, navigation — handle in the consuming component)

## session_log write API

`POST /api/session_log` (target — P1-32, not built yet).

Request shape:

```ts
POST /api/session_log
{
  user_id: uuid,
  session_id: string,
  event_type: string,    // e.g. 'habit_added'
  screen_id?: string,    // current screen
  payload?: jsonb        // event-specific details
}
```

Response: `{ id: bigserial }`.

The frontend should call this from every meaningful action handler. Centralize in a `useSessionLog` hook or a small wrapper around `fetch`.

## What goes in the payload

Be specific enough that the LLM can reconstruct what happened from the delta alone:

```jsonc
// good — LLM can reference the habit by name
{ event_type: 'habit_added', payload: { habit_name: 'meditation', frequency: 'daily' } }

// bad — LLM only sees an opaque ID
{ event_type: 'habit_added', payload: { habit_id: 'a3f1e...' } }
```

Trade-off: payload size vs LLM-friendliness. Include the human-readable form (name, label, value) in addition to any IDs that the dispatcher will need.

## Don't bypass

| Bypass | Consequence |
|---|---|
| Tap calls DataService but skips session_log | LLM never sees the event. Goes blind to that activity. |
| Chat surface calls OpenAI directly | Skips screen_contexts ctx + session_log delta. LLM uses base system prompt only. |
| LLM intent dispatched without confidence check | Low-confidence actions execute silently. User loses control. |
| Tap simulates voice command via `/api/process-command` (today) | Wastes a NLU call for a structured action. Just call DataService. |
