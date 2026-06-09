---
domain: rules
title: Canonical Options block (3 onboarding screens)
primary:
  file: api/_lib/llm/onboarding/canonicalOptions.ts
  symbol: buildCanonicalOptionsBlock
last_verified: 2026-06-09
---

# Canonical Options block

Layer 5 of the Direct-LLM system prompt. Fires on `ONBOARD-01--FORM`, `ONBOARD-BEGINNER-02`, `ONBOARD-BEGINNER-03`. Returns `''` for everything else.

## ONBOARD-01--FORM injects

```
## Profile Fields
Collect ALL four: nickname, age, gender (Male | Female | Other), referral source.
Call submit_profile as fields come in — always include the nickname plus every field gathered so far (it requires the nickname each call).
Do NOT call confirm_step_complete (do not advance) until all four are provided.
```

## ONBOARD-BEGINNER-02 injects

```
## Goal Options[ (category: <CATEGORY>)]
Offer ONLY these goals, verbatim — never invent, rename, or paraphrase. Save using these exact labels.
- <category>: <goal[1]> | <goal[2]> | <goal[3]> | ...
```

(`<category>` and the goal list pulled from `packages/shared/src/data/onboardingGoals.ts :: goalsByCategory`. If no category set yet, lists ALL categories.)

## ONBOARD-BEGINNER-03 injects

```
## Habit Options by Goal
Suggest habits ONLY from this list, verbatim, for the user's goal(s). Do not invent or rename them.
- <goal[1]>: <habit[1]> | <habit[2]> | ...
- <goal[2]>: <habit[1]> | <habit[2]> | ...
```

(Goal/habit map pulled from `packages/shared/src/data/onboardingHabits.ts :: habitsByGoal`. Empty if no goals + no category set.)
