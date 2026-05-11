---
name: path-3-direct-llm
description: Path 3 — Text-only LLM path. Frontend → callLLM → LLM → frontend renders text. No voice infrastructure. Used for text chat surfaces and tap-driven LLM use cases (suggestions, summaries, parse-on-submit). Tap actions that don't need an LLM still write session_log so the next callLLM picks up the delta. Auto-invoked when working on text chat components, callLLM consumers from non-voice surfaces, the (target) /api/llm endpoint, session_log writes from text flows, or the "tap → session_log → LLM next time" pattern. NOT for onboarding voice (path-1-vapi) or check-in voice (path-2-async).
user-invocable: false
---

# Path 3 — Direct LLM (Text Chat)

Pure text. The user types or taps; the frontend calls `callLLM()`; the LLM responds with text; the frontend renders it. No mic, no STT, no TTS, no Vapi.

```
User → Frontend → callLLM() → LLM → Frontend renders text → User
```

Path 3 also covers the **"caught up" tap pattern** — tap-driven actions that don't call the LLM right now, but write to `session_log` so the next callLLM call (anywhere in the app) sees what happened.

## Reference files

- [surfaces.md](surfaces.md) — text chat surfaces and tap-driven LLM consumers
- [side-effects.md](side-effects.md) — session_log writes, "caught up" principle, when a tap *does* call the LLM vs just logs

## When Path 3 is the right path

- Surface is text-only (no audio output, no mic input).
- User is typing into a chat or tapping an action that maps to a CRUD or LLM-summary call.
- You want the LLM to know about an event but not respond to it right now.
- Background jobs (insights, summaries, suggested-next-habit) where there's no user audio at all.

## When Path 3 is the wrong path

- The surface is in the conversational onboarding journey → **Path 1** (Vapi).
- The surface needs to play voice prompts or speak responses → **Path 2** (Async composition).
- The action is purely a database write with no LLM involvement at all → no path; just write directly via DataService.

## How callLLM is involved

`callLLM()` is the single entry point for every LLM call across all three paths. For Path 3, it's the *only* dependency — there's no voice provider in the loop.

```ts
const response = await callLLM({
  userId,
  screenId,         // current screen, for screen_contexts ctx
  userInput: text,  // what the user typed, or a synthesized prompt for tap-driven flows
  channel: 'direct',
});
```

`callLLM()` prepends:
1. The `screen_contexts` row for `screenId` (where the user is)
2. The `session_log` delta since the last callLLM for `userId` (what happened since last call)
3. The base system prompt

Then it calls the LLM provider directly (no Vapi, no Cartesia). Records the timestamp. Returns the response.

**Status**: callLLM not built yet (P1-34). Today's text surfaces make ad-hoc OpenAI calls or skip the LLM entirely. The data foundation (`screen_contexts`, `session_log`) exists. See [voice-architecture/shared.md](../voice-architecture/shared.md).

## The "caught up" principle

This is the cost optimization that keeps the LLM aware without burning a token on every tap.

**Tap-driven actions** (add habit, log goal, complete check-off, change preference):

1. Write to `session_log` with `event_type` (e.g. `habit_added`) + payload.
2. Do NOT call the LLM right now.

**Later, when the user opens a surface that does call the LLM** (e.g. evening check-in via Path 2, or a chat surface via Path 3):

1. `callLLM()` runs.
2. Reads the `screen_contexts` row for the current screen.
3. Reads `session_log` rows since the last `recordLLMCallTimestamp(userId)`.
4. Sees `habit_added` (and anything else) in the delta.
5. Prepends both to the prompt.
6. The LLM can say "How did the new water habit go today?" — fully caught up.

Cheap and aware.

## Trigger points where Path 3 actually calls the LLM

- User submits text in a chat surface → `callLLM()` runs.
- User taps an action that explicitly asks for LLM help ("suggest a new habit", "summarize my week") → `callLLM()` runs.
- Background job runs (nightly insights, weekly summaries) → `callLLM()` runs server-side.
- A Path 1 (Vapi) session starts → that path's LLM call also goes through `callLLM()` (with `channel: 'vapi'`).

Everything else writes to `session_log` and waits.

## Anti-patterns

| Pattern | Why it's wrong |
|---|---|
| Calling OpenAI / Anthropic directly from a chat hook | Bypasses callLLM. LLM goes blind to screen_contexts + session_log. |
| Routing every tap through the LLM "for awareness" | Burns tokens. Use session_log instead — LLM reads delta on next call. |
| Skipping session_log writes "to save a request" | Breaks the delta. LLM gets out of sync. Always write the event. |
| Adding a fourth path | The doc forbids it. Extend callLLM (`channel: 'direct'`) or use a tool webhook (Path 1) or a composition piece (Path 2). |

## Side effects

Path 3 actions can still trigger the same side-effect pattern as Paths 1 and 2 — when the LLM's response includes a CRUD intent, it routes through the same `ActionDispatcher` → `DataService` → Supabase chain.

For tap-driven flows that are pure CRUD (no LLM), call DataService directly **and** write to session_log so the next LLM call is aware. See [side-effects.md](side-effects.md) for the exact pattern.

## Relationship to the other paths

| | Path 3 calls | Other paths call |
|---|---|---|
| `callLLM()` | yes — direct, with `channel: 'direct'` | Path 1: yes (`channel: 'vapi'`); Path 2: yes (`channel: 'direct'`) |
| `screen_contexts` table | yes — via callLLM ctx | yes — same |
| `session_log` table | yes — read (delta) + write (tap events) | yes — read on each callLLM; write at meaningful points |
| `ActionDispatcher` | optional — when LLM returns a CRUD intent | Path 2: yes (single-utterance commands). Path 1: replaced by Vapi tool webhooks. |
| Voice infra (Vapi / Cartesia) | **no** | Path 1: Vapi. Path 2: Cartesia Ink + Sonic. |
