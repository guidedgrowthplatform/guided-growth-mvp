/**
 * Parse free-form text ("brain dump") into structured habit objects.
 *
 * Splits on commas, newlines, and the word "and" to identify individual
 * habit descriptions, then extracts a cleaned habit name and a frequency hint.
 */

interface ParsedHabit {
  name: string;
  frequency: string;
}

const DAY_PATTERN = /monday|tuesday|wednesday|thursday|friday|saturday|sunday/i;

const FREQUENCY_RULES: ReadonlyArray<{
  test: RegExp;
  resolve: (part: string) => string;
}> = Object.freeze([
  {
    test: /every\s*day|daily/i,
    resolve: () => 'daily',
  },
  {
    test: /\d+\s*times?\s*a\s*week/i,
    resolve: (part: string) => {
      const match = part.match(/(\d+)\s*times?/);
      return match ? `${match[1]}x/week` : 'daily';
    },
  },
  {
    test: DAY_PATTERN,
    resolve: () => '3_specific_days',
  },
]);

const NAME_CLEANUP_PATTERNS: ReadonlyArray<RegExp> = Object.freeze([
  /^i\s+want\s+to\s+/i,
  /^i('d|\s+would)\s+like\s+to\s+/i,
  /every\s*(day|morning|night|evening)/gi,
  /on\s+(mondays?|tuesdays?|wednesdays?|thursdays?|fridays?|saturdays?|sundays?)/gi,
  /\d+\s*times?\s*a\s*week/gi,
]);

function resolveFrequency(part: string): string {
  for (const rule of FREQUENCY_RULES) {
    if (rule.test.test(part)) {
      return rule.resolve(part);
    }
  }
  return 'daily';
}

function cleanHabitName(raw: string): string {
  let name = raw;
  for (const pattern of NAME_CLEANUP_PATTERNS) {
    name = name.replace(pattern, '');
  }
  // Preserve meaningful phrases like "before bed" but clean up
  name = name.replace(/before\s+bed/gi, 'before bed');
  return name.trim();
}

const MIN_PART_LENGTH = 4;
const MIN_NAME_LENGTH = 3;

export function parseHabitsFromText(text: string): ParsedHabit[] {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const parts = text
    .split(/[,\n]|(?:\band\b)/gi)
    .map((s) => s.trim())
    .filter((s) => s.length >= MIN_PART_LENGTH);

  return parts
    .map((part) => ({
      name: cleanHabitName(part),
      frequency: resolveFrequency(part),
    }))
    .filter((h) => h.name.length >= MIN_NAME_LENGTH);
}
