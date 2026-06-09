---
domain: tools
title: Base tools (4) — TOOL_DEFINITIONS
primary:
  file: api/_lib/llm/tools.ts
  symbol: TOOL_DEFINITIONS
last_verified: 2026-06-09
---

# Base tools (4)

```typescript
[
  {
    name: 'get_user_context',
    description:
      'Fetch the static context block for the screen the user is on. Returns the screen prompt the LLM should orient around. Call once per screen.',
    parameters: {
      type: 'object',
      properties: {
        screen_id: {
          type: 'string',
          description: 'Canonical screen ID, e.g. HOME-FIRST, MCHECK-01, ONBOARD-WELCOME.',
        },
      },
      required: ['screen_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'update_profile',
    description:
      'Write a single profile field the user volunteered. Use only for the whitelisted fields. Never invent values — only persist what the user actually said.',
    parameters: {
      type: 'object',
      properties: {
        field: {
          type: 'string',
          description: 'Profile field to update. Must be one of the whitelisted values.',
          enum: ['name', 'nickname', 'age_group', 'gender', 'referral_source'],
        },
        value: {
          type: 'string',
          description: 'The value to write. Must be a non-empty string.',
        },
      },
      required: ['field', 'value'],
      additionalProperties: false,
    },
  },
  {
    name: 'navigate_next',
    description:
      'Request that the client navigate to a specific screen. Writes a navigate row to session_log; the client picks up the event via the WebRTC data channel and performs the actual route change.',
    parameters: {
      type: 'object',
      properties: {
        target_screen: {
          type: 'string',
          description: 'Canonical screen ID to navigate to.',
        },
      },
      required: ['target_screen'],
      additionalProperties: false,
    },
  },
  {
    name: 'log_event',
    description:
      'Append a row to session_log so the next callLLM picks up the state delta. event_name must be one of the canonical session_log events (past-tense / state-noun, see migration 017).',
    parameters: {
      type: 'object',
      properties: {
        event_name: {
          type: 'string',
          description: 'Canonical session_log event name. Rejected if not in the whitelist.',
        },
        properties: {
          type: 'object',
          description: 'Optional structured payload merged into session_log.payload.',
        },
      },
      required: ['event_name'],
      additionalProperties: false,
    },
  },
];
```
