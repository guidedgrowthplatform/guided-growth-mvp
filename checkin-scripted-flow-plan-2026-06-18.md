# Scripted Check-in Flow — Implementation Plan

_Date: 2026-06-18 · Owner: Yonas · Spec decided on the 2026-06-17 call._

**Spec sources (gg-spec/main):**

- `docs/morning-evening-checkin-flow.md` — the structured A→B→C flow
- `docs/checkin-tts-variations.md` — the scripted line library (draft, Yair-owned)

## 0. The principle

The check-in becomes a **deterministic, scripted ritual**, not an LLM chat:

- **What to say** = pre-written lines, one variation picked at random per stage. The LLM never writes the wording.
- **How to say it** = the only Path 2 vs Path 3 difference. **Path 2 (voice)** speaks the line via Cartesia; **Path 3 (text)** renders the same line as a coach bubble.
- **Understanding the user** = the LLM's only remaining job — parse a free-form answer ("slept great, ran today") into our existing tools. Tap input needs no LLM at all.

~90% additive. The driver + script library sit **in front of** what we built; the cards, capture, done-detection, and reflection storage survive; the LLM slides **behind** as a parser.

## 1. Target architecture

```
        ┌──────────────────────────────────────────────┐
        │  useCheckinFlow  (NET-NEW client stage machine)│
        │  deterministic morning / evening A→B→C         │
        └───────────────┬──────────────────────────────┘
        emits {stage, scriptedLine, card, expectsInput}
        ┌───────────────┼───────────────────────────────┐
        ▼               ▼                                ▼
  SCRIPT LIBRARY   RENDER P2 (voice)            RENDER P3 (text)
  (NET-NEW data)   speak(line)                  inject ai bubble
  pickVariation    tts-service.ts:534           useCoachChat messages memo
        │               ▲                                ▲
        └────────── CARD (reused: CheckInCard / HabitReportCard)
                        │  tap → save (no LLM)
                        ▼
              USER ANSWER (tap OR free speech/text)
                        │ free text/speech only
                        ▼
              LLM-as-PARSER (existing /api/llm, TEXT IGNORED)
              uses only tool_call events →
              record_checkin · complete_habit · log_reflection
```

## 2. Stage definitions

### Morning (entry: MCHECK-01, window <16:00)

| #   | Stage                           | Scripted key                                | Card                                    | Advance condition                                                 |
| --- | ------------------------------- | ------------------------------------------- | --------------------------------------- | ----------------------------------------------------------------- |
| 1   | GREETING + STATE PROMPT         | `morning_greeting` + `morning_state_prompt` | 4-scale card (sleep/mood/energy/stress) | line spoken/shown                                                 |
| 2   | STATE CAPTURE                   | —                                           | card stays up                           | all 4 answered → skip to WRAP; partial + user-done → ARE YOU DONE |
| 3   | ARE YOU DONE? (only if partial) | `are_you_done`                              | card stays up                           | user adds rest, or says done                                      |
| 4   | WRAP                            | `morning_wrap`\*                            | —                                       | end (doneToday already true via daily_checkins)                   |

\* `morning_wrap` variations not yet in the draft — flag to Yair.

### Evening (entry: ECHECK-01, window ≥17:00)

| #   | Stage                           | Scripted key                                                                                            | Card                 | Advance condition                                            |
| --- | ------------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------ |
| 1   | GREETING + HABITS               | `evening_greeting_habits` + `evening_habit_prompt`                                                      | habit list (3-state) | line spoken/shown                                            |
| 2   | HABIT REVIEW                    | —                                                                                                       | list stays up        | all habits non-pending → skip; partial + done → ARE YOU DONE |
| 3   | ARE YOU DONE? (only if partial) | `are_you_done`                                                                                          | list stays up        | user adds rest / says done                                   |
| 4   | REFLECTION                      | `reflection_transition`, then `reflection_proud` → `reflection_forgive` → `reflection_grateful` (fixed) | —                    | one answer each → `log_reflection`                           |
| 5   | WRAP                            | `evening_wrap`                                                                                          | —                    | end                                                          |

Optional `acknowledgments` lines between steps.

## 3. New modules (the actual build)

| Module             | File (new)                                         | Responsibility                                                                                                           |
| ------------------ | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Script library     | `src/lib/checkin/scriptLibrary.ts`                 | The stages × variations data (from the gg-spec doc) + `pickVariation(stageKey, seed)` random-per-day                     |
| Stage machine      | `src/hooks/useCheckinFlow.ts`                      | Deterministic morning/evening sequences, advance logic, the are-you-done gate; consumes `useCheckinEntry` as entry guard |
| Completion signals | edits to `CheckInCard.tsx` + `HabitReportCard.tsx` | Expose "which of the 4 / which habits still unanswered" upward (the gate needs it)                                       |
| P3 injection seam  | edit `useCoachChat.ts`                             | Scripted-turns array merged into the `messages` useMemo (mirrors `errorBubbles`, but ordered inline)                     |
| P2 rendering       | edit `useCoachChat.ts`                             | Replace `void sendOpener()` (L376 / L396) with `speak(line)` per stage                                                   |
| Fixed reflection   | edits to prompts + drive 3 prompts                 | Retire configurable reflection for the check-in                                                                          |

## 4. Reused — do NOT rebuild (verified in main repo)

- **4-scale morning card** `CheckInCard.tsx` — visual stays up (local `values`, CSS-collapsed), saves via `useCheckIn`. Embedded mode already inline at `CoachChatView.tsx:256`.
- **Habit 3-state** — `HabitDayStatus = 'pending'|'done'|'missed'` already exists (`packages/shared/src/types/index.ts:38`); green check / red X built (`HabitListItem.tsx:147`). **No gap.**
- **Fixed reflection prompts already exist** — `DEFAULT_REFLECTION_PROMPTS` = proud/forgive/grateful (`packages/shared/src/types/index.ts:125`).
- **Reflection capture** — `log_reflection` → journal entry (`handlers/logReflection.ts`); call 3×.
- **Routing / entry / done-detection** — `useCheckinEntry` / `resolveCheckinWindow` / once-per-day gating / data-derived `doneToday`. Reusable as the stage-machine entry guard.
- **TTS standalone** — `speak(text)` (`tts-service.ts:534`) flips the orb to speaking with no LLM. Turn-taking exists: `TURN_AGGREGATION_MS=1000`, `VAD_SILENCE_CLOSE_MS=2500`, barge-in via `interruptTts`.

## 5. Decisions (resolved — recommended defaults)

1. **LLM-as-parser** → reuse the existing `/api/llm` chat call but use only its `tool_call` events; ignore its text. Least change, no new endpoint.
2. **Stage-machine home** → a new `useCheckinFlow` hook that consumes `useCoachChat`, not folded into it. Keeps the conversational hook intact for non-check-in chat.
3. **Tap-only path** → driver advances on card-completion events; the LLM is not called at all when the user only taps.
4. **Rollout** → **feature-flag** scripted-mode alongside the current LLM-improvised flow. Flip per-environment; don't delete the old path until scripted is validated.
5. **Backend prompts** → leave `CHECKIN_WALKTHROUGH` / `*_OPENER` / `OPENER_INSTRUCTIONS` **dormant behind the flag**; in scripted mode the opener LLM call is dropped entirely (client renders the card + posts the scripted line).
6. **"Done" intent** (open) → how do we detect the user saying "I'm done" at the gate? Options: (a) client keyword match, (b) a tiny `advance_checkin` tool, (c) LLM parse hint. **Lean (a)** for MVP; revisit.

## 6. Phased work-items (each independently shippable)

- **P0 — Script library + picker.** `scriptLibrary.ts` + `pickVariation`. Pure data/util. Unit-tested (random-per-day determinism via seeded date). Zero runtime risk.
- **P1 — Stage machine (text path first).** `useCheckinFlow.ts` driving the **text** path: inject scripted bubbles, render the existing cards, advance on capture. Behind the flag. Proves the deterministic flow in chat without touching voice.
- **P2 — Voice rendering.** Wire `speak(line)` per stage; tune the ~2s pause + barge-in. Same driver, voice renderer.
- **P3 — "Are you done?" gate.** Add the per-item unanswered signal to both cards; wire the partial-set gate.
- **P4 — Fixed reflection ritual.** Drive proud→forgive→grateful as scripted lines; each answer → `log_reflection`. Retire configurable reflection in the check-in path.
- **P5 — LLM cleanup.** In scripted mode: drop the opener LLM call, prune improvisation from `CHECKIN_TOOL_ADDENDUM` (keep intent→tool mapping), drop `suggest_habit`/`get_summary`/`update_reflection`/`start_focus` from the check-in tool set.

Sequence: P0 → P1 → P2/P3 (parallel) → P4 → P5. Each behind the flag until P1–P4 land.

## 7. LLM layer — keep vs cut (scripted mode)

**Keep (parser):** `record_checkin`, `complete_habit`, `log_reflection`, `query_checkin`, `query_habits`; the intent→tool mapping + polarity + exact-words + error-recovery rules in `CHECKIN_TOOL_ADDENDUM`.

**Cut (improvisation):** `CHECKIN_WALKTHROUGH`, `CHECKIN_MORNING_OPENER`, `CHECKIN_EVENING_OPENER`, `OPENER_INSTRUCTIONS`, the "warm line" / brevity prose; tools `suggest_habit`, `get_summary`, `update_reflection`, `start_focus`. Replace `buildReflectionSettingsBlock` per-user logic with the fixed three prompts.

## 8. Test strategy

- **Unit:** `pickVariation` (deterministic per day, covers all stages); `useCheckinFlow` transition table (morning/evening, gate fires only on partial); reflection sequence (3 prompts → 3 `log_reflection`).
- **Integration (text):** open MCHECK-01 → greeting+card → tap all 4 → wrap, no LLM call; partial → are-you-done. Evening: habits → reflection ×3 → wrap.
- **Voice:** scripted line speaks via `speak()`; barge-in interrupts; pause timing.
- **Regression:** non-check-in coach chat (HOME-CHECKIN plain chat) untouched; once-per-day gating + data-derived doneToday still hold.

## 9. Risks / don't-break

- **Two paths share one driver** — keep the driver renderer-agnostic; a stage emits data, renderers subscribe. Don't branch flow logic per path.
- **Tap vs speech race** — card tap and a parsed tool result both update completion; make completion idempotent (keyed by dimension/habit id).
- **Flag hygiene** — every scripted-mode branch behind one flag; old LLM flow stays runnable until validated.
- **Reflection retirement** — `update_reflection` removal is scoped to the check-in path; the settings screen (if any) may still use it — verify before deleting the tool outright.

## 10. Open product questions (for Yair)

- `morning_wrap` variations are missing from the draft — needed for stage 4.
- Push notifications (the spec's entry trigger) are out of our current scope — confirm they're a separate work item.
- Hebrew/English: TTS keeps language swappable, but the script library needs both locales eventually — MVP = English only?
- Daily goals + Vapi live-coach + dynamic silence timing are explicitly roadmap (phase 2) — not in this plan.
