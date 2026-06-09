---
domain: rules
title: Already-Filled Fields block (onboarding only)
primary:
  file: api/_lib/llm/buildSystemPrompt.ts
  symbol: buildAlreadyFilledBlock (internal function)
last_verified: 2026-06-09
---

# Already-Filled Fields block

Layer 4 of the Direct-LLM system prompt. Fires only on `ONBOARD-*` screens when `onboarding_states` has a row with data or a path.

## Function

```typescript
function buildAlreadyFilledBlock(row: OnboardingRow): string {
  const data = row.data ?? {};
  const hasData = Object.keys(data).length > 0;
  if (!hasData && !row.path) return '';
  return (
    `\n\n## Already-Filled Fields\n` +
    `current_step: ${row.current_step}\n` +
    (row.path ? `path: ${row.path}\n` : '') +
    `data: ${JSON.stringify(data)}\n` +
    `Do NOT re-ask for any field that already has a value here. Acknowledge briefly if the user re-states it, then move to the next still-missing field per the screen's BEHAVIOR.`
  );
}
```

## Example output

```
## Already-Filled Fields
current_step: 3
path: simple
data: {"nickname":"Jonas","age":"32","gender":"Male","referralSource":"Friend"}
Do NOT re-ask for any field that already has a value here. Acknowledge briefly if the user re-states it, then move to the next still-missing field per the screen's BEHAVIOR.
```
