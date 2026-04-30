# Agent Runtime — `gcartesia-agents/`

The Python agent that Cartesia Line spawns per call. Single-file architecture. Deployed with `cartesia deploy` (config in `cartesia.toml`).

## Files

| File | Role |
|------|------|
| `main.py` | `LlmAgent` setup, system prompt assembly, per-screen intros, run/cancel filters, `VoiceAgentApp` entry |
| `tools.py` | 8 tool functions, all using `aiohttp` against Supabase REST |
| `screen_contexts.json` | Voice-Journey sheet export, keyed by sheet ID (`ONBOARD-01`, …) |
| `cartesia.toml` | `[app] name = "guided-growth-agent"` + build/run cmds |
| `requirements.txt` | `cartesia-line>=0.2.7`, `aiohttp`, `python-dotenv`, `loguru` |

## System Prompt Assembly

`build_system_prompt(coaching_style)` concatenates 5 ordered blocks:

```
CORE_IDENTITY
CRISIS_BOUNDARY        ← MUST stay above RESPONSE_RULES
RESPONSE_RULES
COACHING_STYLES[style] ← warm | direct | reflective (defaults to warm)
voice rules + screen-context protocol
```

Then `get_agent()` appends, at runtime:

```
ONBOARD-01 onboarding instruction (always)
"Your Current User ID is: {user_id}"
_format_screen_context(metadata.screen)   ← per-screen JSON block
```

**Screen-context lookup**: `_screen_id_to_sheet_key("onboard_03") → "ONBOARD-03"`. Only fields the sheet actually fills are emitted — AI Context, Expected User Response, AI Response, Edge Cases, Notes.

## Tools (`tools.py`)

| Tool | Writes to | Notes |
|------|-----------|-------|
| `record_onboarding_profile` | `onboarding_states.data` (merge) | ONBOARD-01 only. Partial calls OK. |
| `update_onboarding_data` | `onboarding_states.data` (merge) + `current_step` | Generic field-saver for screens 02–09 |
| `navigate_next` | `onboarding_states.current_step` | No `last_completed_screen` column — advance is signalled by step bump |
| `get_user_context` | reads `profiles`, `user_preferences`, `habits`, `checkins` | Returns formatted text for the LLM |
| `update_profile` | `profiles` (nickname) + `user_preferences` (style/voice_mode) | Splits between identity and settings tables |
| `log_checkin` | `checkins` upsert on `(user_id, date)` | Mood/sleep/energy/stress clamped 1–5 |
| `get_habits` | reads `habits` + today's `entries` | Returns "done / not yet" per habit |
| `log_goal` | `daily_goals` upsert on `(user_id, date)` | |

All tools:
- Take `ctx: ToolEnv` as first param + `Annotated[str, "..."]` for every arg.
- Return a string. **Never raise** — Cartesia hangs up the call on tool exceptions. Catch and return an error string instead.
- Use `_sb_get / _sb_upsert / _sb_update` helpers in `tools.py`. They short-circuit to `[] / None` if `SUPABASE_URL` is unset, so the agent boots even without DB env.
- Service-role connection bypasses RLS. Isolation is by `user_id=eq.{uuid}` filters in every query — same pattern as the web app's API layer.

## Run / Cancel Filters

```python
def _run_filter(event):
    return isinstance(event, (CallStarted, UserTurnEnded, UserTextSent, CallEnded))

def _cancel_filter(event):
    return isinstance(event, UserTurnStarted)
```

`UserTextSent` in `_run_filter` is the workaround for browser ScriptProcessor mics where Cartesia VAD doesn't fire `UserStateInput(IDLE)`. Without it the agent stays silent forever after the user speaks. Don't remove.

`get_agent` returns the tuple `(agent, _run_filter, _cancel_filter)` — `VoiceAgentApp` reads the filters from there.

## Per-Screen Intros

The `intros` dict in `get_agent()` maps `metadata.screen` → opening line. `onboard_01..09`, `morning`, `evening`. Falls back to `onboard_01`. These are spoken immediately on `CallStarted` regardless of what the LLM would say next.

## Onboarding Tool-Call Discipline

`onboarding_instruction` is appended to the prompt during onboarding — it tells the LLM:
1. FIRST call `record_onboarding_profile` with whatever fields it heard, even partials.
2. THEN speak the greeting.

Skipping the tool call breaks the form auto-fill. Don't relax this in the prompt.

## Adding a New Tool

1. Define an `async def` in `tools.py` with `ctx: ToolEnv` first and `Annotated[type, "desc"]` on every arg.
2. Always handle errors and return a string — never raise.
3. Import and add to the `tools=[…]` list in `main.py`'s `LlmAgent(...)`.
4. Tell the LLM when to call it via either the system prompt or `screen_contexts.json` (preferred for screen-specific behavior).
5. Redeploy: `cd ../gcartesia-agents && cartesia deploy`. The web app does NOT need to redeploy.

## Local Iteration

```bash
cd ../gcartesia-agents
cartesia chat 8000        # local dev — chat in terminal
cartesia deploy           # push to Cartesia
```

Both need `OPENAI_API_KEY` (or whichever provider matches `LLM_MODEL`), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. See protocol.md for the full env table.
