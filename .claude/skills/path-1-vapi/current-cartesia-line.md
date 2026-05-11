# Path 1 — Current Cartesia Line Implementation (Legacy)

What's wired today. **Do not extend.** Reference only — for reading existing code, debugging the live MVP, and planning the migration.

## Repo split

```
~/Documents/Upwork/YA/
├── guided-growth-mvp/        ← THIS repo. Web app + Vercel functions.
└── gcartesia-agents/         ← SEPARATE repo. Python Line agent.
                                Deployed with `cartesia deploy`.
                                Lives at agent_2UrpaeEp9odZ136vo6LnWp.
```

Both share the same Supabase project. The agent writes via service-role REST; the web app reads via Supabase Realtime.

## File map (legacy Path 1 code)

### Vercel functions

| File | Purpose |
|---|---|
| `api/cartesia-agent-token.ts` | Mints 1h access token using server-only `CARTESIA_API_KEY`. POST only. Per-IP (20/min) + per-user (10/min) rate limits. |

### Browser-side (`src/`)

| File | Purpose |
|---|---|
| `lib/services/cartesia-agent.ts` | `CartesiaAgentClient` — framework-free WebSocket transport. States: idle → connecting → open → closing → closed. |
| `hooks/useRealtimeVoice.ts` | Mic capture, audio playback scheduling, state machine, PostHog telemetry. |
| `hooks/useOnboardingAgent.ts` | Per-screen wrapper — auto-start on mic-granted, plus realtime sync. |
| `hooks/useOnboardingRealtimeSync.ts` | Subscribes to `onboarding_states` row → React Query cache. The bridge for tool-write side effects. **Survives migration.** |
| `data/screen-contexts.json` | Frontend-side mirror of the Voice Journey sheet (display copy / button labels). Distinct from `gcartesia-agents/screen_contexts.json`, which feeds the LLM. |

### Python agent (`gcartesia-agents/`)

| File | Role |
|---|---|
| `main.py` | `LlmAgent` setup, system prompt assembly, per-screen intros, run/cancel filters, `VoiceAgentApp` entry. |
| `tools.py` | 8 tool functions, all using `aiohttp` against Supabase REST. |
| `screen_contexts.json` | Voice-Journey sheet export, keyed by sheet ID. |
| `cartesia.toml` | `[app] name = "guided-growth-agent"` + build/run cmds. |
| `requirements.txt` | `cartesia-line>=0.2.7`, `aiohttp`, `python-dotenv`, `loguru`. |

## Wire protocol (legacy)

WebSocket: `wss://api.cartesia.ai/agents/stream/{agentId}?access_token=…&cartesia_version=2026-03-01`

(Browsers can't set headers on WebSocket — token goes in query string.)

### Client → Server

| Event | Body | When |
|---|---|---|
| `start` | `{config:{input_format,output_format}, metadata:{user_id,screen,coaching_style}}` | Once, immediately on `onopen` |
| `media_input` | `{media:{payload:<base64 PCM>}}` | Continuous while mic captures |
| `dtmf` | `{digit:"0".."9"|"*"|"#"}` | Telephony only — not used in browser |
| `custom` | `{data:<any>}` | App-defined side channel (currently unused) |

### Server → Client

| Event | Body | Meaning |
|---|---|---|
| `ack` | `{stream_id, config}` | Session live. State → `open`. |
| `media_output` | `{media:{payload:<base64 PCM>}}` | TTS frame. Decode → schedule on AudioContext. |
| `clear` | `{}` | Drop any queued playback (user interrupted). |
| `transfer_call` | telephony-only | Ignored. |

### Audio formats

| ID | Sample rate | Used as |
|---|---|---|
| `pcm_16000` | 16 kHz, 16-bit LE mono | input (mic) |
| `pcm_44100` | 44.1 kHz, 16-bit LE mono | output (TTS — matches default device rate) |

Browser captures at the device rate, then `useRealtimeVoice` downsamples to 16 kHz before sending. Output is decoded straight into `AudioBuffer` at 44.1 kHz and scheduled with a moving cursor for gapless playback.

## System prompt assembly (legacy)

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

Screen-context lookup: `_screen_id_to_sheet_key("onboard_03") → "ONBOARD-03"`. Only fields the sheet actually fills are emitted — AI Context, Expected User Response, AI Response, Edge Cases, Notes.

## Run / Cancel filters

```python
def _run_filter(event):
    return isinstance(event, (CallStarted, UserTurnEnded, UserTextSent, CallEnded))

def _cancel_filter(event):
    return isinstance(event, UserTurnStarted)
```

`UserTextSent` in `_run_filter` is the workaround for browser ScriptProcessor mics where Cartesia VAD doesn't fire `UserStateInput(IDLE)`. Without it the agent stays silent forever after the user speaks. Don't remove (until the whole legacy path retires).

## Per-screen intros

The `intros` dict in `get_agent()` maps `metadata.screen` → opening line. `onboard_01..09`, `morning`, `evening`. Falls back to `onboard_01`. These are spoken immediately on `CallStarted` regardless of what the LLM would say next.

## Env vars (legacy)

### `gcartesia-agents/` (Cartesia deployment)

| Var | Required | Purpose |
|---|---|---|
| `LLM_MODEL` | no (defaults `openai/gpt-4o-mini`) | LiteLLM id |
| `OPENAI_API_KEY` | matches model | Provider key |
| `SUPABASE_URL` | yes | Same Supabase project as web app |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Bypasses RLS |

### `guided-growth-mvp/` (Vercel project)

| Var | Visibility | Purpose |
|---|---|---|
| `CARTESIA_API_KEY` | server-only | Mints access tokens; used by Sonic/Ink REST too |
| `VITE_CARTESIA_AGENT_ID` | client (Vite-inlined) | The deployed Line agent's ID |

`VITE_CARTESIA_API_KEY` is also present in `.env.local` for an older direct-from-browser path. Not used by the realtime agent flow.

## Cartesia version

- API version: `2026-03-01`
- Pinned in `src/lib/services/cartesia-agent.ts:22`, `api/cartesia-agent-token.ts`, `scripts/cartesia-agent-smoke.mjs`
- Bump all three together when Cartesia ships a breaking version.

## Smoke test

```bash
nvm use 22 && npm run smoke:agent
```

Wraps `node scripts/cartesia-agent-smoke.mjs`. Mints a token, opens the WS, sends `start`, waits for `ack`. Validates the transport stack but NOT audio, STT, LLM, or tool execution. For those, `npm run dev` and walk through onboarding in a browser.

## Common failure modes

| Symptom | Likely cause |
|---|---|
| `ws closed before ack code=4001/4003` | Bad/expired access token, or wrong agent ID |
| `ws closed code=1006` | Network drop, bad URL, or `cartesia_version` mismatch |
| Smoke test times out at 15s | Agent deployed but hung — check Cartesia dashboard logs |
| Agent never speaks after user finishes | VAD didn't fire `UserTurnEnded`. Confirm `_run_filter` still includes `UserTextSent`. |
| Form doesn't auto-fill from voice | Realtime channel down. Check `useOnboardingRealtimeSync`; verify Supabase Realtime is enabled on `onboarding_states`. |
| Tool call writes succeed but `current_step` doesn't bump | LLM didn't call `navigate_next`. Check the screen's `screen_contexts.json` entry tells it when to advance. |
| Mic permission API returns `prompt` on Android even after grant | Known Capacitor 8 / Pixel issue. `useOnboardingAgent` already bypasses the check on `Capacitor.isNativePlatform()`. |

## Per-screen sessions (MVP tradeoff)

Each onboarding step mounts a fresh WebSocket because `metadata.screen` is read inside `get_agent()` and baked into the system prompt at construction time. Cost: ~1–2s of silence on transitions. A persistent provider that keeps one session alive and pushes screen updates via the `custom` event would fix it; not needed for MVP.

The same tradeoff carries into Vapi if the assistant prompt is screen-specific. Resolve when migrating.

## Local iteration (legacy)

```bash
cd ../gcartesia-agents
cartesia chat 8000        # local dev — chat in terminal
cartesia deploy           # push to Cartesia
```

Both need `OPENAI_API_KEY` (or whichever provider matches `LLM_MODEL`), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

## What goes away when Vapi lands

- `gcartesia-agents/` repo — unhost, archive, or repurpose as a `tools/` reference for the Vapi webhook authors.
- `api/cartesia-agent-token.ts` — replaced by Vapi call provisioner.
- `src/lib/services/cartesia-agent.ts` — replaced by `@vapi-ai/web` SDK calls.
- `scripts/cartesia-agent-smoke.mjs` + `npm run smoke:agent` — replaced by a Vapi smoke command.
- `cartesia.toml`, `cartesia deploy` workflow — gone.

## What survives

- `useOnboardingAgent` hook signature (rewritten internals).
- `useOnboardingRealtimeSync` (unchanged).
- Supabase tables: `onboarding_states`, `screen_contexts`, `session_log`.
- All 8 tool write semantics (relocated server-side as Vapi tool webhook handlers).
- The CRISIS_BOUNDARY rule and prompt block ordering.
- Cartesia voice (Vapi uses Cartesia Sonic-3 as TTS provider).
