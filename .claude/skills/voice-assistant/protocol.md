# Wire Protocol, Env Vars, Verification

## Wire Protocol — `wss://api.cartesia.ai/agents/stream/{agentId}`

Auth: `?access_token=<token>&cartesia_version=2026-03-01` (query string — browser WebSocket can't set headers).

### Client → Server

| Event | Body | When |
|-------|------|------|
| `start` | `{config:{input_format,output_format}, metadata:{user_id,screen,coaching_style}}` | Once, immediately on `onopen` |
| `media_input` | `{media:{payload:<base64 PCM>}}` | Continuous while mic captures |
| `dtmf` | `{digit:"0".."9"|"*"|"#"}` | Telephony only — not used in browser |
| `custom` | `{data:<any>}` | App-defined side channel (currently unused) |

### Server → Client

| Event | Body | Meaning |
|-------|------|---------|
| `ack` | `{stream_id, config}` | Session live. State → `open`. |
| `media_output` | `{media:{payload:<base64 PCM>}}` | TTS frame. Decode → schedule on AudioContext. |
| `clear` | `{}` | Drop any queued playback (user interrupted). |
| `transfer_call` | telephony-only | Ignored — coaching sessions don't transfer. |

### Audio Formats

| ID | Sample rate | Encoding | Used as |
|----|-------------|----------|---------|
| `pcm_16000` | 16 kHz | 16-bit LE mono | input (mic) |
| `pcm_24000` | 24 kHz | 16-bit LE mono | optional output |
| `pcm_44100` | 44.1 kHz | 16-bit LE mono | output (TTS — matches default device rate) |
| `mulaw_8000` | 8 kHz | μ-law | telephony |

Browser captures at the device rate, then `useRealtimeVoice` downsamples to 16 kHz before sending. Output is decoded straight into `AudioBuffer` at 44.1 kHz and scheduled with a moving cursor for gapless playback.

## Env Vars

### `gcartesia-agents/` (set in Cartesia deployment)

| Var | Required | Purpose |
|-----|----------|---------|
| `LLM_MODEL` | no | LiteLLM id, e.g. `openai/gpt-4o-mini`, `anthropic/claude-haiku-4-5-20251001`. Defaults `openai/gpt-4o-mini`. |
| `OPENAI_API_KEY` | matches model | Provider key for `LlmAgent(api_key=…)`. Use `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` instead if you switch model. |
| `SUPABASE_URL` | yes | Supabase project URL — same as web app. |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Service role JWT. Bypasses RLS. |

### `guided-growth-mvp/` (Vercel project)

| Var | Visibility | Purpose | Used in |
|-----|------------|---------|---------|
| `CARTESIA_API_KEY` | server-only | Mints access tokens | `api/cartesia-agent-token.ts` |
| `VITE_CARTESIA_AGENT_ID` | client (Vite-inlined) | The deployed agent's ID | `useRealtimeVoice.ts:304` |

`VITE_CARTESIA_API_KEY` is also present in `.env.local` for legacy reasons (an older direct-from-browser path) but is NOT used by the realtime agent flow — server-minted tokens replaced it.

Current values are in `.env.local`. Production Vercel env still needs the same two `CARTESIA_*` keys set on the project (`vercel env add`).

## Smoke Test

```bash
npm run smoke:agent
```

Wraps `node scripts/cartesia-agent-smoke.mjs`. **Requires Node 22+** for the global `WebSocket` and `fetch`. If the shell default is Node 20:

```bash
nvm use 22 && npm run smoke:agent
```

The script:
1. Mints an access token using `CARTESIA_API_KEY` from `.env.local`.
2. Opens the agent WebSocket with query-param auth.
3. Sends a `start` event with stub metadata (`user_id: "smoke-test-user"`, `screen: "onboard_01"`, `coaching_style: "warm"`).
4. Waits up to 15s for an `ack`. Logs `stream_id` on success.
5. Falls back to `agents.cartesia.ai` host if `api.cartesia.ai` rejects.
6. Exits 0 on ack, non-zero with diagnostics otherwise.

This validates the full transport stack (token mint + WS handshake + start frame) but NOT audio, STT, LLM, or tool execution. For those, run `npm run dev` and walk through onboarding in a browser.

## Common Failure Modes

| Symptom | Likely cause |
|---------|--------------|
| `ws closed before ack code=4001/4003` | Bad / expired access token, or wrong agent ID |
| `ws closed code=1006` | Network drop, bad URL, or `cartesia_version` mismatch |
| Smoke test times out at 15s | Agent is deployed but hung — check Cartesia dashboard logs |
| Agent never speaks after user finishes | VAD didn't fire `UserTurnEnded`. Confirm `_run_filter` still includes `UserTextSent`. |
| Form doesn't auto-fill from voice | Realtime channel down. Check `useOnboardingRealtimeSync` status; verify Supabase Realtime is enabled on `onboarding_states`. |
| Tool call writes succeed but `current_step` doesn't bump | LLM didn't call `navigate_next`. Check the screen's `screen_contexts.json` entry tells it when to advance. |
| `Mic permission API returns 'prompt' on Android even after grant` | Known Capacitor 8 / Pixel issue. `useOnboardingAgent` already bypasses the check on `Capacitor.isNativePlatform()`. |

## Cartesia Version Header

Every API call uses `Cartesia-Version: 2026-03-01`:
- Token mint: `Cartesia-Version` header on the POST.
- WebSocket: `cartesia_version` query param.

If Cartesia ships a breaking version, bump both `CARTESIA_VERSION` constants — one in `cartesia-agent.ts` and one in `cartesia-agent-token.ts` and the smoke script.

## What Cartesia Does NOT Forward Over the WS

Confirmed empirically and via Cartesia's official `agent-ws-example` repo (referenced in code comments):

- Tool call requests
- Tool call results
- LLM tokens
- User transcripts
- Agent transcripts (text form of TTS)

If the UI needs any of those, route through Supabase (writes by tools → Realtime → browser) or build a custom event over the `custom` channel and read it in the agent. The current MVP only needs tool *side effects*, which Supabase Realtime delivers.
