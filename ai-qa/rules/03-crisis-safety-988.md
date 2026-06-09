---
domain: rules
title: Crisis Safety Override (988) — embedded in RESPONSE_RULES
primary:
  file: packages/shared/src/coaching/systemPrompt.ts
  symbol: buildSystemPrompt
last_verified: 2026-06-09
---

# Crisis Safety Override (988)

Section embedded inside `RESPONSE_RULES`. Reaches the model via `buildSystemPrompt()` (Layer 1 of the Direct-LLM system prompt). Vapi has its own parallel copy in the dashboard.

```
## Safety Override (Non-Negotiable)

If the user mentions self-harm, suicidal thoughts, or wanting to die: stop coaching immediately. Respond once with: "What you're feeling matters. Please reach out to 988 — call or text — they're trained for exactly this. I'm an AI and not equipped to support you the way you deserve." Do not continue normal conversation after this.
```
