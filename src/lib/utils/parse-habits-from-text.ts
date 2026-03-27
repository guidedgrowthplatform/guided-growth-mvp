import type { ParsedHabit } from '@shared/types';

const FILLER_PATTERNS = [
  /^i(?:'d| would| want to| need to| like to)\s+/i,
  /^i\s+(?:want|need|would like)\s+to\s+/i,
  /^(?:my goal is to|i'm going to|i plan to)\s+/i,
];

const FREQUENCY_PATTERNS: [RegExp, string][] = [
  [/every\s*day/i, 'daily'],
  [/daily/i, 'daily'],
  [/(\d)\s*(?:times?\s*(?:a|per)\s*week|x\s*\/?\s*week)/i, '$1x/week'],
  [/every\s*(?:other|2nd)\s*day/i, '3x/week'],
  [/weekdays?/i, 'weekdays'],
  [/weekends?/i, 'weekends'],
];

const TIME_PATTERN = /(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i;

const FALLBACK_HABITS: ParsedHabit[] = [
  { name: 'Sleep by 11 PM', frequency: 'daily' },
  { name: 'Morning stretch', frequency: 'daily' },
  { name: 'No coffee after 3 PM', frequency: 'daily' },
];

/**
 * Parse free-form text into structured habit items.
 * Splits on commas, newlines, and "and", then extracts name, frequency, and time.
 * Returns fallback habits if parsing yields no results.
 */
export function parseHabitsFromText(text: string): ParsedHabit[] {
  if (!text.trim()) return FALLBACK_HABITS;

  const fragments = text
    .split(/[,\n]|(?:\band\b)/gi)
    .map((s) => s.trim())
    .filter((s) => s.length >= 4);

  const habits: ParsedHabit[] = [];

  for (const fragment of fragments) {
    let name = fragment;

    // Strip filler phrases
    for (const pattern of FILLER_PATTERNS) {
      name = name.replace(pattern, '');
    }

    // Extract frequency
    let frequency: string | undefined;
    for (const [pattern, replacement] of FREQUENCY_PATTERNS) {
      const match = name.match(pattern);
      if (match) {
        frequency =
          replacement.includes('$1') && match[1]
            ? replacement.replace('$1', match[1])
            : replacement;
        name = name.replace(pattern, '').trim();
        break;
      }
    }

    // Extract time
    let time: string | undefined;
    const timeMatch = name.match(TIME_PATTERN);
    if (timeMatch) {
      time = timeMatch[1];
      name = name.replace(TIME_PATTERN, '').trim();
    }

    // Clean up remaining artifacts
    name = name
      .replace(/\s{2,}/g, ' ')
      .replace(/^[-–—•]\s*/, '')
      .trim();

    if (name.length >= 3) {
      habits.push({ name, frequency, time });
    }
  }

  return habits.length > 0 ? habits : FALLBACK_HABITS;
}
