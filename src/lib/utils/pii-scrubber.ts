/**
 * PII Scrubber
 * Detects and replaces personally identifiable information in text before it's sent to external APIs.
 * This ensures that sensitive data like names, ages, and contact info never reach OpenAI or other third parties.
 */

/**
 * Scrub personally identifiable information from a transcript.
 * Replaces detected PII with generic tokens: [NAME], [AGE], [GENDER], [EMAIL], [PHONE]
 * Preserves the overall structure and meaning so NLP models can still understand intent.
 *
 * @param text - The raw transcript text
 * @returns Scrubbed text with PII replaced by tokens
 */
export function scrubPII(text: string): string {
  let scrubbed = text;

  // Replace email addresses
  scrubbed = scrubbed.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]');

  // Replace phone numbers (multiple formats)
  // Handles: (123) 456-7890, 123-456-7890, 123.456.7890, +1 123 456 7890, etc.
  scrubbed = scrubbed.replace(
    /(?:\+?1[-.\s]?)?(?:\(?[0-9]{3}\)?[-.\s]?)?[0-9]{3}[-.\s]?[0-9]{4}/g,
    '[PHONE]',
  );

  // Replace gender words (case-insensitive)
  scrubbed = scrubbed.replace(
    /\b(male|female|man|woman|boy|girl|non-binary|nonbinary|gender-neutral|genderqueer|agender)\b/gi,
    '[GENDER]',
  );

  // Replace age numbers and ranges
  // Handles: "25", "25-34", "twenty five", "thirteen to nineteen", etc.
  scrubbed = scrubbed.replace(
    /\b(?:([0-9]{1,3})(?:\s*(?:to|or|-)\s*[0-9]{1,3})?)\b(?!\s*[a-z])/gi,
    (match) => {
      // Check if it looks like an age (1-120)
      const nums = match.match(/[0-9]{1,3}/g);
      if (nums && nums.every((n) => parseInt(n, 10) >= 1 && parseInt(n, 10) <= 120)) {
        return '[AGE]';
      }
      return match;
    },
  );

  // Replace spelled-out age numbers (thirteen, twenty-five, etc.)
  const ageWords = [
    'thirteen',
    'fourteen',
    'fifteen',
    'sixteen',
    'seventeen',
    'eighteen',
    'nineteen',
    'twenty',
    'thirty',
    'forty',
    'fifty',
    'sixty',
    'seventy',
    'eighty',
    'ninety',
  ];
  scrubbed = scrubbed.replace(
    new RegExp(
      `\\b(?:${ageWords.join('|')})(?:\\s*(?:to|or|-|and)\\s*(?:${ageWords.join('|')}))?\\b`,
      'gi',
    ),
    '[AGE]',
  );

  // Replace capitalized words that look like names
  // This is a heuristic: capitalized word at the start of a sentence or after certain keywords
  scrubbed = scrubbed.replace(
    /\b(?:my\s+name\s+is|i'm|i am)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi,
    '[NAME]',
  );

  // Also replace standalone capitalized words (but avoid common words like I, The, etc.)
  const commonWords = new Set([
    'I',
    'The',
    'A',
    'An',
    'Is',
    'Are',
    'Was',
    'Were',
    'Be',
    'Been',
    'Being',
  ]);
  scrubbed = scrubbed.replace(/\b([A-Z][a-z]+)\b/g, (match) => {
    if (!commonWords.has(match) && match.length > 1) {
      // Only replace if it looks like a real name (not an acronym or single letter)
      return '[NAME]';
    }
    return match;
  });

  return scrubbed;
}
