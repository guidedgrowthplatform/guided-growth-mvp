---
name: voice-assistant
description: Cartesia Line voice assistant context — the realtime WebSocket coaching agent (Python agent repo + browser client + Supabase side channel). Auto-invoked when working on Cartesia code, useRealtimeVoice / useOnboardingAgent, /api/cartesia-agent-token, the onboarding voice flow, or anything in the sibling `gcartesia-agents/` repo.
user-invocable: false
---

# Voice Assistant — Cartesia Line Agent

The realtime voice coach used during onboarding step pages. Multi-turn dialogue, full streaming audio, tool calls executed inside the agent runtime. **Distinct from [voice-commands](../voice-commands/SKILL.md)**, which is the single-utterance command pipeline (Cartesia REST STT + GPT-4o-mini NLU) used by the home check-in, journal, onboarding chat overlay, and feedback voice note. Both are live and serve different surfaces.

## Reference Files

- [agent-runtime.md](agent-runtime.md) — Python agent in `../gcartesia-agents/` (main.py, tools.py, system prompt, screen contexts)
- [web-client.md](web-client.md) — Browser-side hooks + WebSocket client (useOnboardingAgent, useRealtimeVoice, cartesia-agent.ts, token endpoint)
- [protocol.md](protocol.md) — Wire protocol, env vars, smoke test command

## Repo Split

```
~/Documents/Upwork/YA/
├── guided-growth-mvp/        ← THIS repo. Web app + Vercel functions.
└── gcartesia-agents/         ← SEPARATE repo. Python agent on Cartesia Line.
                                Deployed with `cartesia deploy`.
                                Lives at agent_2UrpaeEp9odZ136vo6LnWp.
```

Both repos share the same Supabase project. The agent writes via service-role REST; the web app reads via Supabase Realtime.

## High-Level Flow (one onboarding screen)

```
1. Screen mounts → useOnboardingAgent("onboard_03")
2. Browser: POST /api/cartesia-agent-token → ephemeral token (1h)
3. Browser opens wss://api.cartesia.ai/agents/stream/{agentId}?access_token=…
4. Browser sends `start` { metadata: { user_id, screen, coaching_style } }
5. Cartesia spawns agent → main.get_agent() builds prompt FOR THAT screen
6. Agent speaks intro → media_output frames stream PCM back
7. User speaks → mic PCM → media_input frames
8. STT → UserTextSent fires LLM (custom run filter — see agent-runtime.md)
9. LLM calls a tool → tools.py writes to Supabase via aiohttp REST
10. Supabase Realtime fans out → useOnboardingRealtimeSync hydrates form
11. Agent calls navigate_next → current_step bumps → frontend routes onward
```

## Two Transports — Don't Confuse Them

| Path | Direction | Carries |
|------|-----------|---------|
| Cartesia WebSocket | Browser ↔ Cartesia | Audio in/out, start/ack/clear, custom |
| Supabase Realtime | Supabase → Browser | Tool-write side effects (`onboarding_states` row updates) |

**Tool calls and transcripts are NOT on the agent WS.** Cartesia's `agents/stream` protocol does not forward them. If the UI needs to react to anything the agent did, that signal arrives via Supabase, not the WebSocket. This is why `useOnboardingRealtimeSync` exists.

## Per-Screen Sessions (MVP tradeoff)

Each onboarding step mounts a fresh WebSocket session because `metadata.screen` is read inside `get_agent()` and baked into the system prompt at construction time. Cost: ~1–2s of silence on transitions. A persistent provider that keeps one session alive and pushes screen updates via the `custom` event would fix it, but is not needed for the MVP demo.

## Crisis Boundary — Non-Negotiable

`gcartesia-agents/main.py` keeps `CRISIS_BOUNDARY` as a top-level prompt section ABOVE `RESPONSE_RULES`. Brevity caps and coaching style do not apply once a crisis cue fires. If you edit the prompt assembly, preserve that ordering — it's intentional per task P1-29.

## When You're Editing Voice Code

- **Editing tools** (e.g. adding a new tool call) → both repos: add the function in `tools.py`, register it in `main.py`'s `tools=[…]` list, and make sure the LLM is told *when* to call it via the system prompt or per-screen JSON.
- **Editing screen behavior** → usually the right place is `gcartesia-agents/screen_contexts.json` (data, not code) or the `intros` dict in `main.py`. Avoid touching `CORE_IDENTITY` / `CRISIS_BOUNDARY` for screen tweaks.
- **Editing transport** → `src/lib/services/cartesia-agent.ts` for the wire protocol; `src/hooks/useRealtimeVoice.ts` for mic capture, playback scheduling, and state machine; `api/cartesia-agent-token.ts` for token minting.
- **Verifying connectivity** → `npm run smoke:agent` (needs Node 22+). See protocol.md.
