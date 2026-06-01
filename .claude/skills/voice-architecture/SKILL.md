---
name: voice-architecture
description: Umbrella reference for how voice + chat work in the Guided Growth app. Three cost-tier paths keyed to the UX-26 dual-button orb — Path 1 Vapi (both halves on, State 1, full-duplex), Path 2 async voice (exactly one voice half on, States 2/3 — Soniox STT in or Cartesia Sonic out), Path 3 Direct LLM text only (both halves off, State 4). STT is Soniox; TTS is Cartesia Sonic 3.5. Read this when asking "which path do I use?", reasoning about callLLM / screen_contexts / session_log, choosing between Vapi and Cartesia, or comparing the paths. Per-path implementation details live in path-1-vapi / path-2-async / path-3-direct-llm.
user-invocable: false
---

# Voice & Chat — Three-Path Architecture

The three paths are **cost tiers** keyed to the UX-26 dual-button orb, not screen groups. The orb has two independent halves — AI-output (Cartesia TTS) and mic (Soniox STT). The live button-state picks the path; a surface has a default, but the moment a user flips a half, the path changes under it.

```
PATH 1 — Vapi (State 1: both halves on)      full STT + LLM + TTS bundled in Vapi assistant
  User ⇄ Frontend ⇄ Vapi ⇄ User              realtime, bidirectional, tool webhooks for side effects
  STT Soniox · LLM OpenAI inside Vapi (no BYO/callLLM; context via variableValues) · TTS Cartesia Sonic 3.5

PATH 2 — async voice (State 2 or 3: one voice half on)   single voice half, asynchronous turns
  State 2 (AI on, mic off):  User → callLLM → LLM → Cartesia Sonic 3.5 (or MP3) → User
  State 3 (AI off, mic on):  User speaks → Soniox STT → callLLM → LLM → text → User
  Check-ins are ONE pattern here (State 2 prompt then State 3 reply), not the whole tier.

PATH 3 — Direct LLM (State 4: both halves off)   text in, text out, no voice
  User → Frontend → callLLM → LLM → Frontend renders text → User
```

**Boundary rule:** any voice present is at least Path 2; dropping one Vapi half falls to Path 2, never straight to Path 3. Only both halves off reaches Path 3.

**Cost tier vs. implementation.** The path-* skill folders are named by *implementation* and predate this cost-tier reframe: `path-1-vapi` = the Vapi loop (tier Path 1); `path-2-async` = the check-in async-reflection pipeline (one tier-Path-2 implementation); `path-3-direct-llm` = the Direct-LLM implementation (`useLLM` → `/api/llm`, with optional direct Soniox STT / Cartesia TTS) that backs orb States 2, 3, and 4 — i.e. tier Path 2 (States 2/3) *and* tier Path 3 (State 4). So one implementation spans two cost tiers; the folder name is historical.

## Reference files

- [paths.md](paths.md) — full diagram, decision matrix, per-surface mapping
- [shared.md](shared.md) — `callLLM()`, `screen_contexts`, `session_log`, side-effect pattern (tool → DB → Realtime → UI)
- [glossary.md](glossary.md) — Soniox (STT) vs Cartesia (Sonic 3.5 TTS, legacy Line) vs Vapi — what each thing actually is

## When this skill is the right one to read

- "Which path does [screen X] use?" → [paths.md](paths.md)
- "What is callLLM?" / "Where does screen_contexts get used?" → [shared.md](shared.md)
- "Soniox vs Sonic vs Line?" / "Vapi vs Cartesia?" → [glossary.md](glossary.md)
- "Why are some flows tap-driven and others voice?" → [shared.md](shared.md) ("caught up" principle)

## When to skip this and read a path skill

| Working on | Skill |
|---|---|
| Vapi assistant config, onboarding voice, gcartesia-agents repo, useOnboardingAgent, useRealtimeVoice | [path-1-vapi](../path-1-vapi/SKILL.md) |
| Morning/evening check-in voice, MP3 + Sonic composition, Cartesia REST endpoints, useVoiceCommand/Chat/Input, ActionDispatcher | [path-2-async](../path-2-async/SKILL.md) |
| The Direct-LLM implementation behind the non-Vapi orb states (States 2/3/4 — tier Path 2 + Path 3), useLLM consumers, /api/llm, tap-driven LLM use | [path-3-direct-llm](../path-3-direct-llm/SKILL.md) |

## Migration posture

The repo is mid-migration. Vapi (`@vapi-ai/web`) and Soniox STT (`soniox-stream.ts`, `/api/stt`) are live; the dual-button orb-state model (`src/lib/orb/orbState.ts`) is implemented. The legacy Cartesia Line agent (`gcartesia-agents/`) is retiring. Target is the diagram above: Vapi for Path 1, callLLM-orchestrated MP3 + Cartesia Sonic 3.5 for Path 2 (one voice half), callLLM-only for Path 3 (text, State 4).

**Each path skill leads with its target state.** Current code is documented as legacy (`current-cartesia-*.md` files inside each path) — preserve while reading existing code, do not extend.

## Source of truth

Product-side reference: `~/Documents/Upwork/YA/Voice_System_Implementation_Guide.md` (v6.0, April 2026). The diagram in this skill is the engineering view of that doc.
