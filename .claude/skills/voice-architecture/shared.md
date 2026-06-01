# Shared Across All Three Paths

Concepts and code that every path depends on. If you change anything here, audit all three paths.

## `callLLM()` — single LLM entry point

The wrapper every LLM call must go through. Adds context + state delta, picks the right transport for the path, records timestamps.

```ts
async function callLLM({ userId, screenId, userInput, channel }) {
  const context = await fetchScreenContext(screenId);   // from screen_contexts
  const delta   = await fetchSessionDelta(userId);      // from session_log since last call
  const fullPrompt = `${context}\n${delta}\n${BASE_SYSTEM_PROMPT}`;

  const response = channel === 'vapi'
    ? await sendToVapi(fullPrompt, userInput)            // Path 1
    : await openai.chat.completions.create({ ... });     // Paths 2 + 3

  await recordLLMCallTimestamp(userId);
  return response;
}
```

**Status (May 2026):** not built yet (P1-34). Today's code makes ad-hoc OpenAI/Anthropic calls. The data foundation is in place — see `screen_contexts` and `session_log` below — but nothing wraps them yet.

**Rule:** when callLLM lands, no path bypasses it. Direct OpenAI calls from a hook, direct Anthropic calls from a Vercel function, and direct LLM provider calls from Python tools all violate this — they skip context injection and the LLM goes blind.

## `screen_contexts` table — where the user is

Static-ish per-screen prompt block. One row per screen ID. Seeded from the Voice Journey Sheet.

```sql
screen_contexts (
  screen_id     TEXT PRIMARY KEY,    -- e.g. "ONBOARD-03"
  context_block TEXT NOT NULL,        -- SCREEN/STATE/BEHAVIOR/DO NOT/NEXT
  content_hash  TEXT NOT NULL,
  source_row    JSONB NOT NULL,
  version       INT NOT NULL DEFAULT 1,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Built by migration `016_screen_contexts_and_session_log.sql`. Seeded by `scripts/voice-sync/seed_contexts.py` from the Google Sheet.

## `session_log` table — what the user just did

Append-only event stream. Frontend writes on every meaningful user action, regardless of path.

```sql
session_log (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id),
  session_id  TEXT NOT NULL,
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_type  TEXT NOT NULL,         -- navigate, form_submit, habit_added, ...
  screen_id   TEXT,
  payload     JSONB
);
```

`callLLM()` reads rows for `user_id` since the last `recordLLMCallTimestamp(userId)` and prepends them as the **state delta**.

Write API (`POST /api/session_log`) is task P1-32 — not built yet.

## Side-effect pattern — tool → DB → Realtime → UI

The pattern that makes "voice does the form filling and navigation" work. Used by Path 1 (Vapi tool webhooks) and Path 2 (ActionDispatcher invoked from callLLM result).

```
LLM emits a tool call ("save these onboarding fields")
   ↓
Tool handler runs server-side (Vapi webhook OR Vercel function for Path 2)
   ↓
Writes to Supabase (e.g. onboarding_states row, daily_checkins, user_habits)
   ↓
Supabase Realtime fans out to subscribed channels
   ↓
Frontend hook (useOnboardingRealtimeSync, etc.) invalidates React Query
   ↓
Component re-reads → form auto-fills, current_step bumps, navigation triggers
```

**Why Realtime, not direct return:**
- Vapi WebRTC doesn't forward tool results to the browser by default.
- Cartesia Line WS didn't either (legacy Path 1 detail).
- Realtime gives a single bus that any number of UI components can subscribe to without coupling to the AI provider.

**Path 1 implementation today:** `gcartesia-agents/tools.py` writes via aiohttp REST → Supabase. Replaces with Vapi tool webhook (Vercel function in this repo) writing the same rows. Frontend hook (`useOnboardingRealtimeSync`) is unchanged.

**Path 2 implementation today:** `ActionDispatcher` runs in the browser, calls `DataService` methods, writes via `supabase-js`. May relocate server-side when Path 2 fully composes through callLLM.

## "Caught up" principle — taps don't always call the LLM

Tap-driven actions (add a habit, mark a goal complete, change a preference) write to `session_log` and skip the LLM. The LLM picks them up on the *next* call (e.g. when the user opens the evening check-in).

Trigger points where `callLLM()` *is* invoked:
- User starts a Vapi session (Path 1)
- User submits text in a chat surface or finishes STT in a non-Vapi orb state (Path 3)
- User finishes speaking inside a check-in (Path 2)
- Background job runs (insights, summaries — Path 3)

Everything else writes to `session_log` and waits. Cheap and aware.

## Browser primitives shared across paths

| File | Owner | Used by |
|---|---|---|
| `src/lib/services/tts-service.ts` | (browser TTS playback, calls Sonic REST) | Path 2 + ~17 UI components (toasts, check-in cards, feedback button) |
| `src/lib/services/stt-service.ts` | (browser mic capture + Soniox REST upload) | Path 2 |
| `src/contexts/VoiceContext.tsx` + `src/hooks/useVoice.ts` | (mutual-exclusion lock between voice modes) | Path 1 + Path 2 |
| `src/stores/voiceSettingsStore.ts` | (recording mode, TTS toggle, voice preference) | Path 1 + Path 2 + Settings UI |
| `src/stores/voiceStore.ts` | (listening / transcript / interim state) | Path 1 + Path 2 |

If you touch any of these, audit both Path 1 and Path 2 consumers — neither path "owns" them.

## Two bills, three paths

| Path | Voice provider bill | LLM bill |
|---|---|---|
| Path 1 (Vapi, State 1) | Vapi session-minutes (Vapi internally pays Soniox + Cartesia) | LLM tokens billed inside Vapi (OpenAI, dashboard config — no BYO key, no callLLM; context injected via variableValues) |
| Path 2 (one voice half, States 2/3) | Soniox seconds (State 3) + Cartesia Sonic characters (State 2) | Tokens via callLLM |
| Path 3 (text only, State 4) | none | Tokens via callLLM |

Implication: don't open Path 1 sessions speculatively. Don't call Path 2 TTS for fixed text that could be MP3. Don't call Path 3 LLM for taps that could just write to session_log.

## What goes where — quick reference

| Concept | Lives in |
|---|---|
| Path-specific composition + code | path-1-vapi / path-2-async / path-3-direct-llm |
| `screen_contexts` table + seeding | this file + `supabase/migrations/016_*.sql` + `scripts/voice-sync/seed_contexts.py` |
| `session_log` table + write API | this file + `supabase/migrations/016_*.sql` + (P1-32, not built) |
| `callLLM()` wrapper | this file (concept) + (P1-34, not built) |
| Tool → DB → Realtime → UI pattern | this file (pattern) + per-path skills (specifics) |
| Vapi vs Cartesia vocabulary | [glossary.md](glossary.md) |
| "Which path do I use?" | [paths.md](paths.md) |
