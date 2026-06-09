---
domain: prompts
title: Onboarding Openers (deterministic per-screen first bubbles)
primary:
  file: src/components/onboarding/onboardingOpeners.ts
  symbol: ONBOARDING_OPENERS
last_verified: 2026-06-09
---

# Onboarding Openers

First assistant-bubble text seeded client-side on Path 3 onboarding screens. Not used by Vapi.

## ONBOARDING_OPENERS

```typescript
{
  'ONBOARD-01':
    'OK, let me get to know you a little. First — what should I call you? You can type it here, or fill it in on screen.',

  'ONBOARD-01--FORM':
    'OK, let me get to know you a little. First — what should I call you? You can type it here, or fill it in on screen.',

  'ONBOARD-FORK':
    'Quick question — have you tracked habits before, or is this new for you? Either way is great. I just want to know the best way to guide you.',

  'ONBOARD-FORK--FORM':
    'Quick question — have you tracked habits before, or is this new for you? Either way is great. I just want to know the best way to guide you.',

  'ONBOARD-BEGINNER-01':
    "So — what feels most worth improving right now? Don't overthink it. There's no wrong answer. Pick the one that pulls you. You can always add more later.",

  'ONBOARD-BEGINNER-02':
    "OK — within that, what's the specific thing you want to work on? Pick the one that hits hardest.",

  'ONBOARD-BEGINNER-03':
    "Here are a few habits that really help with this. Pick what feels doable. Not heroic. Not impressive. Doable. Because one habit done consistently beats five that don't stick. You can also create your own if none of these fit.",

  'ONBOARD-ADVANCED':
    "Tell me everything you want to achieve — say or type as much as you want, and I'll organize it into habits for you.",

  'ONBOARD-BEGINNER-07':
    "One last thing — let's set up a short evening reflection. I can ask you a few simple questions each evening, or you can free-write. Which sounds better? You can change it anytime.",

  'ONBOARD-BEGINNER-06':
    "Here's your starting plan. Take a look — does it all look right, or want to change anything before we start?",

  'ONBOARD-ADVANCED-04':
    "Let's set up your evening reflection — I can ask you a few questions each evening, or you can free-write. Which feels better?",

  'ONBOARD-ADVANCED-05':
    "Here's what I put together from everything you shared. Want to start with this, or tweak anything first?",

  'ONBOARD-ADV-CUSTOM':
    "What would you like me to ask you each evening? Give me up to three prompts and I'll use those.",

  'ONBOARD-ADVANCED-02':
    'Here are the habits I pulled from what you shared. Take a look — keep them as they are, or want to change anything?',
}
```

## Revisit opener templates

Single-field screens (FORK / BEGINNER-01) return tailored copy. Multi-field screens (ONBOARD-01 / ONBOARD-01--FORM) compose from `STEP_FIELDS`:

```
// all fields filled:
`Last time you told me ${summary}. Want to keep that and move on, or change something?`

// some missing:
`Last time you told me ${summary}. I still need ${humanJoin(missing)} — want to fill that in?`
```

Where `summary` = `humanJoin([...field recaps])` and field recaps for ONBOARD-01:

```
- nickname → "your name's ${nickname}"
- age      → "you're ${age}"
- gender   → "${gender}"
- referral → "found us via ${referralSource}"
```
