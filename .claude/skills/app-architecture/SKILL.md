---
name: app-architecture
description: Use when explaining or reviewing the LLM-centric architecture, the three LLM call paths (Vapi / Async Reflection / Direct LLM), callLLM() routing logic, state delta / caught-up principle, AI Context Block pipeline, /api/context + /api/llm + /api/session_log endpoints, screen_contexts / session_log database schema, Async Reflection state machine, Anonymization Architecture (anon_id), offline / low-connectivity Level 1, or the Frontend ↔ Backend boundary
user-invocable: false
---

# Architecture: LLM-Centric Voice + Text + Tap System

Source: Google Sheet **Guided Growth OS App Master** · tab `Architecture` · gid `1097854436` · maintained by Yair + Alejandro (CTO).

**This tab is the canonical prose reference.** If any code, task description, or developer assumption contradicts the Architecture tab, the Architecture tab wins. Read before writing any LLM-related code.

## When to use
- Designing or reviewing any LLM-related feature.
- Routing decision questions (Vapi vs Async Reflection vs Direct LLM).
- Schema design for `screen_contexts` / `session_log` / `user_profiles`.
- Anonymization, the `anon_id` boundary, or `callLLM()` privacy.
- Offline behavior, retry, or queue policy.
- Async Reflection state machine implementation (`P2-29`).

## The Core Insight (v6.0)

- The LLM is the **brain of the entire app** — voice, text, taps, background actions.
- Every interaction in Guided Growth eventually goes through the LLM, and the LLM needs to know where the user is on every screen, regardless of channel.
- Voice is one important channel. Text input, tap-driven habit creation, and background tasks all go through the LLM too.
- The LLM provider is swappable (currently OpenAI, can switch to Gemini Flash etc) — `callLLM()` abstracts this.

## Three LLM Call Paths, One Entry Point

> Paths are **cost tiers keyed to the UX-26 dual-button orb state**, not fixed screen groups — the path follows the live button state (see [voice-architecture](../voice-architecture/SKILL.md)). Screen lists below are defaults. STT is Soniox; TTS is Cartesia Sonic 3.5.

- **Path 1 — Vapi (State 1, both halves on; default for onboarding):** User speaks, Soniox STT transcribes, Vapi assistant calls LLM, agent speaks response back via Cartesia Sonic 3.5 TTS. Default for SPLASH, WELCOME, VOICE-PREFERENCE, MIC-PERMISSION, POST-AUTH-SIGNUP [DEPRECATED], ONBOARD-01..ONBOARD-BEGINNER-10, HOME-RETURN, ONBOARD-ADVANCED-01..02. Most expensive per minute.
- **Path 2 — one voice half (States 2/3); the check-in Async Reflection loop is one pattern here:** User hears MP3 prompt in cloned voice → speaks reply (Soniox STT) → brief MP3 acknowledgment plays while `callLLM()` processes → LLM-generated response streams to Cartesia Sonic API for live TTS in cloned voice. Default for MCHECK-01, MCHECK-02, ECHECK-01..06; also any one-way TTS (e.g. CHAT speaking with mic off). Cheaper than Vapi (~$0.006/check-in target). NEW in v2 plan.
- **Path 3 — Direct LLM (State 4, both halves off):** Frontend calls `/api/llm`. Backend calls LLM (OpenAI GPT-4o mini for MVP). No voice infrastructure. Used for text chat, habit edits, settings, insights, focus, milestones.
- All three paths use the **same `callLLM()` wrapper** backend-side. Same context+delta injection. Same logging. Same anonymization (`anon_id` always passed, never auth user_id).
- `callLLM()` decides path: Vapi if onboarding voice session active, Async Reflection if on a check-in screen, Direct otherwise. Routing logic lives in `callLLM()`.

## Two Inputs Prepended to Every LLM Call

- **AI Context Block:** Structured block from the Screens tab. Contains SCREEN, STATE, BEHAVIOR, DO NOT, NEXT for the current screen. Mostly static — changes when user navigates.
- **Recent State Delta:** What's happened in the app since the LLM last spoke. Read from `session_log` table. List of recent events: screens visited, habits added, check-ins completed, settings changed. Dynamic — rebuilt on every LLM call.
- Both prepended to base system prompt. The LLM is never blind.

## The "Caught Up" Principle

- Not every user action calls the LLM. Tap-heavy actions (add habit, mark complete) write to `session_log` but do NOT trigger an LLM call (saves money + latency).
- Next time the LLM IS invoked (open check-in, start voice convo, type in chat), it reads the `session_log` delta and is fully caught up.
- **Example:** User taps to add water habit at 2pm. `session_log` row written, no LLM call. At 8pm, user opens evening check-in. LLM reads context (ECHECK-01) + delta (recent: `habit_added` 'water', `habit_completed` 'gym', etc). Response: "How did the new water habit go today?" — LLM was silent for the tap but is fully caught up now.

## How Context Reaches the LLM (Pipeline)

1. **Source of truth:** This Google Sheet, Screens tab, AI Context Block column. Yair edits here.
2. **Runtime store:** Supabase `screen_contexts` table. Seeded by `scripts/voice-sync/seed_contexts.py` reading the Sheet.
3. **State delta source:** Supabase `session_log` table. Written to by frontend on every meaningful user action via `logEvent()`.
4. **Frontend hooks:** `useScreenContext(screen_id)` tracks current screen. `useLLM()` calls `/api/llm`. `useRealtimeVoice()` opens Vapi.
5. **Backend:** `callLLM()` fetches context + delta from `/api/context`, prepends to base prompt, routes to Cartesia or direct LLM, returns response.

## Frontend ↔ Backend Boundary (clarified post-standup)

- Frontend talks ONLY to our backend. Backend orchestrates Supabase, Cartesia, OpenAI/Gemini.
- **Why:** single point of contact, unified retry/queue policy, cleaner offline handling, easier to swap providers.
- **Today's exception:** Supabase queries from frontend (auth, simple reads). Acceptable for MVP because Supabase IS a backend service. But complex flows go through our backend.
- **Phase 2:** revisit and route everything through `/api/*` if it makes sense.

## Offline / Low-Connectivity Handling (Level 1 for MVP)

- **Decision (post-standup):** Level 1 graceful flaky-network handling for MVP. Save fuller offline support for Phase 2.
- **Level 1 includes:** client-side queue for `session_log` writes (flush on reconnect), network-aware UI state for LLM calls (no error spam), Vapi session auto-reconnect on drop.
- **Level 2 (Phase 2):** local cache of last-known AI context block per screen, batch sync of `session_log`, tap-driven actions save locally and sync later.
- **Level 3 (Phase 3+):** full offline mode with eventual consistency and conflict resolution.
- **Splash screen check:** if no internet on first open, show "No internet connection — try again when connected." Don't let user enter app in broken state.

## Database Schema (Supabase)

```sql
-- screen_contexts: AI context blocks, one row per screen
{ screen_id TEXT PRIMARY KEY,
  context_block TEXT NOT NULL,
  version INT DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT NOW() }

-- session_log: append-only event stream
{ id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),  -- NOTE: per UX-20, this should be anon_id in v2 plan
  session_id TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  event_type TEXT,
  screen_id TEXT,
  payload JSONB }

CREATE INDEX idx_session_log_user_time ON session_log(user_id, timestamp DESC);

-- user_profiles (existing) + new columns:
ai_output_mode TEXT DEFAULT 'voice',
mic_permission BOOLEAN DEFAULT false,
voice_mode TEXT DEFAULT 'voice'
```

## API Contract

- `POST /api/session_log` — frontend logs events. Body: `{ user_id, session_id, event_type, screen_id, payload }`. Returns: 200 with new id.
- `GET /api/context?screen_id=X&user_id=Y&since_ts=Z` — returns AI context + state delta. Body: `{ screen_id, context_block, version, state_delta: [...] }`. Cache `context_block` 60s; `state_delta` always fresh.
- `POST /api/llm` — frontend calls for direct LLM (non-voice). Body: `{ user_id, screen_id, user_input, options }`. Internally calls `callLLM()`. Returns: `{ response, metadata }`.

## `callLLM()` pseudo-code

```python
def callLLM(user_id, screen_id, user_input, options):
    {context_block, state_delta} = fetch /api/context?screen_id&user_id&since_ts=last_call_ts
    system_prompt = BASE_PROMPT + "\n\nCURRENT SCREEN:\n" + context_block \
                   + "\n\nRECENT ACTIVITY:\n" + formatDelta(state_delta)
    path = "cartesia" if isCartesiaActive(user_id) else "direct"
    if path == "cartesia":
        return cartesiaLineCall(system_prompt, user_input)
    else:
        return llmDirectCall(system_prompt, user_input)   # OpenAI, Gemini, etc

    # Record this call's timestamp — next call's delta starts here
    logEvent("llm_call", { path, screen_id, ... })
```

## PostHog vs `session_log` (two separate event systems)

- **PostHog Events tab** = product analytics. Used by Said / Yonas to understand user behavior, build funnels, measure retention. Naming: present-tense verbs (`complete_signup`, `create_habit`) per the v5 doc.
- **session_log Events tab** = backend state delta source for LLM. Used by `callLLM()` to keep the LLM aware of recent user actions. Naming: past-tense verbs (`habit_added`, `habit_completed`) because `session_log` records what HAS happened.
- Some user actions fire BOTH (e.g. user adds a habit → PostHog `create_habit` for analytics + `session_log` `habit_added` for LLM context). They serve different consumers and have intentionally different naming.

## Async Reflection Pattern (v2 plan, Stage 5) — DETAIL

Used by all 9 check-in screens (MCHECK-01, MCHECK-02, ECHECK-01..06).

**State machine:** `PROMPT → LISTENING → THINKING → RESPONDING → FOLLOWUP_OPTIONAL → CLOSING → DONE`

- **PROMPT:** Play pre-recorded MP3 from Supabase Storage in user's onboarded voice (cloned founder voice).
- **LISTENING:** Open mic via Soniox STT for streaming transcription. User can also tap UI scales (parallel input).
- **THINKING:** User finishes speaking (silence detection) or taps Check In. Play short 'thinking' MP3 (~1-2s) while `callLLM()` processes.
- **RESPONDING:** LLM response streamed to Cartesia Sonic API (NOT Vapi). Cartesia Sonic returns TTS audio in cloned voice. Display text alongside audio (UX-22 voice + text sync).
- **FOLLOWUP_OPTIONAL:** If LLM determines a follow-up question is needed, loop back to LISTENING. Otherwise proceed.
- **CLOSING:** Optional mood-matched MP3 closing (e.g. "Have a great day" for morning, completion-rate-matched for evening wrap-up).

**Cost target:** ~$0.006/check-in. Compared to Vapi which would be ~$0.05+ per check-in for the same interaction length.

**MP3 inventory:** ~30 files (MVP scope, reduced from 65 — subcategory/category/milestone deferred to Phase 2) per `P2-30` (VA-generated via Cartesia playground). Filenames TBD per `P2-36` (Yair tone bible).

**Why this pattern:** most of a check-in is predictable (the prompt, the thinking ack, the closing). Only the personalized response needs live LLM + TTS. Pre-recording the predictable parts cuts cost ~10x.

## Anonymization Architecture (v2 plan)

- **Decision:** every user gets an `anon_id` (random hash) separate from their Supabase auth user_id. Behavioral data (check-ins, habits, journal entries, `session_log`, PostHog events) keyed to `anon_id` ONLY. Identity (email, name) stored in `user_profiles` keyed to auth user_id.
- **Result:** even our team can't directly link a row of behavioral data back to a person. To support a user with a specific issue, they generate a temporary support code (`FF-09` — post-MVP).
- **Implementation:** `P1-46` in Stage 1. Affects: PostHog `identify()` calls (use `anon_id`, not auth user_id), `session_log.user_id` column (stores `anon_id`), Supabase RLS policies, all `callLLM()` context fetching.
- **`user_profiles` columns:** `auth_user_id` (Supabase auth), `anon_id` (random hash, set on signup), `name`, `email`, `ai_output_mode`, `mic_permission`, etc. The `anon_id` is what gets passed to LLM context, PostHog, `session_log`.
- **Why MVP not Phase 2:** scoped to 4 implementation steps, ~3 hours. Architectural decisions get harder to retrofit later. Start clean.
- **User-facing message:** `GC-16` (Anonymization / privacy) covers what to say if asked. POST-AUTH-SIGNUP [DEPRECATED] welcome script also references it ("anonymized from the first second").
- **Reference:** see Asana `FF-08` (anonymized data architecture, was scoped, now in MVP), `FF-09` (support tokens, post-MVP), `FF-10` (open-source the anon tool, post-MVP).

## Key Documents

- This Google Sheet (Guided Growth OS App Master) — single source of truth for screens, UX rules, tooltips, tasks, events, architecture.
- AI Context System Diagram (`AI_Context_System_Diagram.png`) — canonical visual reference. **If code/task/dev assumption contradicts the diagram, the diagram wins.**
- Voice System Implementation Guide v6.0 (Google Doc) — detailed prose explanation. Eventually deprecated as content moves into this sheet.
- PostHog Analytics Plan v5 (April 2026) — canonical source for the PostHog event taxonomy. v2 plan reconciliation: `cartesia_latency_ms` replaces ElevenLabs reference; `checkin_type` uses `evening` to match ECHECK-XX screens.

## Refresh

```
mcp__google-sheets__get_sheet_data(
  spreadsheet_id="1iNEdUm5vqmjk3YGEF1uMwfurcvgVRHykWUeBGHDBqcw",
  sheet="Architecture"
)
```

Trigger: "refresh app-architecture" or "resync the sheet".

_Last refreshed: 2026-05-11_
