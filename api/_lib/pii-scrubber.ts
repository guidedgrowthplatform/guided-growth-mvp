/**
 * Strip likely PII from a transcript before sending it to OpenAI.
 *
 * Replaces email addresses, phone numbers, gender words, plausible ages,
 * and the proper noun immediately following a name-introduction phrase
 * ("my name is X", "I'm X", "call me X"). Conservative: avoids replacing
 * arbitrary capitalised words because the dataset includes habit names.
 */
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

  // Plausible ages (numbers between 1–120, optionally as a range)
  scrubbed = scrubbed.replace(
    /\b(?:([0-9]{1,3})(?:\s*(?:to|or|-)\s*[0-9]{1,3})?)\b(?!\s*[a-z])/gi,
    (match) => {
      const nums = match.match(/[0-9]{1,3}/g);
      if (nums && nums.every((n) => parseInt(n, 10) >= 1 && parseInt(n, 10) <= 120)) {
        return '[AGE]';
      }
      return match;
    },
  );

  // Names introduced explicitly: "my name is Sarah" → "my name is [NAME]"
  scrubbed = scrubbed.replace(
    /\b(?:my name is|i'm|i am|call me|name's|it's)\s+([A-Z][a-z]+)/gi,
    (match) => match.replace(/[A-Z][a-z]+$/, '[NAME]'),
  );

  return scrubbed;
}
