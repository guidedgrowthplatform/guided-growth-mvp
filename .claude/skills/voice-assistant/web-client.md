# Web Client — Browser-Side Cartesia Integration

The browser half lives in this repo. Three layers: **token endpoint** (server) → **transport client** (plain TS) → **React hooks** (state machine, mic, playback).

## File Map

| File | Layer | Purpose |
|------|-------|---------|
| `api/cartesia-agent-token.ts` | Vercel function | Mints 1h access token using server-only `CARTESIA_API_KEY` |
| `src/lib/services/cartesia-agent.ts` | Plain TS class | `CartesiaAgentClient` — WebSocket transport, frame parse/build |
| `src/hooks/useRealtimeVoice.ts` | React hook | Mic capture, audio playback scheduling, state machine, PostHog telemetry |
| `src/hooks/useOnboardingAgent.ts` | React hook | Per-screen wrapper: auto-start on mic-granted, plus realtime sync |
| `src/hooks/useOnboardingRealtimeSync.ts` | React hook | Subscribes to Supabase `onboarding_states` row → React Query cache |
| `src/data/screen-contexts.json` | Static data | Frontend-side mirror of the Voice Journey sheet (display copy / instructions) |

## Token Endpoint — `api/cartesia-agent-token.ts`

- POST only. Two rate-limit tiers: per-IP (20/min) and per-user (10/min).
- Calls `requireUser()` unless `AUTH_BYPASS_MODE=true && NODE_ENV !== production` (dev convenience).
- POSTs Cartesia `https://api.cartesia.ai/access-token` with `Cartesia-Version: 2026-03-01`, body `{ expires_in: 3600, grants: { agent: true } }`.
- Returns `{ token, expires_in }` to the browser. On upstream 401/429 it forwards the status; otherwise 502/504/500. Always includes `fallback: true` so the UI can degrade.
- 10s `AbortSignal.timeout` on the upstream fetch.

## Transport Client — `cartesia-agent.ts`

`CartesiaAgentClient` is intentionally framework-free so the smoke test, the React hook, and any future native client can share it.

States: `idle → connecting → open → closing → closed`.

```ts
const client = new CartesiaAgentClient({
  agentId,            // VITE_CARTESIA_AGENT_ID
  accessToken,        // from /api/cartesia-agent-token
  metadata: { user_id, screen, coaching_style },
  inputFormat:  'pcm_16000',
  outputFormat: 'pcm_44100',
  onReady, onAudio, onClear, onError, onClose,
});
client.connect();
client.sendAudio(pcm);    // Uint8Array of 16-bit LE PCM
client.sendCustom({...}); // app-defined event
client.close();
```

URL shape (browsers can't set headers on WebSocket — token goes in query):
```
wss://api.cartesia.ai/agents/stream/{agentId}?access_token=…&cartesia_version=2026-03-01
```

Defense-in-depth: incoming `media_output` payloads are capped at ~1 MB decoded (1.4 MB base64). Anything larger fires `onError` and is dropped.

`transfer_call` and unknown events are ignored — coaching sessions don't use them. Dev builds log them.

## React Hook — `useRealtimeVoice.ts`

Public state: `'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'error'`.

Responsibilities:
- Token mint via `/api/cartesia-agent-token`.
- `getUserMedia({audio: {channelCount:1, sampleRate:16000, echoCancel/noise/AGC: on}})`.
- AudioContext + ScriptProcessor (4096 buf) → downsample → `float32ToPcm16LE` → `client.sendAudio`.
- Playback: scheduled `AudioBufferSourceNode` chain with a moving `playbackCursor` so frames concatenate seamlessly at 44.1kHz.
- PostHog `start_voice_session` / `cancel_voice_session` / `complete_voice_session` events with `context` derived from `metadata.screen` (`onboard_*` → `'onboarding'`, `morning|evening` → `'checkin'`, etc.).
- Re-entry guards: `tearingDownRef` blocks restart while the previous session's onClose is still firing; mic-grant after abort tears the just-granted stream down.

Don't call `start()` twice. Don't gate it on `permission==='granted'` for Capacitor native — Android returns `'prompt'` even after a successful OS grant. `useOnboardingAgent` already handles this distinction.

## Per-Screen Hook — `useOnboardingAgent.ts`

Used by every onboarding step page. One line:

```tsx
useOnboardingAgent('onboard_03');
```

Internally:
1. Calls `useOnboardingRealtimeSync()` so tool writes hydrate the form.
2. Calls `useRealtimeVoice({ metadata: { user_id, screen, coaching_style: 'warm' } })`.
3. On mount, queries `navigator.permissions.query({name:'microphone'})` and auto-`start()` if `granted` (web) — or unconditionally on Capacitor native.
4. On unmount or screen change, `stop()`.

Each step page passes its own screen ID (`onboard_01`, `onboard_02`, …). The list of consumers:
```
src/pages/onboarding/shared/Step1Page.tsx          → 'onboard_01'
src/pages/onboarding/shared/Step2Page.tsx          → 'onboard_02'
src/pages/onboarding/beginner/Step3..6Page.tsx     → 'onboard_03'..'06'
src/pages/onboarding/shared/PlanReviewPage.tsx     → 'onboard_07'
src/pages/onboarding/advanced/Advanced*Page.tsx    → advanced-path screens
```

## Realtime Sync — `useOnboardingRealtimeSync.ts`

Subscribes once to `supabase.channel('onboarding-states:{userId}')` filtered to `table=onboarding_states`. On row update, invalidates React Query so the form re-reads `data` and `current_step`. This is the bridge between agent tool writes and the UI — without it the form wouldn't auto-fill from voice.

## Two `screen-contexts.json` Files (NOT the same)

- `gcartesia-agents/screen_contexts.json` — fed to the LLM via system prompt. AI Context, Edge Cases, etc.
- `src/data/screen-contexts.json` — frontend display copy / Figma text / button labels.

Both come from the same source xlsx but serve different consumers. Update both if the sheet changes.

## Adding a New Screen to the Voice Flow

1. Add a row to `src/data/screen-contexts.json` and `gcartesia-agents/screen_contexts.json`.
2. Add an entry to `intros` in `gcartesia-agents/main.py`.
3. Redeploy the agent (`cartesia deploy`).
4. In the page component, `useOnboardingAgent('your_screen_id')`.
5. If new fields need to be saved, either reuse `update_onboarding_data` (string field) or add a typed tool in `tools.py`.
