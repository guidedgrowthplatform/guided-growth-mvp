---
domain: contexts
title: Home screens (HOME-*)
primary:
  file: src/generated/screen_contexts.json
  symbol: (JSON bundle)
related:
  - file: api/_lib/llm/buildSystemPrompt.ts
    symbol: buildSystemPromptForRequest
  - file: api/_lib/llm/stripForwardPointers.ts
    symbol: stripForwardPointers
last_verified: 2026-06-09
---

# Home screens (HOME-\*)

Verbatim `context_block` text for each screen in this group — the **exact text the AI sees** as Layer 7 (ACTIVE SCREEN UPDATE) of its system prompt for Direct-LLM paths (after `stripForwardPointers` strips the `--- SUPPLEMENTARY ---` tail and forward pointers).

Vapi (Path 1) receives the **raw, unstripped** version of each block — including everything after `--- SUPPLEMENTARY ---`.

Source: `src/generated/screen_contexts.json` (bundle version 2026-05-20). Master Sheet → Supabase → bundle (byte-identical).

---

## HOME-RETURN

**Screen name:** Home Return After 3+ Days · **Route:** `/` · **Bytes:** 1175

```
SCREEN_ID: HOME-RETURN
SCREEN_NAME: Home Return After 3+ Days
ROUTE: /home

SCREEN: Home (returning after 3+ days)
STATE: User hasn't opened the app in 3+ days.
BEHAVIOR: Vapi agent auto-plays a short welcome back. 'No judgment - life happens.' If 7+ days: 'Everything's here just like you left it.'
DO NOT: Guilt. Ask why they were gone. Show stats about what they missed.

--- SUPPLEMENTARY ---

VOICE INSTRUCTIONS:
[Vapi agent auto-plays on first open after 3+ days of inactivity, live TTS]

EXPECTED USER RESPONSE:
Voice: 'Yeah' / 'Let's go'
Silence/tap: User just starts using the app

AI RESPONSE PATTERN:
If yes: 'Good to have you back. Your habits are right here. Let's start fresh today.'
If they just start tapping: no follow-up needed

SYSTEM ACTION:
1. Check last_active_date
2. If gap >= 3 days: connect to Vapi and play return greeting
3. Reset any stale daily data
4. Set returning_user flag for PostHog
5. Log: user_return {days_inactive}

EDGE CASES:
Don't guilt. Don't ask why they were gone. Just welcome back.
If gap is 7+ days: 'Hey [Name]. Welcome back. Everything's here just like you left it. Whenever you're ready.'

NOTES:
No judgment. Life happens.
```

---

## HOME-MORNING-CHECKIN-EXPANDED

**Screen name:** Home Morning Check-in Expanded · **Route:** `/` · **Bytes:** 1202 · `source: spec-packet`

```
SCREEN_ID: HOME-MORNING-CHECKIN-EXPANDED
SCREEN_NAME: Home Morning Check-in Expanded
ROUTE: /

SCREEN: Inline expanded morning check-in card on the Home layout. Same data capture as MCHECK-01 but VAPI-orchestrated (the spec'd exception to Path 2).
STATE: User tapped the Mood Card on HOME-MORNING. The four scales are rendered inline over the home grid.
BEHAVIOR: Vapi live two-way loop — agent asks, user responds by voice or by tapping scales. Tool calls batch and fire at end-of-screen on next-screen-navigation per global-ux-rules.md Section 5.
TOOLS: Same as MCHECK-01 — record_checkin, plus query_habits for context.
DO NOT: Re-ask dimensions already filled by tap. Block on missing fields. Extend the interaction beyond the 2-3 sentence response cap.
NEXT: Submit → save check-in → collapse to HOME-DEFAULT. lucide:plus → HABIT-CREATE-FORK.

--- SUPPLEMENTARY ---

NOTES:
This is the only check-in surface that uses Vapi (State 1). All MCHECK/ECHECK screens are async (Path 2). HOME-MORNING-CHECKIN-EXPANDED is rendered as an overlay over Home — not routed independently. Not implemented in the current iteration; included so the LLM has the same tool-set when this surface is built.
```

---
