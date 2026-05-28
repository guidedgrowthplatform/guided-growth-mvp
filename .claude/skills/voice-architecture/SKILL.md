---
name: voice-architecture
description: Umbrella reference for how voice + chat work in the Guided Growth app. Three call paths — Path 1 Vapi (full-duplex voice, orb State 1), Path 2 Async Reflection (daily check-ins via MP3 + Cartesia Ink + callLLM + Sonic), and Path 3 Direct LLM (the three non-Vapi orb states — UX-26 States 2/3/4). Read this when asking "which path do I use?", reasoning about callLLM / screen_contexts / session_log, choosing between Vapi and Cartesia, or comparing the paths. Per-path implementation details live in path-1-vapi / path-2-async / path-3-direct-llm.
user-invocable: false
---

# Voice & Chat — Three-Path Architecture

Every user-facing interaction in this app routes through one of three paths. The split is by **call composition**, not by surface. A single screen can use a different path depending on whether the user is talking, listening to a recorded prompt, or typing.

```
PATH 1 — Vapi (Onboarding)              full STT + LLM + TTS bundled in Vapi assistant
  User ⇄ Frontend ⇄ Vapi ⇄ User         realtime, bidirectional, tool webhooks for side effects

PATH 2 — Async Reflection (Check-ins)   composed pipeline, asynchronous turns
  User → Frontend → MP3 prompt → user reply → Cartesia Ink (STT) → callLLM → LLM → Sonic API (TTS) → User

PATH 3 — Direct LLM (Orb States 2/3/4)  text in, text out, no Vapi
  User → Frontend → callLLM → LLM → Frontend renders text → User
```

## Reference files

- [paths.md](paths.md) — full diagram, decision matrix, per-surface mapping
- [shared.md](shared.md) — `callLLM()`, `screen_contexts`, `session_log`, side-effect pattern (tool → DB → Realtime → UI)
- [glossary.md](glossary.md) — Vapi vs Cartesia (Ink, Sonic, Sonic-3, Line) — what each thing actually is

## When this skill is the right one to read

- "Which path does [screen X] use?" → [paths.md](paths.md)
- "What is callLLM?" / "Where does screen_contexts get used?" → [shared.md](shared.md)
- "Sonic vs Line vs Ink?" / "Vapi vs Cartesia?" → [glossary.md](glossary.md)
- "Why are some flows tap-driven and others voice?" → [shared.md](shared.md) ("caught up" principle)

## When to skip this and read a path skill

| Working on | Skill |
|---|---|
| Vapi assistant config, onboarding voice, gcartesia-agents repo, useOnboardingAgent, useRealtimeVoice | [path-1-vapi](../path-1-vapi/SKILL.md) |
| Morning/evening check-in voice, MP3 + Sonic composition, Cartesia REST endpoints, useVoiceCommand/Chat/Input, ActionDispatcher | [path-2-async](../path-2-async/SKILL.md) |
| The three non-Vapi orb states (UX-26 States 2/3/4), useLLM consumers, /api/llm, tap-driven LLM use | [path-3-direct-llm](../path-3-direct-llm/SKILL.md) |

## Migration posture

The repo is mid-migration. Today's code is mostly Cartesia (Line agent + REST STT/TTS + bespoke NLU). Target is the diagram above: Vapi for Path 1, callLLM-orchestrated MP3 + Cartesia for Path 2 (async voice), callLLM-only for Path 3 (the three non-Vapi orb states).

**Each path skill leads with its target state.** Current code is documented as legacy (`current-cartesia-*.md` files inside each path) — preserve while reading existing code, do not extend.

## Source of truth

Product-side reference: `~/Documents/Upwork/YA/Voice_System_Implementation_Guide.md` (v6.0, April 2026). The diagram in this skill is the engineering view of that doc.
