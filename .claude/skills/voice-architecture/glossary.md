# Vocabulary — Vapi, Cartesia, and the Pieces

The naming gets confusing fast. This file is a quick translation table.

## Vapi

**Vapi (vapi.ai)** is a voice-agent orchestration platform. You configure an "assistant" (a JSON spec with system prompt, tools, model, voice, transcriber) and Vapi runs the realtime loop:

- Mic audio in (WebRTC from the browser)
- STT (**Soniox**, multilingual, sub-200ms streaming)
- LLM call (the model lives in the assistant config; Vapi runs the turn). **This app uses OpenAI set in the Vapi dashboard — NOT a BYO custom-LLM key, NOT a `callLLM` proxy.**
- TTS (configurable — for this app, **Cartesia Sonic 3.5** with the cloned voice)
- Audio out (WebRTC back to the browser)
- Tool calling (server-side webhooks you host; Vapi POSTs to them when the LLM emits a tool call)
- Turn-taking, interruption handling, end-of-call detection

**Context injection on Path 1 (NOT callLLM):** the app feeds screen context + `session_log` delta + form snapshot into the Vapi assistant via `assistantOverrides.variableValues` (`initial_screen_context`, `anon_id`, `screen`, `coaching_style`) at session start, and via `client.send({ type: 'add-message', role: 'system' })` mid-session on screen change. The dashboard prompt holds the `{{initial_screen_context}}` placeholder. See `src/lib/voice/buildAssistantOverrides.ts` and `OnboardingVoiceProvider.pushScreenContext`. `callLLM` is for Paths 2/3 only.

### Vapi pieces in this app

- **Vapi Web SDK** — `@vapi-ai/web`. Browser-side client that opens the WebRTC session and surfaces lifecycle events.
- **Vapi assistant** — server-side config (created via Vapi REST or dashboard). One assistant per surface, or one assistant with screen passed in metadata.
- **Vapi tool webhook** — Vercel function (e.g. `/api/vapi-tool`) that Vapi calls when the assistant emits a tool. Writes to Supabase, kicking off the side-effect chain.

## Soniox — speech-to-text

**Soniox** is the STT primitive (not a Cartesia product). User talks → Soniox turns audio into written words. Multilingual auto-detect (English / Spanish / Hebrew code-switching), streaming, sub-200ms. **Sole STT** across all paths — no Gladia/Deepgram fallback.

- **Realtime** (mic half live): `soniox-stream.ts` opens a WebSocket (`wss://stt-rt.soniox.com/transcribe-websocket`, model `stt-rt-v4`); ephemeral keys minted by `/api/soniox-temp-key.ts`.
- **Batch / async** (file upload): `/api/stt.ts` wraps `https://api.soniox.com/v1` (model `stt-async-v4`).

Soniox sits inside **Path 1** (as Vapi's transcriber) and in **Path 2 State 3** (mic-half-only voice input). It replaces the retired Cartesia Ink and the evaluation-era Deepgram Flux.

## Cartesia

**Cartesia (cartesia.ai)** supplies the TTS in the new architecture (Sonic). Its STT (Ink) and voice-agent SDK (Line) are both retired — Soniox took over STT, Vapi took over orchestration.

### Sonic — text-to-speech

You give Sonic words → it speaks them in a chosen voice. Streaming, low-latency.

`Sonic 3.5` is the current model version (voice "Yair Amsel 4 (enhanced)"). Same product as Sonic, newer model. Note: `<break>` and `<spell>` SSML only; speed/volume/emotion are temporarily disabled on 3.5.

In the new architecture, Sonic shows up in **Path 2** (TTS leg / one-way State 2) and inside **Path 1** (as Vapi's TTS provider — Vapi calls Sonic on your behalf). The voice (cloned ID) is the same in both cases, so audio quality is consistent across paths.

Endpoint: `POST https://api.cartesia.ai/tts/bytes` (currently wrapped by `/api/cartesia-tts.ts`; code sends `model_id: 'sonic-3'` today, target `sonic-3.5`).

### Ink — speech-to-text *(retired)*

Cartesia's STT engine, used early in the build for transcribing voice replies. **Replaced by Soniox.** Don't add new Ink consumers; `/api/stt.ts` now wraps Soniox, not Ink.

### Line — voice-agent SDK *(retiring)*

Cartesia's own voice-agent framework. WebSocket transport + STT + LLM call + TTS + turn-taking + tool execution. Python-only, deployed via `cartesia deploy`.

In this app, Line ran the onboarding agent (sibling `gcartesia-agents/` repo). **Vapi replaces Line.** Don't extend the Line integration; don't add new Line consumers.

### Sonic 3.5

Current version of the Sonic TTS model. Not a separate product — just a model id string. The code's literal `model_id` is `sonic-3` today; the locked target is `sonic-3.5`. Verify the exact id against Cartesia docs before pinning.

## Cartesia version header

All Cartesia REST calls take a `Cartesia-Version: 2026-03-01` header (or `cartesia_version=…` query param for WebSocket). Pinned in:
- `src/lib/services/cartesia-agent.ts`
- `api/cartesia-agent-token.ts`
- `scripts/cartesia-agent-smoke.mjs`

Bump all three together when Cartesia ships a breaking version. (Once Line/Path-1-legacy retires, only the Sonic and Ink REST callers matter.)

## "Cartesia" in conversation

People say "Cartesia" to mean any of these. Always disambiguate:

| When someone says | They might mean |
|---|---|
| "use Cartesia" | usually "use one of Cartesia's products" — pick the right transport per path |
| "the Cartesia agent" | almost always Line (legacy onboarding agent) — verify before assuming |
| "Cartesia voice" | the cloned voice ID (a `voice_id` parameter); same across Sonic REST and Vapi-via-Sonic |
| "Sonic API" | `POST /tts/bytes` |
| "the STT endpoint" | `/api/stt` (wraps Soniox; the old "Ink API" is retired) |

## LLM providers

Whatever model you pass into callLLM (and into the Vapi assistant config). LiteLLM-style ids:

- `openai/gpt-4o-mini` + `OPENAI_API_KEY`
- `anthropic/claude-haiku-4-5-20251001` + `ANTHROPIC_API_KEY`
- `gemini/gemini-2.0-flash` + `GEMINI_API_KEY`

Swap providers without touching voice infra (Vapi or Cartesia). Two bills, two failure modes — that's the point.

## Quick disambiguation

| Wrong assumption | Correction |
|---|---|
| "Vapi includes the LLM." | The model runs inside Vapi via the assistant config (this app: OpenAI in the Vapi dashboard). It is NOT a BYO custom-LLM key and NOT routed through `callLLM`. |
| "Path 1 has no context — it's all internal." | Wrong. Context IS injected, just not via `callLLM` — via `assistantOverrides.variableValues` + `add-message`. |
| "Cartesia includes the LLM." | No. Same story. Cartesia gives you ears + mouth + (legacy) plumbing. |
| "If we use Vapi, we drop Cartesia." | No. Vapi uses Cartesia Sonic for TTS. The voice survives. |
| "Sonic 3.5 is a different product from Sonic." | No. Same product, newer model. |
| "Cartesia does the STT." | No. STT is Soniox. Cartesia is TTS only now (Ink retired). |
| "Line and Vapi do the same thing." | Functionally yes, but Line is retiring in this app. Vapi takes over. |
| "/api/stt belongs to the onboarding agent." | No. It's a Path-2 REST endpoint. The legacy Line agent did its own STT internally. |
