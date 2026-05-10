# Path 1 — Tools, Side Effects, and the Auto-Fill Pattern

How Path 1 makes "voice does the form filling and navigation." This is the substance that survives the Cartesia → Vapi migration unchanged in shape, only changed in source.

## The pattern

```
LLM emits a tool call ("save these onboarding fields")
   ↓
Vapi POSTs the tool args to your webhook   (target — today: Python tools.py runs in-process)
   ↓
Webhook writes to Supabase (service role, bypasses RLS)
   ↓
Supabase Realtime fans out the row update
   ↓
useOnboardingRealtimeSync invalidates React Query
   ↓
Form re-reads onboarding_states.data → fields auto-fill
   ↓
If current_step bumped → frontend routes onward
```

The bridge between "agent did something" and "UI reflects it" is **Supabase Realtime**, not the voice transport. Vapi (and legacy Line) do not forward tool results to the browser by default.

## Why Realtime, not direct return

- The voice transport is for **audio**, not data. Tool results are data.
- A Realtime subscription is a single bus that any number of UI components can listen to without coupling to the voice provider.
- Survives provider swap: Cartesia Line → Vapi changes the *write source* but not the *read path*.

## The 8 onboarding tools

These are the functions today's Cartesia Line agent can call. Each survives into the Vapi assistant config — same name, same args, same write semantics. Only the runtime location changes (Python in `gcartesia-agents/tools.py` → Vercel function in `/api/vapi-tool`).

| Tool | Writes to | Notes |
|---|---|---|
| `record_onboarding_profile` | `onboarding_states.data` (merge) | ONBOARD-01 only. Partial calls OK. |
| `update_onboarding_data` | `onboarding_states.data` (merge) + `current_step` | Generic field-saver for screens 02–09 |
| `navigate_next` | `onboarding_states.current_step` | No `last_completed_screen` column — advance is signalled by step bump |
| `get_user_context` | reads `profiles`, `user_preferences`, `habits`, `checkins` | Returns formatted text for the LLM |
| `update_profile` | `profiles` (nickname) + `user_preferences` (style/voice_mode) | Splits identity vs settings |
| `log_checkin` | `checkins` upsert on `(user_id, date)` | Mood/sleep/energy/stress clamped 1–5 |
| `get_habits` | reads `habits` + today's `entries` | Returns "done / not yet" per habit |
| `log_goal` | `daily_goals` upsert on `(user_id, date)` | |

**Discipline rules (carry into Vapi assistant config):**
- All tools take `user_id` from session metadata (never trust LLM-provided user IDs).
- All tools must catch errors and return a string. Raising hangs up the call (Cartesia Line behavior; Vapi behavior may differ — verify, but treat as same rule).
- Service-role connection bypasses RLS. Isolation is by `WHERE user_id = $1` in every query — same pattern as the web app's API layer.

## Onboarding tool-call discipline

Embedded in the system prompt today as `onboarding_instruction`. Carry into the Vapi assistant prompt:

1. FIRST call `record_onboarding_profile` (or `update_onboarding_data`) with whatever fields the assistant heard, even partials.
2. THEN speak the greeting / response.

If the assistant skips the tool call, the form doesn't auto-fill. Don't relax this rule.

## CRISIS_BOUNDARY — non-negotiable

The crisis-handling block sits **above** brevity / coaching-style rules in the system prompt. Per task P1-29.

Today's prompt assembly order (in `gcartesia-agents/main.py:build_system_prompt`):

```
CORE_IDENTITY
CRISIS_BOUNDARY        ← MUST stay above RESPONSE_RULES
RESPONSE_RULES
COACHING_STYLES[style] ← warm | direct | reflective (defaults to warm)
voice rules + screen-context protocol
```

When migrating to Vapi, replicate this order verbatim in the assistant's system prompt. If you find yourself reordering or "cleaning up" CRISIS_BOUNDARY, stop — it's intentional.

## Side-effect bridge — `useOnboardingRealtimeSync`

`src/hooks/useOnboardingRealtimeSync.ts` subscribes once to `supabase.channel('onboarding-states:{userId}')` filtered to `table=onboarding_states`. On row update, invalidates React Query so the form re-reads `data` and `current_step`.

This is the single piece of code that bridges agent tool writes and the UI. Without it, the form wouldn't auto-fill from voice.

**Migration impact:** zero. The hook reads from Supabase, not from Cartesia. Switching to Vapi changes who writes the row, not who reads it.

## Per-screen prompt injection

Today: `_format_screen_context(metadata.screen)` looks up the row in `gcartesia-agents/screen_contexts.json` and appends the `AI Context / Expected User Response / AI Response / Edge Cases / Notes` block to the system prompt at session start.

Target: Vapi assistant reads from `screen_contexts` table (Supabase) via callLLM ctx. The JSON file goes away once the Supabase table is the source of truth.

Migration is in flight: `supabase/migrations/016_screen_contexts_and_session_log.sql` creates the table; `scripts/voice-sync/seed_contexts.py` seeds it from the Voice Journey Sheet. Wiring it into the legacy Python agent (P1-42) and into the Vapi assistant ctx are both pending.

## Adding a new tool (target — Vapi)

1. Add a handler branch in `/api/vapi-tool` (or a per-tool Vercel function) — write to Supabase via service role; return a string result.
2. Register the tool in the Vapi assistant config (REST or dashboard) with name, description, args schema.
3. Tell the LLM when to call it via `screen_contexts.context_block` for screen-specific behavior, or via the assistant system prompt for global behavior.
4. Confirm `useOnboardingRealtimeSync` already covers the target table — if not, add a subscription.

## Adding a new tool (today — Cartesia Line)

1. Define `async def` in `gcartesia-agents/tools.py` with `ctx: ToolEnv` first, `Annotated[type, "desc"]` on every arg.
2. Always handle errors and return a string — never raise.
3. Add to `tools=[…]` in `main.py`'s `LlmAgent(...)`.
4. Tell the LLM when to call it via `screen_contexts.json` (preferred) or system prompt.
5. Redeploy: `cd ../gcartesia-agents && cartesia deploy`. Web app does not need to redeploy.

Both flows write to the same Supabase rows, so the side-effect chain is identical from the frontend's perspective.

## What Vapi/Cartesia do NOT forward to the browser

Confirmed for legacy Cartesia Line; treat as the default assumption for Vapi unless verified otherwise:

- Tool call requests
- Tool call results
- LLM tokens
- User transcripts
- Agent transcripts (text form of TTS)

If the UI needs any of those, route through Supabase. The current MVP only needs **tool side effects**, which Realtime delivers.

(If a Vapi feature explicitly forwards transcripts/tokens over the SDK, that's a "nice-to-have" channel for surfaces that want to render captions or text — but it's separate from the side-effect bridge above. Don't conflate them.)
