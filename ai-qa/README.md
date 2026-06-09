# ai-qa/

Every text the AI receives — grouped by domain. Frontmatter (metadata) + verbatim prompt text in code blocks.

```
ai-qa/
├── README.md
│
├── prompts/                     persona + styles + openers
│   ├── 01-persona-yair.md       CORE_IDENTITY + RESPONSE_RULES
│   ├── 02-coaching-styles.md    warm / direct / reflective
│   ├── 03-onboarding-openers.md ONBOARDING_OPENERS
│   ├── 04-opener-mode.md        OPENER_INSTRUCTIONS
│   └── 05-fallback-context.md   FALLBACK_CONTEXT_BLOCK
│
├── rules/                       guardrails injected into the system prompt
│   ├── 01-no-prenarration.md
│   ├── 02-strip-forward-pointers.md
│   ├── 03-crisis-safety-988.md
│   ├── 04-pii-scrubbing.md
│   ├── 05-already-filled-block.md
│   └── 06-canonical-options.md
│
├── tools/                       tool definitions + addenda
│   ├── 01-base.md               4 base tools (TOOL_DEFINITIONS)
│   ├── 02-onboarding.md         12 Vapi + 13 Direct-LLM onboarding tools + ONBOARDING_TOOL_ADDENDUM
│   └── 03-checkin.md            13 check-in tools + CHECKIN_TOOL_ADDENDUM
│
├── screens/                     verbatim context_block per screen (32 screens)
│   ├── pre-onboarding.md        SPLASH · WELCOME · AUTH-SIGNUP · VOICE-PREFERENCE · MIC-PERMISSION
│   ├── onboarding.md            17 ONBOARD-* screens
│   ├── home.md                  HOME-RETURN · HOME-MORNING-CHECKIN-EXPANDED
│   ├── checkins-morning.md      MCHECK-01 · MCHECK-02
│   └── checkins-evening.md      ECHECK-01..06
│
└── vapi/
    └── 01-vapi-dashboard.md     SYSTEM_PROMPT_ADDENDUM + variableValues
```

## Frontmatter

```yaml
---
domain: prompts | rules | tools | screens | vapi
title: <short>
primary:
  file: <repo-relative path>
  symbol: <symbol or "(internal const)" / "(JSON bundle)" / etc>
related:
  - file: ...
    symbol: ...
last_verified: YYYY-MM-DD
---
```

## Verify

`scripts/ai-qa-verify.ts` asserts every `primary.file` + `related[].file` exists and that each `symbol` appears in the file. Warns when `last_verified` is older than 60 days.

```
npx tsx scripts/ai-qa-verify.ts
```
