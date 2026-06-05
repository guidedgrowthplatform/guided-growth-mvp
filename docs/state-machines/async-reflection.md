# Async reflection (Path 2) state machine + data contract

Status: SETUP spec for #116 / #132. This is the Mint (frontend) to Yonas (backend) handoff
contract for the check-in / async-reflection feature. Written from the integration state as of
2026-06-05. MVP scope is core logging (habits, reflections persist across sessions). The full
Path-2 async voice reflection is the build that still backs onto this contract.

## What Path 2 is

Async reflection accepts a user's free-form input (voice or text), runs an LLM analysis in the
background, and returns coaching insights when ready. It is distinct from Path 1 (Vapi real-time
conversation) and from the structured daily check-in (sleep / mood / energy / stress sliders).

- Voice in: Soniox STT (locked voice stack), then text to the LLM.
- Voice out: Cartesia Sonic API direct, not Vapi (cheaper TTS for the personalized response).
- Text in: Direct LLM.

## State machine

```
        start()              (audio/text submitted)        (job result ready)
 idle  ────────►  recording  ──────────────────────►  processing  ──────────►  result
   ▲                  │  stop()                              │                    │
   │                  └──────────────────────────────────────┘                   │
   │                         (cancel / error returns to idle)                     │
   └──────────────────────────────────────────────────────────────────  done() ──┘
```

States:

| State | Meaning | Frontend shows | Backend |
|-------|---------|----------------|---------|
| `idle` | Nothing in flight | Prompt to start a check-in | none |
| `recording` | Capturing voice or accepting text | Mic / text input live | none yet |
| `processing` | Input submitted, async LLM job running | Spinner / "thinking" | job created, polling/SSE open |
| `result` | Insight (text + optional audio) ready | Coaching insight + replay | job complete |
| `error` | STT, LLM, or network failure | Retry affordance, transient | job failed, returns to `idle` |

Transitions are driven by the frontend hook; the backend owns only `processing -> result`
(job lifecycle). `error` is reachable from `recording` and `processing` and routes back to `idle`.

## Frontend hook contract (#132 `useAsyncReflection()`)

The hook returns:

```ts
{
  status: 'idle' | 'recording' | 'processing' | 'result' | 'error',
  result: { insight: string; audioUrl?: string } | null,
  start: () => void,        // idle -> recording
  stop: () => void,         // recording -> processing (submits, opens poll/SSE)
  submitText: (t: string) => void, // recording -> processing for text path
  reset: () => void,        // result/error -> idle
}
```

The hook replaces the P2-02 mock. It must read/write through the existing data service layer
(`getDataService()`), never a direct fetch, so mock mode (localStorage) and Supabase mode both
work. The completed reflection persists as a row keyed by `anon_id` (see below).

## Backend contract (#116)

New endpoint, not yet built:

- `POST /api/reflection` — accepts `multipart` audio OR `application/json` `{ text }`. Validates,
  resolves the user via `requireUser(req,res)` + `setUserContext(user.anonId)` (same auth pattern
  as `api/reflections/[...path].ts`), creates an async job, returns `{ jobId }` (202).
- `GET /api/reflection/:jobId` — poll. Returns `{ status, result }`. SSE is an optional upgrade.
- The async job uses the SHARED context builder (same shape as Path 1/3, P1-11 dep) so the insight
  references the user's habits + recent `session_log`.
- Response audio is generated via the existing `api/cartesia-tts.ts` path (Cartesia Sonic), not
  Vapi.

## anon_id data contract (the persistence boundary)

Everything is keyed by `anon_id`. The web/mobile anon_id contract is tracked separately in #89/#98
(board steps s2/s3 of this bucket). The backend resolves `anon_id` server-side from the auth token
(`requireUser` -> `user.anonId`); the client never trusts a client-supplied anon_id for writes.

What ALREADY persists across sessions today (real Supabase, verified in
`src/lib/services/supabase-data-service.ts`):

| Data | Table | Write path | Key |
|------|-------|-----------|-----|
| Daily check-in (sleep/mood/energy/stress) | `daily_checkins` | `saveCheckIn()` upsert on `(anon_id,date)` | anon_id, date |
| Reflections (structured) | `reflections` | `upsertReflectionsForDate()` | anon_id, date |
| Reflection config | `reflection_configs` | `upsertReflectionConfig()` | anon_id |
| Journal entries (freeform/template) | `journal_entries` + `journal_entry_fields` | `POST /api/reflections/journal` | anon_id |
| Habits + completions | `user_habits`, `habit_completions` | data service | anon_id |

What the Path-2 async reflection still needs to persist:

- The completed async reflection (input transcript + returned insight + optional audio url),
  proposed table `async_reflections` keyed by `(anon_id, created_at)`. To be confirmed with Mint
  before the build so the hook and the table agree.

## MVP scope note

Per the bucket step: MVP is core logging (habits, reflections), which already persists. The complex
safety rules (crisis handling, etc.) are deferred to phase two. The full Path-2 async voice
reflection (`POST /api/reflection` + `useAsyncReflection()` + Cartesia Sonic response) is labeled
`roadmap::phase::later` and is the next build once Mint confirms the frontend hook contract above.
