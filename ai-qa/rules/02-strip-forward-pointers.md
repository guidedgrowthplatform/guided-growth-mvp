---
domain: rules
title: stripForwardPointers (transformation applied to context_block)
primary:
  file: api/_lib/llm/stripForwardPointers.ts
  symbol: stripForwardPointers
last_verified: 2026-06-09
---

# stripForwardPointers

Applied to `context_block` before it's injected into the Direct-LLM system prompt (Path 2 + 3). NOT applied to Vapi. Strips navigation pointers + truncates everything after the first `--- SUPPLEMENTARY ---` / `CRISIS BOUNDARY:` boundary.

```typescript
const SCREEN_ID = String.raw`[A-Z][A-Z0-9]+(?:-[A-Z0-9]+)+`;

const SECTION_BOUNDARY = new RegExp(
  String.raw`^\s*(?:---\s*SUPPLEMENTARY\s*---|CRISIS BOUNDARY:.*)`,
  'm',
);

const NEXT_LINE = /^[ \t]*NEXT:.*$/gm;
const ARROW_POINTER = new RegExp(String.raw`\s*(?:->|→)\s*${SCREEN_ID}`, 'g');
const ARROW_PATH = /\s*(?:->|→)\s*(?:beginner|advanced)\s+path\b/gi;
const PARENTHETICAL = new RegExp(String.raw`\s*\(${SCREEN_ID}\)`, 'g');
const NAVIGATE_TO = new RegExp(String.raw`\bnavigate to\s+${SCREEN_ID}`, 'gi');
const ROUTE_TO = new RegExp(String.raw`\broute to\s+(?:${SCREEN_ID}|beginner|advanced)\b`, 'gi');
const ROUTE_BASED = /\bRoute based on (?:the )?answer:?/gi;

export function stripForwardPointers(contextBlock: string): string {
  // 1. truncate at SECTION_BOUNDARY (everything below is dropped)
  // 2. on the head: drop NEXT_LINE, ARROW_POINTER, ARROW_PATH, PARENTHETICAL, ROUTE_BASED
  // 3. replace NAVIGATE_TO and ROUTE_TO with 'continue'
  // 4. trim trailing whitespace, collapse 3+ newlines to 2
}
```
