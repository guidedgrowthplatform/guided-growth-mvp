---
domain: prompts
title: Fallback Context Block — FALLBACK_CONTEXT_BLOCK
primary:
  file: api/_lib/llm/buildSystemPrompt.ts
  symbol: FALLBACK_CONTEXT_BLOCK (internal const)
last_verified: 2026-06-09
---

# Fallback Context Block

Used as `context_block` when the `screen_contexts` row for the requested `screen_id` is missing. Version hardcoded to 0.

```
## Screen
No screen-specific guidance is configured for this screen. Respond helpfully and briefly in your coaching voice, using the recent activity below for continuity. Do not invent screen-specific instructions or pre-announce features.
```
