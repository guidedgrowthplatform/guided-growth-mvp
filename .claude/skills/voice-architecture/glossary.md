# Vocabulary — Vapi, Cartesia, and the Pieces

The naming gets confusing fast. This file is a quick translation table.

## Vapi

**Vapi (vapi.ai)** is a voice-agent orchestration platform. You configure an "assistant" (a JSON spec with system prompt, tools, model, voice, transcriber) and Vapi runs the realtime loop:

- Mic audio in (WebRTC from the browser)
- STT (default: **Deepgram Flux**, streaming)
- LLM call (BYO provider key — you pass model + key in the assistant config; Vapi sends each turn through your provider)
- TTS (configurable — for this app, **Cartesia Sonic-3** with the cloned voice)
- Audio out (WebRTC back to the browser)
- Tool calling (server-side webhooks you host; Vapi POSTs to them when the LLM emits a tool call)
- Turn-taking, interruption handling, end-of-call detection

This app's Vapi assistants will route their LLM calls via `callLLM()` so context + state delta still get prepended.

### Vapi pieces in this app

- **Vapi Web SDK** — `@vapi-ai/web`. Browser-side client that opens the WebRTC session and surfaces lifecycle events.
- **Vapi assistant** — server-side config (created via Vapi REST or dashboard). One assistant per surface, or one assistant with screen passed in metadata.
- **Vapi tool webhook** — Vercel function (e.g. `/api/vapi-tool`) that Vapi calls when the assistant emits a tool. Writes to Supabase, kicking off the side-effect chain.

## Cartesia

**Cartesia (cartesia.ai)** is a voice AI company that ships four products. Two of them stay in the new architecture (Ink and Sonic); two leave (Line is replaced by Vapi; the legacy Cartesia BYO-LLM is replaced by callLLM-managed providers).

### Ink — speech-to-text

User talks → Ink turns audio into written words. Streaming, low-latency.

In the new architecture, Ink shows up in **Path 2** (the async reflection composition) for transcribing the user's spoken reply after the MP3 prompt plays. Endpoint: `POST https://api.cartesia.ai/stt/...` (currently wrapped by `/api/cartesia-stt.ts`).

### Sonic — text-to-speech

You give Sonic words → it speaks them in a chosen voice. Streaming, low-latency.

`Sonic-3` is the latest model version. Same product as Sonic, newer model.

In the new architecture, Sonic shows up in **Path 2** (TTS leg of the async loop) and inside **Path 1** (as Vapi's TTS provider — Vapi calls Sonic on your behalf). The voice (cloned ID) is the same in both cases, so audio quality is consistent across paths.

Endpoint: `POST https://api.cartesia.ai/tts/bytes` (currently wrapped by `/api/cartesia-tts.ts`).

### Line — voice-agent SDK *(retiring)*

Cartesia's own voice-agent framework. WebSocket transport + STT + LLM call + TTS + turn-taking + tool execution. Python-only, deployed via `cartesia deploy`.

In this app, Line ran the onboarding agent (sibling `gcartesia-agents/` repo). **Vapi replaces Line.** Don't extend the Line integration; don't add new Line consumers.

### Sonic-3

Latest version of the Sonic TTS model. Not a separate product — just a model id string. Verify the exact id against Cartesia docs before pinning.

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
| "Ink API" | `POST /stt/...` (today wrapped by `/api/cartesia-stt`) |

## LLM providers

Whatever model you pass into callLLM (and into the Vapi assistant config). LiteLLM-style ids:

- `openai/gpt-4o-mini` + `OPENAI_API_KEY`
- `anthropic/claude-haiku-4-5-20251001` + `ANTHROPIC_API_KEY`
- `gemini/gemini-2.0-flash` + `GEMINI_API_KEY`

Swap providers without touching voice infra (Vapi or Cartesia). Two bills, two failure modes — that's the point.

## Quick disambiguation

| Wrong assumption | Correction |
|---|---|
| "Vapi includes the LLM." | No. Vapi BYO LLM — you configure the model + key in the assistant. |
| "Cartesia includes the LLM." | No. Same story. Cartesia gives you ears + mouth + (legacy) plumbing. |
| "If we use Vapi, we drop Cartesia." | No. Vapi uses Cartesia Sonic for TTS. The voice survives. |
| "Sonic-3 is a different product from Sonic." | No. Same product, newer model. |
| "Line and Vapi do the same thing." | Functionally yes, but Line is retiring in this app. Vapi takes over. |
| "/api/cartesia-stt belongs to the onboarding agent." | No. It's a Path-2 REST endpoint. The legacy Line agent did its own STT internally. |
