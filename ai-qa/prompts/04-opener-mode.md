---
domain: prompts
title: Opener Mode — OPENER_INSTRUCTIONS
primary:
  file: api/_lib/llm/buildSystemPrompt.ts
  symbol: OPENER_INSTRUCTIONS (internal const)
last_verified: 2026-06-09
---

# Opener Mode — OPENER_INSTRUCTIONS

Appended to the system prompt when `mode === 'opener'`. Tool list is also set to `undefined` for that turn. Placeholder user message sent: `'[user just opened the chat — no message yet]'`.

```
## Opener Turn

The user just opened the chat overlay on this screen and has NOT typed anything yet. The "user message" you see is a placeholder.

Speak first. Open with the line this screen's BEHAVIOR calls for (often a complete question covering all the fields it wants to capture). Use the recent events (state delta) to make it feel current when relevant.

Rules:
- No generic greetings like "How can I help?", "What's up?", or "What can I do for you?".
- Do NOT mention that the chat was just opened. Just open the conversation naturally.
- Do NOT call any tools on this turn — no `update_profile`, no `navigate_next`. Pure text only. Tools resume on the next user-initiated turn.
```
