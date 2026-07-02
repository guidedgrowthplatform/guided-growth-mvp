# Onboarding coach card-fill — QA walkthrough (2026-07-02)

Covers the human-only parts of Track 2 (coach fills every card) that automated tests can't reach:
live STT (Soniox), real LLM tool-selection, Supabase Realtime propagation, and audio. The
tool→mapping→fill→save chain and the server dispatch→write path are covered by automated tests
(`toolEventToVoiceActions.test.ts`, `useChatToolEvents.test.tsx`, `adapterVoiceFill.test.tsx`,
`dispatch.test.ts`, `beatContextsExport.test.ts`).

## Run locally

Two processes (the Vite proxy forwards `/api` → `vercel dev` on :3000):

```
npm run dev:api      # terminal A — vercel dev on :3000 (runs build:shared first)
npm run dev          # terminal B — vite on :5173
```

To arm the mic (voice-in) locally, set in `.env.local` (local only, do NOT commit; this flag is
Track 1's, flipped here only so the flow is walkable):

```
VITE_STATE3_ENABLED=true
```

## Reach a clean profile beat

1. Open `http://localhost:5173/onboarding/qa` (QA screen is on automatically under `vite dev`).
2. Pick a QA user (`qa-onboarding-*@guidedgrowth.test`, password `guided-growth-qa-2026`).
3. Click **Restart onboarding (fresh)** (wipes state via `/api/qa/self-reset`), then **Profile start**
   or **Mic + Profile**.

## What to verify per beat

Speak the answer; confirm the card fills, then `onboarding_states.data` holds it (Supabase).
The four beats below are the ones the mapping fix repaired — check them explicitly:

| Beat                                  | Say                                            | Card should fill            | data key                |
| ------------------------------------- | ---------------------------------------------- | --------------------------- | ----------------------- |
| Profile (ONBOARD-01--FORM)            | "I'm 30, male"                                 | age + gender, auto-advances | `age`, `gender`         |
| State check (ONBOARD-STATE-CHECK)     | "slept ok, mood good, energy high, low stress" | the four emoji rows         | `checkin`               |
| Morning setup (ONBOARD-MORNING-SETUP) | "8am every day"                                | schedule card               | morning check-in fields |
| Habit schedule (ONBOARD-BEGINNER-04)  | "move it to 7am weekdays"                      | schedule card               | `habitConfigs`          |
| Custom prompts (reflection)           | "ask me what went well and what drained me"    | prompt list                 | reflection prompts      |

Also verify the profile **without** a spoken nickname still saves and advances (name comes from auth,
not this beat) — this is the nickname-optional fix.

## Expected, not bugs

- **Dynamic coach replies are text-only.** On `/onboarding/flow` the coach's streamed answers are NOT
  spoken (`engineForTurn` returns `speakReplies:false`); only the per-beat opener is audible (MP3, or
  Cartesia for the name beat). Silence on a dynamic reply is by design, not a failure.
- **The coach never prints a literal `{name}`** — it substitutes the nickname (server `fillBeatName`).

## Coach prompt is now export-driven

The per-beat coach prompt (context + already-spoken opener + per-element ask order + allowedTools) now
comes from `api/_lib/llm/onboarding/flowBeatMeta.generated.json`, generated from the flow Export by
`npm run flow:sync`. Editing the flow builder Export + re-running `flow:sync` updates the coach with no
code change. To spot-check, log the assembled system prompt in dev and confirm it reflects the export's
lines (e.g. the state-check "Ask for each in order" block).
