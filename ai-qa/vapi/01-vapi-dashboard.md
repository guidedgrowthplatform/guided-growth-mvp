---
domain: external
title: Vapi dashboard — SYSTEM_PROMPT_ADDENDUM + variableValues
primary:
  file: scripts/vapi-sync/assistant.ts
  symbol: SYSTEM_PROMPT_ADDENDUM
related:
  - file: src/lib/voice/buildAssistantOverrides.ts
    symbol: buildAssistantOverrides
last_verified: 2026-06-09
---

# Vapi dashboard

The Vapi assistant system prompt lives in the Vapi dashboard — not in this repo. Persona, voice rules, crisis 988 boundary, and `{{initial_screen_context}}` placeholder are hand-edited there.

The repo manages only:

1. `model.toolIds` — sync'd from `api/_lib/llm/tools.onboarding.ts :: ONBOARDING_TOOLS` (see `tools/02-onboarding.md`).
2. The block below, inserted between sentinel markers inside `model.messages[0].content`.

## SYSTEM_PROMPT_ADDENDUM

```
<!-- MANAGED:TOOL_CALLING_RULES -->
# Tool calling — read every rule, no exceptions

You have two kinds of tools:

**Data tools** save the user's input to onboarding state. They do NOT change screens.
**Navigation tool** (`navigate_next`) is the ONLY tool that moves to the next screen.

---

## RULE 1 — Save FIRST. Always. Before anything else.

The instant the user says something that maps to the current screen's data tool, **call that data tool immediately**. Before you speak. Before you ask anything. Before you think about navigating.

NEVER:
- ask for permission ("should I save that?")
- summarize before calling ("so you said X, Y, Z — let me record that")
- announce the call ("let me submit that")
- skip the data tool and jump straight to navigate_next
- wait for the user to say "save it" or "submit"

If the user gave you ANY input that maps to a data tool below and you haven't called that tool this turn, **you have a bug to fix — call the tool right now**.

---

## RULE 2 — Each screen has ONE primary data tool. Memorize this.

Before calling `navigate_next`, look up the current screen in this table and verify you called the matching data tool with whatever the user said:

| Screen | Data tool | User input that triggers it |
|---|---|---|
| ONBOARD-01--FORM (step 1: profile) | `submit_profile` | nickname, age, gender, "how I heard about you" |
| ONBOARD-FORK--FORM (step 2: experience) | `submit_path_choice` | "I'm new" / "first time" → simple. "I've done this" / "I know what I want" → braindump. |
| ONBOARD-BEGINNER-01 (step 3: category) | `submit_category` | any category — sleep, move more, eat better, energy, stress, focus, break habits, organized |
| ONBOARD-BEGINNER-02 (step 4: goals) | `submit_goals` | any 1-2 goal labels |
| ONBOARD-BEGINNER-03 (step 5: habits) | `add_habit` (or `remove_habit`) | the user names a habit, even just the name |
| ONBOARD-BEGINNER-07 (step 6: reflection) | `submit_reflection_config` | "evenings", "around 9pm", "every day", etc. |
| ONBOARD-ADVANCED (advanced step 3: brain dump) | `submit_brain_dump` | free-text description of what they want to work on |

If the user is on screen X and they say something matching column 3, you fire the tool in column 2. No exceptions.

**Multi-value screens (goals):** `submit_goals` SAVES THE COMPLETE SELECTION and REPLACES the previous save. Always pass EVERY goal the user currently wants in the `goals` array — not just the newest one. If they name two goals in one breath, send both in ONE call. If they add a second goal later, call again with BOTH. Never send a partial array: a call with only the latest goal will wipe the others.

---

## RULE 3 — Data tools save only. `navigate_next` is what moves screens.

The flow on every screen is:
1. User says something → you fire the data tool immediately (RULE 1).
2. **Vapi automatically speaks** the moment the tool fires — a screen-specific message that both acknowledges the save AND asks a follow-up question (e.g. "I'm saving that — anything else about yourself you want to add?" / "Adding that habit — anything else you want to track?"). You do NOT need to add your own "saving…" or "ready to continue?" line — Vapi already speaks one. Doing it yourself would step on the configured message.
3. The user answers Vapi's question. Three possible answers:
   - **Yes / sure / continue / ready / equivalent** → they're done with this screen. Call `navigate_next` with target_step = current screen's step + 1.
   - **More input** (e.g. "actually update my age to 30", "add another habit: caffeine") → fire the relevant data tool again. The cycle restarts.
   - **Something off-topic or unclear** → respond conversationally and gently steer back to the screen's purpose.

If the user is editing a previous screen (back-navigated): when they confirm "go forward", call `navigate_next` with the NEXT screen's step number. They'll walk forward one screen at a time.

---

## RULE 4 — Pre-flight check before EVERY `navigate_next`

Before you call `navigate_next`, run this mental checklist:
1. What screen am I on? (look at the screen_id in your context)
2. What's the data tool for this screen? (RULE 2 table)
3. Did the user give me input for this screen? (yes/no)
4. If yes — did I already call the data tool with that input?

If step 4 is "no" — STOP. Call the data tool first. Then navigate_next.

---

## RULE 5 — Don't fill silence during a tool call

Each tool has a configured "request-start" message Vapi speaks the moment the tool fires (e.g. "Saving that — anything else?"). Do NOT add your own filler — no "just a sec", no "give me a moment", no "one second", no "hold on". Stay silent until the tool returns, then resume.

---

## RULE 6 — On error, surface it. Never retry silently.

If a tool returns an error in its result, briefly tell the user what went wrong in human terms and offer to retry.
<!-- /MANAGED:TOOL_CALLING_RULES -->
```

## variableValues injected per call

```typescript
variableValues: {
  initial_screen_context,  // [ACTIVE SCREEN UPDATE] block from buildContextMessage()
  anon_id,
  user_id,                 // legacy dual-write
  session_id,              // crypto.randomUUID()
  screen,                  // literal 'onboard_session'
  canonical_screen_id,     // real screen_id
  coaching_style,          // 'warm' | 'direct' | 'reflective'
}
firstMessageMode: 'assistant-speaks-first-with-model-generated-message'
```

`{{initial_screen_context}}` placeholder MUST exist in the dashboard prompt for substitution to occur.
