# Three Paths — Diagram, Decision Matrix, Per-Surface Mapping

## The diagram

```
PATH 1 — Vapi (Onboarding)
─────────────────────────────────────────────────────────────────────────
User → Frontend → ┌──── Vapi (full voice orchestration) ─────┐ → Frontend → User
                  │  STT (Deepgram Flux, streaming)          │
                  │  LLM (BYO key — wired via callLLM ctx)   │
                  │  TTS (Cartesia Sonic-3, cloned voice)    │
                  └──────────────────────────────────────────┘
Side effects: Vapi tool webhook → Supabase write → Realtime → frontend (auto-fill / navigate_next)

PATH 2 — Async Reflection (Daily Check-ins)
─────────────────────────────────────────────────────────────────────────
User → Frontend → MP3 prompt (plays to user)
                → user speaks reply
                → Cartesia Ink (STT)
                → callLLM()
                → LLM
                → Sonic API (TTS)
                → User
Side effects: ActionDispatcher logic invoked from callLLM result → Supabase writes → UI updates

PATH 3 — Direct LLM (Text Chat)
─────────────────────────────────────────────────────────────────────────
User → Frontend → callLLM() → LLM → Frontend renders text → User
Side effects: tap actions write session_log; CRUD via ActionDispatcher when intent maps to one
```

## Decision matrix — which path for a new surface?

Ask in order. First "yes" picks.

```
1. Is the user being onboarded (or in an onboarding-like coached chat overlay)?
   YES → Path 1 (Vapi).
   NO  → continue.

2. Does the surface need bidirectional voice in real time
   (the user speaks, the AI talks back, both can interrupt)?
   YES → Path 1 (Vapi).
   NO  → continue.

3. Is voice involved at all (mic input or TTS output)?
   YES → Path 2 (Async).  Compose MP3 / Ink STT / callLLM / Sonic TTS as needed.
   NO  → Path 3 (Direct LLM).
```

Path 1 only opens for the conversational onboarding journey. Everything else conversational and voice-flavored is Path 2. Everything text-only is Path 3.

## Per-surface mapping (target state)

| Surface | Path | Notes |
|---|---|---|
| SPLASH-01 (welcome hook) | Path 2 | MP3 (when present) or Sonic REST one-shot. Today: live Sonic REST per client override. |
| PREF-01 (voice preference ask) | Path 2 | Pre-recorded MP3 (when generated) or Sonic REST. |
| MIC-01 (mic permission) | Path 2 | Pre-recorded MP3 (when generated) or Sonic REST. |
| POST-AUTH-01 (welcome intro) | Path 2 | Pre-recorded MP3 (when generated) or Sonic REST. |
| ONBOARD-01..09 (beginner) | Path 1 | Vapi assistant per session, screen passed in metadata. |
| Advanced onboarding screens | Path 1 | Same Vapi assistant, advanced-path screens. |
| Onboarding chat overlay | Path 1 | Mid-onboarding coached chat (typed or voice). |
| Plan review (ONBOARD-07) | Path 1 | Vapi assistant. |
| Morning check-in | Path 2 | MP3 prompt → Ink → callLLM → Sonic. Replaces today's Line session. |
| Evening check-in | Path 2 | Same as morning. |
| Home voice check-in (single utterance) | Path 2 | Today the live single-utterance pipeline; folds into the same Path-2 composition. |
| Journal voice input | Path 2 | Ink STT only (transcript-only mode). No LLM unless user asks for analysis. |
| Feedback voice note | Path 2 | Ink STT only. |
| Affirmation playback | Path 2 | Sonic REST one-shot. |
| Text chat surfaces | Path 3 | callLLM only. |
| Tap-driven actions (add habit, log goal, etc.) | Path 3 | Write session_log; LLM reads delta on next call. See [shared.md](shared.md). |

> **Pre-recorded MP3 status (May 2026)**: not all of SPLASH/PREF/MIC/POST-AUTH have generated MP3 assets yet. Until they do, those screens fall through to live Sonic REST under Path 2. The flow is the same; only the "MP3 prompt" box collapses to a no-op.

## Path comparison

| | Path 1 — Vapi | Path 2 — Async | Path 3 — Direct LLM |
|---|---|---|---|
| **Triggered by** | Onboarding screen mount, chat overlay open | User opens check-in / journal / feedback / single-utterance command | User submits text in chat / tap action |
| **Transport** | Vapi Web SDK (WebRTC) | HTTPS POST to Ink + Sonic + LLM endpoints | HTTPS POST to LLM endpoint |
| **Conversation** | Multi-turn, interruption-aware | Single turn (one prompt → one reply) | Single turn |
| **STT** | Deepgram Flux (inside Vapi) | Cartesia Ink REST | n/a |
| **LLM call** | Inside Vapi, BYO key, ctx via callLLM | callLLM (direct) | callLLM (direct) |
| **TTS** | Cartesia Sonic-3 (inside Vapi) | Cartesia Sonic REST | n/a |
| **Cost driver** | Vapi session-minutes | Per-character TTS + per-second STT + LLM tokens | LLM tokens only |
| **Side effects** | Vapi tool webhook → Supabase → Realtime → UI | callLLM result → ActionDispatcher → DataService → UI | session_log write; optional ActionDispatcher |
| **Latency to first audio** | ~500ms after Vapi connect | ~50ms (cached MP3) or ~250–400ms (Sonic REST) | n/a (text) |

## Why the split is shaped this way

- **Path 1 only for live conversation** — Vapi billed per session-minute. Opening it speculatively burns minutes for silence. Restrict to surfaces that genuinely need bidirectional realtime.
- **Path 2 for asynchronous voice** — Sonic and Ink billed per usage. Cheaper per interaction. No persistent connection, so cost scales with what the user actually does.
- **Path 3 for everything else** — text chat and tap-driven flows don't need voice machinery. Going through callLLM keeps context (`screen_contexts`) and state delta (`session_log`) consistent across paths.

## Anti-patterns to refuse

| Pattern | Why it's wrong |
|---|---|
| Opening Vapi for a one-way broadcast | Burns session-minutes for non-conversational work. Use Path 2 (Sonic REST). |
| Calling OpenAI / Anthropic directly from a hook | Bypasses callLLM — LLM goes blind to screen_contexts + session_log. |
| Building a fourth path | The doc forbids it. Extend callLLM or add another tool webhook on Path 1 / 2. |
| Routing tap actions through Vapi or Sonic | Tap-driven CRUD writes to session_log and may invoke ActionDispatcher. No voice machinery. |
| Leaving a Vapi session open across screens "to save handshake" | Vapi billed for the whole open window. Close on unmount. |
