---
name: path-3-direct-llm
description: Path 3 — Direct LLM path for the three non-Vapi orb states (UX-26 States 2, 3, 4). Frontend → useLLM → /api/llm → frontend renders text (optionally spoken via TTS in State 2 (`tts-service.ts`), or driven by STT in State 3). No Vapi orchestration. Covers any surface running a non-Vapi orb combination — onboarding chat overlay, post-onboarding CHAT, tap-driven LLM consumers. Auto-invoked when working on the non-Vapi orb states (voice_out_only / voice_in_only / text_only), useLLM, /api/llm, /api/stt, or the onboarding parser. NOT for the Vapi orb State 1 (path-1-vapi) and NOT for daily check-ins (path-2-async).
user-invocable: false
---

# Path 3 — Direct LLM (Three Non-Vapi Orb States)

This skill covers Path 3 — the direct LLM path that runs UX-26 States 2, 3, and 4 wherever those orb combinations appear (onboarding chat overlay, post-onboarding CHAT, tap-driven LLM consumers). Path 1 (Vapi) owns State 1 (full duplex voice).

Per `gg-spec/docs/global-ux-rules.md`:
- **State 2** (AI on, mic off) — TTS via `tts-service.ts` speaks; user types or taps.
- **State 3** (AI off, mic on) — STT captures user speech; LLM reply rendered as text only, no audio.
- **State 4** (both off) — pure text in / text out.

All three states route through `useLLM` → `/api/llm` (or the onboarding parser for screen-bound flows). STT runs Soniox async via `/api/stt`.

```
User → Frontend → callLLM() → LLM → Frontend renders text → User
```

## Reference files

- [surfaces.md](surfaces.md) — surfaces that run the three non-Vapi orb states
- [side-effects.md](side-effects.md) — session_log writes and the "caught up" principle

## When Path 3 is the right path

- The surface is in orb State 2, 3, or 4 (anywhere in the app).
- The user is typing into a chat overlay or hearing TTS output without the mic open.
- STT captures user speech but the response is text-only (no TTS).
- Tap-driven LLM consumers (suggestions, summaries, parse-on-submit).

## When Path 3 is the wrong path

- The surface is in full duplex (orb State 1) → **Path 1** (Vapi).
- The surface is a daily check-in or single-utterance command → **Path 2** (async composition — `path-2-async`).

## How callLLM is involved

`callLLM()` is the single entry point for every LLM call across all three paths. For Path 3, it's the *only* dependency — there's no voice provider in the loop.

```ts
const response = await callLLM({
  userId,
  screenId,
  userInput: text,
});
```

A `channel` discriminator (e.g. `'direct'` vs `'vapi'`) is planned but not implemented — `useLLM` / `src/api/llm.ts` do not accept it today.

`callLLM()` prepends:
1. The `screen_contexts` row for `screenId` (where the user is)
2. The `session_log` delta since the last callLLM for `userId` (what happened since last call)
3. The base system prompt

Then it calls the LLM provider directly (no Vapi, no Cartesia). Records the timestamp. Returns the response.

**Status**: callLLM not built yet (P1-34). Today's text/STT surfaces make ad-hoc OpenAI calls or skip the LLM entirely. The data foundation (`screen_contexts`, `session_log`) exists. See [voice-architecture/shared.md](../voice-architecture/shared.md).

## The "caught up" principle

This is the cost optimization that keeps the LLM aware without burning a token on every tap.

**Tap-driven actions** (add a habit, log a goal, change a preference, accept a suggestion):

1. Write to `session_log` with `event_type` + payload.
2. Do NOT call the LLM right now.

**Later, when the next LLM call fires** (user types, or speaks in State 3, or opens a surface that calls callLLM):

1. `callLLM()` runs.
2. Reads the `screen_contexts` row for the current screen.
3. Reads `session_log` rows since the last `recordLLMCallTimestamp(userId)`.
4. Sees the tap events in the delta.
5. Prepends both to the prompt.
6. The LLM is fully caught up.

Cheap and aware.

## Trigger points where Path 3 actually calls the LLM

- User submits text in a chat surface → `callLLM()` runs.
- User finishes speaking in State 3 (STT transcript ready) → `callLLM()` runs.
- Tap explicitly asks for LLM help ("suggest a new habit", "summarize my week") → `callLLM()` runs.
- A Path 1 (Vapi) session starts → that path's LLM call also goes through `callLLM()` (channel discrimination planned, see above).

Everything else writes to `session_log` and waits.

## Anti-patterns

| Pattern | Why it's wrong |
|---|---|
| Calling OpenAI / Anthropic directly from a chat hook | Bypasses callLLM. LLM goes blind to screen_contexts + session_log. |
| Routing every tap through the LLM "for awareness" | Burns tokens. Use session_log instead — LLM reads delta on next call. |
| Skipping session_log writes "to save a request" | Breaks the delta. LLM gets out of sync. Always write the event. |
| Adding a fourth path | The doc forbids it. Extend callLLM (planned channel discriminator) or use a tool webhook (Path 1) or a composition piece (path-2-async). |

## Side effects

Path 3 actions can still trigger the same side-effect pattern as Path 1 and path-2-async — when the LLM's response includes a CRUD intent, it routes through the same `ActionDispatcher` → `DataService` → Supabase chain. Base tool names: `update_profile`, `navigate_next`, `log_event`, `get_user_context`.

For tap-driven flows that are pure CRUD (no LLM), call DataService directly **and** write to session_log so the next LLM call is aware. See [side-effects.md](side-effects.md) for the exact pattern.

## Onboarding tool-calling

On `ONBOARD-*` screens the LLM receives a per-screen tool set and the base tools are excluded. Eight tools in `api/_lib/llm/onboarding/schemas.ts`:

- `submit_profile` (ONBOARD-01--FORM)
- `submit_path_choice` (ONBOARD-FORK--FORM)
- `submit_category` (ONBOARD-BEGINNER-01)
- `submit_goals` (ONBOARD-BEGINNER-02)
- `add_habit` / `remove_habit` (ONBOARD-BEGINNER-03)
- `submit_reflection_config` (ONBOARD-BEGINNER-07)
- `submit_brain_dump` (ONBOARD-ADVANCED)

Gating: `getOnboardingTools(screen_id)` in `api/_lib/llm/onboarding/registry.ts`. The `allowedToolNames` gate in `api/llm/[...path].ts` rejects hallucinated base-tool calls on these screens.

Eager-call directive: `ONBOARDING_TOOL_ADDENDUM` in `api/_lib/llm/onboarding/systemPromptAddendum.ts`. The prompt also injects an "## Already-Filled Fields" block from `onboarding_states.data` so the LLM doesn't re-ask across session restart.

Handlers UPSERT into `onboarding_states` keyed on `anon_id` with `GREATEST(current_step, X)` monotonic guards and JSONB `||` merges. See [side-effects.md](side-effects.md) for the full chain.

## Relationship to the other paths

| | Path 3 calls | Other paths call |
|---|---|---|
| `callLLM()` | yes — direct (channel discriminator planned, not implemented) | Path 1: yes (via Vapi); path-2-async: yes (same callLLM entry) |
| `screen_contexts` table | yes — via callLLM ctx | yes — same |
| `session_log` table | yes — read (delta) + write (tap events) | yes — read on each callLLM; write at meaningful points |
| `ActionDispatcher` | optional — when LLM returns a CRUD intent (`update_profile`, `navigate_next`, `log_event`) | path-2-async: yes (single-utterance commands). Path 1: replaced by Vapi tool webhooks. |
| Voice infra (Vapi / Cartesia) | **no** | Path 1: Vapi. path-2-async: Cartesia Ink + Sonic. |
