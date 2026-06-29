# Vapi Onboarding Integration — Status Report (2026-06-27)

From: Yonas (engine/Vapi integration side). For: Yair + Yair's Claude.

---

## TL;DR

1. **Plumbing works end-to-end through habits.** Vapi drives `profile → fork → category → goals → habits` over one continuous voice session: it saves each beat's data, advances, and **accumulates prior-beat state** (on the fork it knows name/age/gender/path; on category it knows everything before). Bugs + rough edges remain, but the spine is real.
2. **The Beat Context system is only HALF-wired — this is the big one.** Your beat-context design (global + per-beat, Supabase-synced) is built and wired for **Direct-LLM (Path 3)**, but **Vapi (Path 1) does NOT use it.** Vapi reads a _separate_ context source with **no global context**. Details below — this is the thing to fix first.
3. **The Supabase→app sync has not been run** — so even Direct-LLM is using the hand-authored defaults in `beatContexts.ts`, not whatever you've edited in the Sheet/Supabase.

---

## The Beat Context system — what's actually wired

There are **two parallel context pipelines**, and they feed different engines:

|                               | Direct-LLM (Path 3: text / Soniox)                                                    | **Vapi (Path 1: full voice)**                                           |
| ----------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Per-beat context source       | `api/_lib/llm/onboarding/beatContexts.ts`                                             | `src/generated/screen_contexts.json` (bundle)                           |
| Authored in                   | **"Beat Context" tab** → Supabase `beat_contexts`                                     | **"Screens" tab** → Supabase `screen_contexts`                          |
| Sync script                   | `sync_beat_contexts.py` → `beatContexts.generated.json`                               | `seed_contexts.py` + bundle authoring                                   |
| **Global onboarding context** | ✅ `GLOBAL_ONBOARDING_CONTEXT` prepended every request (`buildSystemPrompt.ts:6,114`) | ❌ **none** — bundle has no global; Vapi relies on its dashboard prompt |
| Verbatim openers              | ✅                                                                                    | ✅ (`getOnboardingOpener`, instant-opener)                              |

**So your beat-context system (the "Beat Context" tab, global + per-beat) currently drives Direct-LLM only.** Vapi is still on the older "Screens"-tab bundle, which has no global layer.

Concretely, what the Vapi coach actually receives per beat:

- **Global/identity:** the Vapi **dashboard** system prompt (19,141 chars — "You are Yair, an AI habit coach…", tool-silence rules, RULE-2). This is **separately hand-maintained in the Vapi dashboard**, NOT your `GLOBAL_ONBOARDING_CONTEXT`. It does **not** contain the beat-context global cues (sequence-of-beats / Path 1-2-3 / cross-beat rules).
- **Per-beat:** the `{{initial_screen_context}}` placeholder, filled per call from `screen_contexts.json`.

### Two concrete issues this creates

- **Vapi never sees your `GLOBAL_ONBOARDING_CONTEXT`.** Whatever cross-beat rules you put in the onboarding global only reach Direct-LLM. For Vapi, those rules have to live in the dashboard prompt (a different file you maintain by hand) — so the two can silently diverge.
- **The sync hasn't run.** `beatContexts.generated.json` is empty (`global: null, beats: {}`), so `beatContexts.ts` is serving its **hand-authored defaults**. Your Sheet/Supabase beat edits are **not reaching the app** until `python sync_beat_contexts.py` runs (and even then, only Direct-LLM picks them up, not Vapi).

### Recommendation

Unify the two: make the **Vapi** path read from the same beat-context source as Direct-LLM (global + per-beat), so "the whole product built on beat context" actually drives voice too. This is engine work I can take — but I want your sign-off on collapsing the two sources, since it touches how your Sheet content reaches Vapi.

---

## Your specific questions, answered

- **Global context fed per beat?** Direct-LLM yes; **Vapi no** (see above). Your "feed the global every beat" intent is only realized on Path 3 today.
- **Verbatim vs generative?** The **opener** is verbatim by design — `beatContexts.ts` comment: "a verbatim string the coach renders word-for-word (it is the renderer, not the author)." Both paths render verbatim openers. The per-beat _behavior_ (what's generative) lives in each beat's context block. The verbatim/generative split exists; I have NOT yet audited every beat to confirm the right lines are locked vs free — flag if you want that audit.
- **Habit polarity (positive/negative)?** ✅ Implemented as `HabitType = 'binary_do' | 'binary_avoid'`. `add_habit` captures it (`tools.onboarding.ts:272` — "binary_avoid for NOT doing / quitting / reducing / avoiding; otherwise binary_do"). So polarity is wired into the habit capture.

---

## Chat rendering (your "previous beat disappears" observation)

The engine is **already designed as a continuous timeline, not a single swap.** `FlowRenderer.tsx:52` maps **every visited beat** (`state.visited.map(...)`) and renders a `BeatView` per node, with only the current one `active`. So "nothing disappears, it just continues" **is the intended architecture** — it's there.

So if a previous beat looks un-rendered when you scroll up, that's a **bug in how an inactive `BeatView` renders** (it should freeze the card/answer in scrollback), not a missing feature. I'll dig into `BeatView`'s inactive state next.

Your two forward ideas are good and engine-side (mine):

- **Pre-render the handful of beat components up front** for zero-latency reveal — feasible (few component types). A latency optimization for later.
- **Summary at the end = move all rendered cards into one organized list** — fits the timeline model; no re-render needed.

---

## Vapi transcription in the chat

Yes — `useRealtimeVoice` already exposes `onTranscript` (partial + final, user + assistant) and fans it into the chat overlay, and there's karaoke-style TTS sync. So the Vapi coach's spoken lines + the user's words **can** render as synced chat bubbles. If they're not showing reliably during voice, that's a wiring/timing bug to chase, not a missing capability.

---

## Working / Not working / Bugs

**Working**

- Vapi voice session stays live across `profile → fork → category → goals → habits` (one session; idle auto-pause was killing it — now configurable).
- Tool calls persist (`submit_*`), `navigate_next` advances, prior-beat state accumulates and is fed to the coach (filled-form snapshot + state delta).
- Habit polarity, verbatim openers, realtime form-fill via Supabase are wired.

**Not working / blocked (mostly beat-design, your side)**

- **Tail not integrated:** plan-review, morning, reflection, complete. Blockers: (a) **morning + complete have no Vapi context block** anywhere; (b) **plan-review is ordered mid-flow** but `confirm_plan` needs habits+reflection done, so it must be **last**; (c) the flow still has a leftover separate **habit-schedule (BEGINNER-04)** node though habits is one beat.
- **Vapi has no global onboarding context** (the headline above).
- **Reflection** content is schedule+mode in the engine, but your newer spec says **style choice** — bundle/adapter lagging your Sheet.

**Bugs / smells**

- Vapi dashboard prompt starts with a **duplicated** `{{initial_screen_context}} {{initial_screen_context}}`.
- Some bundle context blocks carry **stale `navigate_next(target_step=…)`** numbers (old step model).
- Beat-context **sync never run** → app on hand-authored defaults.

---

## What I need from you (so the tail + beat-context land)

1. **Beat order:** confirm the intended tail is `habits → morning → reflection → plan-review (final) → app`, and remove the leftover `BEGINNER-04` node in the flow builder.
2. **Morning + complete context blocks:** are they authored in the "Beat Context" tab? If yes I can pull + port them; if not, they're the one thing that needs you.
3. **OK to unify Vapi onto the beat-context source** (so Vapi gets global + per-beat from your Sheet, not the separate screens bundle)?

I'll keep integrating the engine side (the timeline-render bug, the Vapi/beat-context unification once you OK it) and update you in a couple hours.
