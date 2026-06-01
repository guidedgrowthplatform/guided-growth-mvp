# Three Paths: Diagram, Decision Matrix, Per-Surface Mapping

## The model: 5 primitives, 4 button states, 3 paths

The orb is a dual-button control (UX-26). Two independent halves:

- **AI-output half** (left): when on, the AI speaks via Cartesia TTS.
- **Mic half** (right): when on, the user's speech is captured and transcribed via Soniox.

Five engine primitives sit behind those halves:

- **LLM**: always available, reached through `callLLM()`. Decides intent, drives ActionDispatcher.
- **STT**: Soniox (primary, multilingual, sub-200ms streaming). On only when the mic half is on.
- **Cartesia TTS**: Sonic 3.5, cloned voice. On only when the AI-output half is on.
- **Vapi**: full-duplex orchestrator. On only when BOTH halves are on at once.
- **MP3**: pre-recorded prompt playback, no LLM. A cheaper stand-in for the AI-output half on scripted prompts.

The two halves give four button states. The four states collapse into three cost-tier paths:

| Button state | AI half | Mic half | Engine | Path |
|---|---|---|---|---|
| State 1 | on | on | Vapi full-duplex loop | Path 1 |
| State 2 | on | off | Cartesia one-way TTS (or MP3) | Path 2 |
| State 3 | off | on | Soniox STT in, text reply out | Path 2 |
| State 4 | off | off | LLM text only | Path 3 |

The path is a property of the **live button state**, not of the screen. A surface has a default state, but the moment a user flips a half, the path changes under it.

**Boundary rule.** Any voice present means at least Path 2. Both voice halves live at once means Path 1. Dropping one Vapi half falls to Path 2, it never falls straight to Path 3. Only when BOTH voice halves are off do you reach Path 3. Path 1 is the only state where the two halves are live simultaneously (full-duplex, interruption-aware); a turn-based prompt-then-reply (check-in) is a sequence of single-half Path 2 states, never Vapi.

## The diagram

```
PATH 1 (State 1): AI half ON + Mic half ON, Vapi full-duplex
─────────────────────────────────────────────────────────────────────────
User → Frontend → ┌──── Vapi (full voice orchestration) ─────┐ → Frontend → User
                  │  STT (Soniox, multilingual, sub-200ms)   │
                  │  LLM (OpenAI inside Vapi, no BYO/callLLM) │
                  │  TTS (Cartesia Sonic 3.5, cloned voice)   │
                  └──────────────────────────────────────────┘
Context: injected into the Vapi assistant (NOT callLLM) via assistantOverrides.variableValues + add-message.
Side effects: Vapi tool webhook → Supabase write → Realtime → frontend (auto-fill / navigate_next)

PATH 2 (State 2 or State 3): exactly one voice half on
─────────────────────────────────────────────────────────────────────────
State 2 (AI on, mic off), one-way TTS:
  User → Frontend → callLLM() → LLM → Cartesia Sonic 3.5 (or MP3 prompt) → User
State 3 (AI off, mic on), STT in / text out:
  User speaks → Soniox STT → callLLM() → LLM → Frontend renders text → User
Check-in pattern: a turn-based string of State 2 (prompt) then State 3 (reply),
  never both halves live at once, so never Vapi.
Side effects: ActionDispatcher invoked from callLLM result → Supabase writes → UI updates

PATH 3 (State 4): AI half OFF + Mic half OFF, text only
─────────────────────────────────────────────────────────────────────────
User → Frontend → callLLM() → LLM → Frontend renders text → User
Side effects: tap actions write session_log; CRUD via ActionDispatcher when intent maps to one (snake_case tools: update_profile, navigate_next, log_event)
```

## Decision matrix: which path is live right now?

Read the orb's two halves. The path follows from the button state, in this order:

```
1. Are BOTH halves on (AI output + mic, live at once)?
   YES → Path 1 (Vapi full-duplex).
   NO  → continue.

2. Is exactly ONE voice half on (now or alternating turn-by-turn)?
   YES → Path 2.
         AI half only  → one-way Cartesia TTS (or MP3 prompt).
         Mic half only → Soniox STT in, text reply out.
         Check-in      → prompt (State 2) then reply (State 3), sequential.
   NO  → continue.

3. Both halves off?
   YES → Path 3 (Direct LLM, text only).
```

For a NEW surface, pick its DEFAULT button state, then read the path off the same table. Onboarding defaults to State 1 (Path 1). Check-ins and one-way prompts default to State 2 or State 3 (Path 2). Pure text chat defaults to State 4 (Path 3). The user can still flip a half, and the path moves with the state, it is not pinned to the screen.

## Per-surface mapping (default button state)

The Path column is the surface's **default**. A user flipping an orb half re-derives the path from the table above.

| Surface | Default state | Path | Notes |
|---|---|---|---|
| SPLASH-01 (welcome hook) | State 2 | Path 2 | MP3 (when present) or Sonic REST one-shot. Today: live Sonic REST per client override. |
| PREF-01 (voice preference ask) | State 2 | Path 2 | Pre-recorded MP3 (when generated) or Sonic REST. |
| MIC-01 (mic permission) | State 2 | Path 2 | Pre-recorded MP3 (when generated) or Sonic REST. |
| POST-AUTH-01 (welcome intro) | State 2 | Path 2 | Pre-recorded MP3 (when generated) or Sonic REST. |
| ONBOARD-01..09 (beginner) | State 1 | Path 1 | Vapi assistant per session, screen passed in metadata. Flipping a half drops to Path 2. |
| Advanced onboarding screens | State 1 | Path 1 | Same Vapi assistant, advanced-path screens. |
| Onboarding chat overlay (voice) | State 1 | Path 1 | Mid-onboarding coached chat, full-duplex. |
| Plan review (ONBOARD-07) | State 1 | Path 1 | Vapi assistant. |
| Morning check-in | State 2 then 3 | Path 2 | Turn-based: MP3/Sonic prompt then Soniox STT then callLLM then Sonic. Replaces today's Line session. |
| Evening check-in | State 2 then 3 | Path 2 | Same as morning. |
| Home voice check-in (single utterance) | State 3 | Path 2 | Mic-only single utterance, folds into the same Path-2 composition. |
| Journal voice input | State 3 | Path 2 | Soniox STT only (transcript-only mode). No LLM unless user asks for analysis. |
| Feedback voice note | State 3 | Path 2 | Soniox STT only. |
| Affirmation playback | State 2 | Path 2 | Sonic REST one-shot (AI half only). |
| Post-onboarding CHAT screen | State 2 | Path 2 | AI speaks by default; flips to State 3 (Path 2) or State 4 (Path 3) via orb. Same callLLM path. |
| Onboarding chat overlay (typed branch) | State 4 | Path 3 | callLLM only, no voice half on. |
| Tap actions (accept suggestion, change pref, navigate step, complete habit) | State 4 | Path 3 | Write session_log; LLM reads delta on next call. See [shared.md](shared.md). |
| Tap-driven LLM consumers (suggestions, summaries, parse-on-submit) | State 4 | Path 3 | callLLM with synthesized prompt. |

> **Pre-recorded MP3 status (May 2026)**: not all of SPLASH/PREF/MIC/POST-AUTH have generated MP3 assets yet. Until they do, those screens fall through to live Sonic REST under Path 2. The flow is the same; only the "MP3 prompt" box collapses to a no-op.

## Path comparison

| | Path 1: Vapi (State 1) | Path 2: one voice half (States 2/3) | Path 3: text (State 4) |
|---|---|---|---|
| **Triggered by** | Both orb halves on at once (default on onboarding / voice chat overlay) | Exactly one voice half on: a check-in, journal, affirmation, or a flipped orb half | Both halves off: text submit or tap action |
| **Transport** | Vapi Web SDK (WebRTC) | HTTPS POST to Soniox + Sonic + LLM endpoints | HTTPS POST to LLM endpoint |
| **Conversation** | Multi-turn, interruption-aware, full-duplex | Single turn, or turn-based prompt then reply | Single turn |
| **STT** | Soniox (inside Vapi) | Soniox, streaming or REST | n/a |
| **LLM call** | Inside Vapi (OpenAI, dashboard config); no BYO, no callLLM — context via `variableValues` + `add-message` | callLLM (direct) | callLLM (direct) |
| **TTS** | Cartesia Sonic 3.5 (inside Vapi) | Cartesia Sonic 3.5 (REST) | n/a |
| **Cost driver** | Vapi session-minutes | Per-character TTS + per-second STT + LLM tokens | LLM tokens only |
| **Side effects** | Vapi tool webhook → Supabase → Realtime → UI | callLLM result → ActionDispatcher → DataService → UI | session_log write; optional ActionDispatcher |
| **Latency to first audio** | ~500ms after Vapi connect | ~50ms (cached MP3) or ~250 to 400ms (Sonic REST) | n/a (text) |

## Why the split is shaped this way

- **Path 1, both halves live at once.** Vapi is billed per session-minute and runs a full-duplex loop. Opening it speculatively, or leaving both halves on when the user only needs one, burns minutes for silence. Reserve it for surfaces that genuinely need bidirectional realtime with interruption.
- **Path 2, exactly one voice half.** Soniox and Cartesia Sonic are billed per usage, with no persistent connection, so cost scales with what the user actually does. This is where a dropped Vapi half lands: turn off the mic and the AI still speaks (State 2); turn off the AI and the mic still listens (State 3). It does not collapse to text.
- **Path 3, both halves off.** Text and tap-driven flows need no voice machinery. Routing them through callLLM keeps context (`screen_contexts`) and state delta (`session_log`) consistent across all three paths.

## Anti-patterns to refuse

| Pattern | Why it's wrong |
|---|---|
| Opening Vapi when only one half is on | Vapi is for State 1 (both halves live). One-way TTS or STT-only is Path 2 (Sonic / Soniox REST). |
| Treating a flipped-off half as Path 3 | Dropping one Vapi half is Path 2, not Path 3. Path 3 needs BOTH voice halves off. |
| Calling OpenAI / Anthropic directly from a hook | Bypasses callLLM, so the LLM goes blind to screen_contexts and session_log. |
| Building a fourth path | The model forbids it: 5 primitives, 4 button states, 3 paths. Extend callLLM or add a tool webhook on Path 1 / 2. |
| Routing tap actions through Vapi or Sonic | Tap-driven CRUD writes to session_log and may invoke ActionDispatcher. No voice machinery. |
| Leaving a Vapi session open across screens "to save handshake" | Vapi is billed for the whole open window. Close on unmount. |
