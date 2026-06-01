---
name: path-1-vapi
description: Path 1 — Vapi-orchestrated voice for the onboarding journey (orb State 1, both halves on). Vapi assistant handles STT (Soniox) + LLM (OpenAI, configured in the Vapi dashboard — no BYO key, no callLLM proxy) + TTS (Cartesia Sonic 3.5) inside one realtime WebRTC session. App context IS injected (not via callLLM) — through assistantOverrides.variableValues (initial_screen_context, anon_id, screen, coaching_style) at cold start and client.send add-message mid-session (buildAssistantOverrides.ts, OnboardingVoiceProvider.pushScreenContext). Side effects flow Vapi tool webhook → Supabase write → Realtime → frontend (form auto-fill, navigate_next, current_step bump). Auto-invoked when working on the onboarding step pages, useOnboardingAgent / useRealtimeVoice / useOnboardingVoice / useOnboardingRealtimeSync, OnboardingChatOverlay, /api/cartesia-agent-token (legacy) or /api/vapi-* (target), the gcartesia-agents/ Python repo (legacy), Vapi assistant config, or onboarding tool webhooks. NOT for daily check-ins (path-2-async) or text chat (path-3-direct-llm).
user-invocable: false
---

# Path 1 — Vapi (Onboarding)

Realtime bidirectional voice, used only for the **conversational onboarding journey** (beginner ONBOARD-01..09, advanced-path screens, and the onboarding chat overlay). Vapi runs the full STT + LLM + TTS pipeline inside one WebRTC session; tool webhooks handle side effects.

```
User ⇄ Frontend (Vapi Web SDK) ⇄ Vapi assistant ⇄ User
                                  │
                                  ├─ STT: Soniox (multilingual, sub-200ms)
                                  ├─ LLM: OpenAI, runs inside Vapi (dashboard config; no BYO key, no callLLM proxy)
                                  └─ TTS: Cartesia Sonic 3.5 (cloned voice)

Context injection (NOT callLLM): app feeds screen context + session_log delta + form snapshot into Vapi via
  assistantOverrides.variableValues.initial_screen_context (cold start) and client.send({type:'add-message'}) (mid-session).
Side effects: Vapi tool call → /api/vapi-tool → Supabase write → Realtime → frontend
```

## Reference files

- [surfaces.md](surfaces.md) — every screen that uses Path 1 (and which are still on the legacy Cartesia Line code today)
- [tools-and-side-effects.md](tools-and-side-effects.md) — Vapi tool webhooks, the 8 onboarding tools, form auto-fill / navigate_next, CRISIS_BOUNDARY rule
- [current-cartesia-line.md](current-cartesia-line.md) — what's wired today (gcartesia-agents/ Python repo, useOnboardingAgent, useRealtimeVoice, smoke test, common failures) — preserve while reading existing code, do not extend

## Migration posture

| | Today | Target |
|---|---|---|
| Voice runtime | Cartesia Line (Python agent in `gcartesia-agents/`) | Vapi assistant (configured via REST/dashboard) |
| Browser SDK | `CartesiaAgentClient` over WebSocket | `@vapi-ai/web` over WebRTC |
| Token endpoint | `/api/cartesia-agent-token.ts` | Vapi call/assistant provisioner (`/api/vapi-call` or similar) |
| Tool runtime | Python `tools.py` (aiohttp → Supabase REST) | Vercel function (e.g. `/api/vapi-tool`) writing same Supabase rows |
| LLM call | Inside Cartesia Line | **Inside Vapi (OpenAI, dashboard config). No BYO key, no callLLM proxy. Context injected via `assistantOverrides.variableValues` + `add-message`, NOT callLLM** |
| STT provider | (Cartesia Line internal) | Soniox (inside Vapi) |
| TTS provider | Cartesia Sonic-3 | Cartesia Sonic 3.5 (Vapi uses Cartesia under the hood) |
| Side-effect bridge | Supabase Realtime → `useOnboardingRealtimeSync` | **Same** — only the source of writes changes |
| Per-screen sessions | Yes (each step mounts a fresh WS) | TBD — likely same shape, or one assistant with screen pushed via metadata |

**What survives unchanged:**
- The Supabase side channel (`useOnboardingRealtimeSync`, `onboarding_states` row updates).
- Per-screen prompt assembly (CORE_IDENTITY + CRISIS_BOUNDARY + RESPONSE_RULES + screen context).
- `CRISIS_BOUNDARY` ordering — must stay above brevity rules in the Vapi assistant prompt.
- The 8 onboarding tools' write semantics.

**What retires:**
- `gcartesia-agents/` Python repo.
- `/api/cartesia-agent-token.ts`.
- `cartesia.toml`, `cartesia deploy`, `npm run smoke:agent`.
- `CartesiaAgentClient` WebSocket transport.

## Surfaces

Path 1 covers the conversational onboarding journey only. See [surfaces.md](surfaces.md) for the full list. At a glance:

- ONBOARD-01..09 (beginner step pages)
- Advanced path onboarding screens (`Advanced*Page.tsx`)
- Plan review (`PlanReviewPage.tsx`)
- Onboarding chat overlay (`OnboardingChatOverlay.tsx`) — typed or voice mid-onboarding

Pre-onboarding screens (SPLASH/PREF/MIC/POST-AUTH) are **Path 2**, not Path 1, even though they appear in the onboarding flow timewise. They're one-way broadcasts; Path 1's session minutes burn for nothing on those.

## High-level flow (one onboarding screen)

```
1. Screen mounts → useOnboardingAgent('onboard_03')
2. Browser: POST /api/vapi-call → ephemeral Vapi call config
3. Browser opens Vapi WebRTC session (assistant id + metadata: { user_id, screen, coaching_style })
4. Vapi spawns assistant → screen context injected via `assistantOverrides.variableValues.initial_screen_context` (not callLLM)
5. Assistant speaks intro → audio streams to browser
6. User speaks → mic streams to Vapi → Soniox transcribes
7. Assistant decides to call a tool → Vapi POSTs /api/vapi-tool with the tool args
8. /api/vapi-tool writes to Supabase (onboarding_states.data merge, current_step bump, etc.)
9. Supabase Realtime fans out → useOnboardingRealtimeSync hydrates form
10. Assistant calls navigate_next tool → current_step bumps → frontend routes onward
```

## Per-screen sessions (MVP tradeoff)

Each onboarding step mounts a fresh session because the prompt is screen-specific (assembled at session start with the screen's context block). Cost: ~1–2s of silence on transitions. A persistent assistant that pushes screen updates over a side channel would fix it; not needed for MVP.

## CRISIS_BOUNDARY — non-negotiable

The crisis-handling block must sit **above** brevity / coaching-style rules in the assistant's system prompt. Carries the same intent as the legacy `CRISIS_BOUNDARY` section in `gcartesia-agents/main.py`. Don't drop it during the Vapi config build. Per task P1-29.

## When you're editing Path 1 code

- **Adding a new tool** → register it in the Vapi assistant config + add a handler branch in `/api/vapi-tool`. (Today: also add the function in `gcartesia-agents/tools.py` and the `tools=[…]` list in `main.py`.) See [tools-and-side-effects.md](tools-and-side-effects.md).
- **Editing screen behavior** → screen context in `screen_contexts` table (seeded by `scripts/voice-sync/seed_contexts.py`) — data, not code. Avoid touching the assistant's CORE_IDENTITY / CRISIS_BOUNDARY for screen tweaks.
- **Editing transport** → Vapi assistant config (target) or `src/lib/services/cartesia-agent.ts` + `useRealtimeVoice.ts` + `/api/cartesia-agent-token.ts` (legacy).
- **Verifying connectivity** → today: `npm run smoke:agent` (Cartesia Line). Target: a Vapi smoke command (TBD).

## Don't confuse Path 1 with Path 2

The onboarding chat overlay (Path 1) and the home check-in voice command (Path 2) both look like "tap the mic and talk." They're not the same path:

| | Path 1 — onboarding chat overlay | Path 2 — home check-in |
|---|---|---|
| Trigger | mid-onboarding | post-onboarding daily |
| Voice runtime | Vapi (realtime, multi-turn) | Async composition (single utterance, one reply) |
| Conversation | yes — coached dialogue, can interrupt | no — single intent → single action |
| Persistence | tool webhook → Supabase | ActionDispatcher → DataService |

If the surface is anywhere outside the onboarding journey, it's not Path 1.
