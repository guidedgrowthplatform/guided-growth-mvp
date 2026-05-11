---
name: app-llm-activation
description: Use when reasoning about when the LLM is active vs not, which of the three LLM paths (Vapi / Async Reflection / Direct LLM) fires on a given screen, MP3 vs LLM-generated voice, which input type (voice / text / tap) triggers callLLM, frontend hook usage per screen group, the "caught-up" principle, or anonymization flow
user-invocable: false
---

# LLM Activation — When Is The AI Active?

Source: Google Sheet **Guided Growth OS App Master** · tab `LLM Activation` · gid `1245145682` · maintained by Yair + Alejandro (CTO).

Quick reference for the team. Answers: when is the LLM called, which path, what's an MP3 vs LLM-generated voice, and what kind of input triggers what. Updated for v2 plan.

## When to use
- Designing a new screen — pick the right path / hook.
- Debugging an unexpected LLM call (or absence of one).
- Cost analysis — which screens are expensive (Vapi) vs cheap (Async Reflection / Direct).
- Wiring `useScreenContext` / `useLLM` / `useRealtimeVoice` / `useAsyncReflection` / `useVoicePlayer`.

## The one-line answer

The LLM is **ALWAYS available** from app load onward. Every user input — voice or text — goes through `callLLM()`. Tap-only actions don't directly call the LLM but write to `session_log` so the LLM is caught up next time.

## Three input types (key mental model)

1. **User voice input** — User speaks. Audio captured by Cartesia Ink STT, sent to `callLLM()`. Path depends on screen (see Three Paths below).
2. **User text input** — User types in any text field (chat, habit name, reflection answer). Sent to `callLLM()` via Direct LLM path. No voice infrastructure involved.
3. **User tap input** — User taps a button. Two sub-cases:
   - (a) **Navigation tap** (Continue, Sign Up, Back) — frontend handles, no LLM call.
   - (b) **Data tap** (mark habit complete, tap a mood emoji, toggle setting) — frontend writes to `session_log`, no LLM call. The LLM catches up next time it's invoked.

## Three LLM paths (v2 plan)

- **Path 1 — Vapi:** live voice agent. **ONBOARDING ONLY.** Screens: SPLASH (silent), WELCOME, VOICE-PREFERENCE, MIC-PERMISSION, POST-AUTH-SIGNUP [DEPRECATED], ONBOARD-01..ONBOARD-BEGINNER-10, HOME-RETURN, ONBOARD-ADVANCED-01/02. Cost: highest per minute.
- **Path 2 — Async Reflection:** MP3 prompt + Cartesia Sonic API for response. **CHECK-INS ONLY.** Screens: MCHECK-01, MCHECK-02, ECHECK-01..06. Pattern: pre-recorded prompt MP3 → user voice (Ink STT) → brief 'thinking' MP3 ack → LLM response streamed to Cartesia Sonic API for live TTS. Cost: ~$0.006/check-in (much cheaper than Vapi).
- **Path 3 — Direct LLM:** `callLLM()` with no voice infrastructure. **Everything else** — text chat, free-form voice conversation (CHAT uses Cartesia Sonic for TTS only, no Vapi assistant), habit edit, settings, focus session, insights, milestones. Cost: just LLM API tokens.
- All three paths use the SAME `callLLM()` wrapper backend-side. Same context+delta injection. Same logging. Same anonymization (`anon_id` always passed, never auth user_id).
- `callLLM()` decides path: Vapi if onboarding voice session active, Async Reflection if on a check-in screen, Direct otherwise. Routing logic lives in `callLLM()`.

## Why this is the right architecture for MVP

- **Simpler frontend:** every voice/text input uses the same `callLLM()` backend. Frontend doesn't worry about which LLM path is being used.
- **Cost-tiered:** Vapi reserved for onboarding (high-trust moment, worth the cost). Async Reflection cuts check-in cost ~10x by pre-recording predictable parts (prompt, thinking ack, closing) and using Cartesia Sonic only for the personalized response. Direct LLM has no voice infrastructure cost.
- **Tap-heavy actions still cost zero LLM dollars:** marking a habit done by tap is just a database write. The LLM hears about it next time it's invoked, via `session_log`.
- Aligns with v2 plan + v6.0 architecture: `callLLM()` is the single entry point. Anonymization (`anon_id`) flows through the wrapper, not at each call site.

## MP3 vs LLM-generated voice — different question from "is LLM active"

- **MP3** = pre-recorded system speech (Yair's cloned voice, generated once via Cartesia playground, stored in Supabase Storage). Used for predictable system messages where the same words apply to every user.
- **Vapi live TTS** = dynamic system speech via the live Vapi agent (with Cartesia TTS plugged in). Used for onboarding where the agent says the user's name back, asks follow-up questions, and routes the conversation.
- **Cartesia Sonic API live TTS** = LLM-generated text spoken via Cartesia Sonic (cheaper than orchestrated Vapi). Used for check-in responses (Async Reflection) and free-form voice conversations.
- ALL THREE are "system speech." The user can speak DURING any of them. If they do, the user's voice goes to STT and then through `callLLM()`.
- **Where MP3s are used in MVP:** (1) Async Reflection prompts/acks/closings on the 9 check-in screens (~30 files per `P2-30`, VA-generated). (2) VOICE-CAP message. (3) Phase 2: subcategory/category/milestone responses currently planned as MP3. **NO MP3s in onboarding** (changed in v2 plan from earlier MP3-based design).

## Frontend behavior by screen group (v2 plan)

- **ONBOARDING (SPLASH → ONBOARD-BEGINNER-10):** Vapi agent path. Mic granted at MIC-PERMISSION. Frontend uses `useRealtimeVoice` hook for Vapi session management. No MP3s for system speech.
- **HOME (HOME-FIRST, HOME-MORNING, HOME-EVENING, HOME-RETURN):** No auto-play voice. Mic tap routes to MCHECK-01 / ECHECK-01 / CHAT depending on state. HOME-FIRST has the TT-01..TT-08 spotlight tour.
- **CHECK-INS (MCHECK-01, MCHECK-02, ECHECK-01..06):** Async Reflection path. Frontend uses the async reflection state machine: `PROMPT → LISTENING → THINKING → RESPONDING → FOLLOWUP_OPTIONAL → CLOSING → DONE`. MP3s loaded from Supabase Storage. Cartesia Sonic API for personalized responses.
- **VOICE CONVERSATION (CHAT):** Direct LLM path with Cartesia Sonic for TTS. No Vapi agent. Cap of 5/day per `UX-12`.
- **HABIT / FOCUS / INSIGHTS / SETTINGS / MILESTONE (Phase 2 screens):** Direct LLM. Voice on demand only (mic tap). Some scripted MP3s for milestones (Phase 2).
- **PURE DATA-ENTRY (AUTH-SIGNUP, AUTH-LOGIN):** NO LLM hooks. Just standard React forms. Voice greeting happens later (HOME or POST-AUTH-SIGNUP [DEPRECATED]).

## The "caught up" principle (unchanged, still critical)

- Tap-only actions (mark habit complete, change setting, add habit via UI) write to `session_log`. They do NOT directly invoke `callLLM()`.
- Next time the LLM IS called (any voice or text input), it reads `session_log` delta as part of context. It "catches up" on whatever happened in between.
- **Frontend rule:** ALWAYS call `logEvent()` on meaningful actions, even when no LLM call. Otherwise the LLM is blind to user activity.
- **Concrete example:** User opens app at 8 AM, taps habit complete on 'gym' (`logEvent` fires, no LLM call). At 8 PM, opens evening check-in. Async Reflection starts. `callLLM()` runs, reads `session_log`, sees gym was completed, can reference it in the LLM-generated response.

## When does the LLM actually get called (definitive list)

- **(a)** User speaks (after mic granted) — ALWAYS `callLLM()`. Path: Vapi (onboarding) \| Async Reflection (check-ins) \| Direct + Cartesia Sonic (everything else).
- **(b)** User types in any text input field — ALWAYS `callLLM()` via Direct LLM path. No voice infrastructure.
- **(c)** System needs to generate dynamic content (insights, weekly summary, evening wrap-up message, milestone copy) — `callLLM()` via Direct LLM path; response may or may not be spoken via Cartesia Sonic depending on context.
- Everything else: NO LLM call. Tap navigation, tap data entry, MP3 playback, splash loading, background sync.

## When does the LLM NOT get called (also definitive)

- User taps a button that's pure navigation (Sign Up, Continue, Back) — frontend handles routing.
- User taps a button that's data entry (check off a habit, tap a mood emoji, toggle reminder) — `logEvent` + database write only.
- User types email/password in auth form — this is auth data, never goes to LLM.
- MP3 plays (Async Reflection prompts/acks/closings) — the playback itself doesn't invoke the LLM. **But if the user speaks DURING the MP3, that user voice goes to STT and through `callLLM()`.**
- Splash loading, app initialization, background sync, push notification scheduling.

## Frontend hook usage by screen (simplified)

- **EVERY screen with user input** imports: `useScreenContext` (fetches AI context block from Supabase `screen_contexts` for the current screen).
- **Onboarding screens (Vapi path):** `useRealtimeVoice` (manages Vapi session lifecycle).
- **Check-in screens (Async Reflection path):** `useAsyncReflection` (manages the state machine, MP3 playback, STT, Sonic API calls).
- **Free-form voice / text screens (Direct LLM path):** `useLLM` (calls `/api/llm`). Voice mode adds Cartesia Sonic for TTS.
- **Pure data-entry screens (auth forms):** NO LLM hooks. Just standard React.

## Anonymization (v2 plan, applies to all paths)

- Every `callLLM()` call passes `anon_id`, NEVER auth user_id. The wrapper handles this lookup once at the boundary.
- Same for `session_log` writes, PostHog events, and any analytics. `anon_id` everywhere.
- See `app-architecture` → Anonymization Architecture section for full detail. Implementation: `P1-46` (Stage 1).
- User-facing message: `GC-16` covers what to say if asked about privacy.

## What to tell the team (3 sentences)

1. Any time the user speaks or types, that input goes through `callLLM()`. Path depends on screen group: Vapi for onboarding, Async Reflection for check-ins, Direct LLM otherwise.
2. Tap-only actions don't call the LLM directly — they write to `session_log` so the LLM catches up next time it's invoked.
3. MP3s in MVP are for check-in prompts/acks/closings (Async Reflection pattern, ~30 files) and the voice cap message. NO MP3s in onboarding — that's all Vapi live TTS.

## See also

- `app-screens` — per-screen reference; check `Screen Type`, `Voice Engine`, `Stage` columns.
- `app-architecture` — full prose, including Async Reflection state machine and Anonymization detail.
- `app-session-events` — all event types that fire even when the LLM is silent.
- `app-tasks` — `P1-42` (Wire Vapi context builder), `P2-29` (Async reflection state machine), `P2-32` (Text chat).
- Asana **FF-06** — free intent detector to skip LLM calls for trivial inputs.

## Refresh

```
mcp__google-sheets__get_sheet_data(
  spreadsheet_id="1iNEdUm5vqmjk3YGEF1uMwfurcvgVRHykWUeBGHDBqcw",
  sheet="LLM Activation"
)
```

Trigger: "refresh app-llm-activation" or "resync the sheet".

_Last refreshed: 2026-05-11_
