---
domain: rules
title: scrubPII — applied to user_message before /api/llm reaches OpenAI
primary:
  file: api/_lib/pii-scrubber.ts
  symbol: scrubPII
last_verified: 2026-06-09
---

# scrubPII

Skipped on `screenId.startsWith('ONBOARD-')`. Applied on all other screens before user_message reaches the LLM.

```typescript
export function scrubPII(text: string): string {
  let scrubbed = text;

  // Email addresses
  scrubbed = scrubbed.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]');

  // Phone numbers
  scrubbed = scrubbed.replace(
    /(?:\+?1[-.\s]?)?(?:\(?[0-9]{3}\)?[-.\s]?)?[0-9]{3}[-.\s]?[0-9]{4}/g,
    '[PHONE]',
  );

  // Gender words
  scrubbed = scrubbed.replace(
    /\b(male|female|man|woman|boy|girl|non-binary|nonbinary|gender-neutral|genderqueer|agender)\b/gi,
    '[GENDER]',
  );

  // Plausible ages — scrub only when an age-context word is adjacent.
  const AGE_BEFORE =
    /\b(?:age(?:d)?|i'?m|i am|born(?:\s+in)?)\s+([0-9]{1,3})(?:\s*(?:to|or|-)\s*([0-9]{1,3}))?\b/gi;
  const AGE_AFTER =
    /\b([0-9]{1,3})(?:\s*(?:to|or|-)\s*([0-9]{1,3}))?\s+(?:years?(?:\s+old)?|yrs?(?:\s+old)?|yo|y\/o|y\.?o\.?|years?\s+of\s+age)\b/gi;
  const replaceAges = (match: string, n1?: string, n2?: string): string => {
    const ages = [n1, n2].filter((n): n is string => !!n);
    if (ages.every((n) => parseInt(n, 10) >= 1 && parseInt(n, 10) <= 120)) {
      return match.replace(/\d{1,3}/g, '[AGE]');
    }
    return match;
  };
  scrubbed = scrubbed.replace(AGE_BEFORE, replaceAges);
  scrubbed = scrubbed.replace(AGE_AFTER, replaceAges);

  // Names introduced explicitly: "my name is Sarah" → "my name is [NAME]"
  scrubbed = scrubbed.replace(
    /\b(?:my name is|i'm|i am|call me|name's|it's)\s+([A-Z][a-z]+)/gi,
    (match) => match.replace(/[A-Z][a-z]+$/, '[NAME]'),
  );

  return scrubbed;
}
```
