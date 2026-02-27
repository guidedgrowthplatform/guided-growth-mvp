# Voice Command Processor — System Design

## Overview

The voice command processor takes natural language transcripts from the voice input and produces structured JSON intents using GPT-4o-mini. It is stateless — no conversation memory.

## Architecture

```
User speaks → STT (Web Speech API) → transcript → processCommand() → GPT-4o-mini → structured JSON
```

## Module: `processCommand(transcript: string)`

**Location:** `src/lib/processCommand.ts`

**Input:** Raw transcript string from speech-to-text  
**Output:** `ProcessCommandResult` with action, entity, params, confidence, and latency

### Response Schema

```json
{
  "action": "create | complete | update | delete | query | reflect",
  "entity": "task | habit | journal | mood | sleep | goal",
  "params": {
    "title": "string",
    "dueDate": "YYYY-MM-DD",
    "value": 8,
    "tags": ["tag1"],
    "priority": "low | medium | high"
  },
  "confidence": 0.95,
  "rawResponse": "original GPT output"
}
```

## System Prompt

**Location:** `src/lib/systemPrompt.ts`

The system prompt instructs GPT-4o-mini to:
1. Identify the **action** (create, complete, update, delete, query, reflect)
2. Identify the **entity** (task, habit, journal, mood, sleep, goal)
3. Extract **parameters** (title, dates, values, tags, priority)
4. Return a **confidence** score (0.0 to 1.0)
5. Handle edge cases: gibberish → `"unknown"` action/entity with error message

### Key Design Decisions
- `response_format: { type: 'json_object' }` guarantees valid JSON output
- `temperature: 0.1` for consistent, deterministic results
- `max_tokens: 300` keeps responses fast and focused
- 5 input/output examples in the prompt for few-shot learning
- Focus on **primary intent** for multi-step requests

## API Route

**Endpoint:** `POST /api/process-command`  
**Body:** `{ "transcript": "..." }`  
**Response:** `ProcessCommandResult`

## Test Page

**URL:** `/command-test`

Features:
- Custom input field for ad-hoc testing
- 25 pre-defined test transcripts across all categories
- "Run All" batch execution
- Summary stats (action accuracy, entity accuracy, avg latency)
- JSON export

## Environment

```bash
OPENAI_API_KEY=sk-...  # Required
```

## Cost Estimate

GPT-4o-mini pricing: $0.15/1M input tokens, $0.60/1M output tokens.

Average command: ~200 input tokens (system prompt + transcript), ~50 output tokens (JSON response).

**Cost per command:** ~$0.00006 (< $0.01 per 100 commands)
