/**
 * Date parsing helpers for voice transcripts. Used as a safety net by
 * process-command.ts when the LLM returns "today" but the transcript
 * actually contains an explicit date phrase.
 *
 * Symmetric in spirit with src/lib/services/action-dispatcher.ts, which
 * does its own date parsing on the client side. Vercel functions cannot
 * import from src/, so the constants are intentionally duplicated rather
 * than shared.
 */

export const MONTHS: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

export const ORDINALS: Record<string, number> = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
  eleventh: 11,
  twelfth: 12,
  thirteenth: 13,
  fourteenth: 14,
  fifteenth: 15,
  sixteenth: 16,
  seventeenth: 17,
  eighteenth: 18,
  nineteenth: 19,
  twentieth: 20,
  'twenty-first': 21,
  'twenty-second': 22,
  'twenty-third': 23,
  'twenty-fourth': 24,
  'twenty-fifth': 25,
  'twenty-sixth': 26,
  'twenty-seventh': 27,
  'twenty-eighth': 28,
  'twenty-ninth': 29,
  thirtieth: 30,
  'thirty-first': 31,
  'twenty first': 21,
  'twenty second': 22,
  'twenty third': 23,
  'twenty fourth': 24,
  'twenty fifth': 25,
  'twenty sixth': 26,
  'twenty seventh': 27,
  'twenty eighth': 28,
  'twenty ninth': 29,
};

export const YEAR_WORDS: Record<string, number> = {
  'two thousand twenty-five': 2025,
  'two thousand twenty five': 2025,
  'two thousand twenty-six': 2026,
  'two thousand twenty six': 2026,
  'two thousand twenty-seven': 2027,
  'two thousand twenty seven': 2027,
  'two thousand twenty-eight': 2028,
  'two thousand twenty eight': 2028,
  'twenty twenty-five': 2025,
  'twenty twenty five': 2025,
  'twenty twenty-six': 2026,
  'twenty twenty six': 2026,
  'twenty twenty-seven': 2027,
  'twenty twenty seven': 2027,
  'twenty twenty-eight': 2028,
  'twenty twenty eight': 2028,
};

/** Convert word or digit to day number: "fifteenth" → 15, "5" → 5, "5th" → 5 */
export function parseDay(s: string): number | null {
  const trimmed = s.trim().toLowerCase();
  if (ORDINALS[trimmed]) return ORDINALS[trimmed];
  const n = parseInt(trimmed, 10);
  return !isNaN(n) && n >= 1 && n <= 31 ? n : null;
}

/** Try to extract a year from remaining text: "two thousand twenty six" → 2026 */
export function parseYear(s: string): number {
  const trimmed = s.trim().toLowerCase();
  // Numeric year
  const numMatch = trimmed.match(/\d{4}/);
  if (numMatch) return parseInt(numMatch[0], 10);
  // Word year
  for (const [words, year] of Object.entries(YEAR_WORDS)) {
    if (trimmed.includes(words)) return year;
  }
  return new Date().getFullYear();
}

/**
 * Extract an explicit date from a transcript when the LLM misses it.
 * Handles: "12 march 2026", "march 12th", "fifteenth of march",
 *          "03/05/2026", "fifteenth march two thousand twenty six"
 */
export function extractDateFromTranscript(transcript: string): string | null {
  const t = transcript.toLowerCase();

  // Numeric date: "03/05/2026" or "3/5/2026" (MM/DD/YYYY)
  const numericMatch = t.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (numericMatch) {
    const m = parseInt(numericMatch[1], 10);
    const d = parseInt(numericMatch[2], 10);
    const y = parseInt(numericMatch[3], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // Build ordinal alternatives for regex: "first|second|...|thirty-first|\d{1,2}(?:st|nd|rd|th)?"
  const ordinalWords = Object.keys(ORDINALS).join('|');
  const dayPattern = `(${ordinalWords}|\\d{1,2}(?:st|nd|rd|th)?)`;
  const monthNames = Object.keys(MONTHS).join('|');
  const monthPattern = `(${monthNames})`;

  // Pattern: "for|on DAY [of] MONTH [YEAR]"
  const p1 = new RegExp(`(?:for|on)\\s+${dayPattern}\\s+(?:of\\s+)?${monthPattern}(.*)`, 'i');
  // Pattern: "for|on MONTH DAY [YEAR]"
  const p2 = new RegExp(`(?:for|on)\\s+${monthPattern}\\s+${dayPattern}(.*)`, 'i');

  for (const pattern of [p1, p2]) {
    const match = t.match(pattern);
    if (match) {
      let dayStr: string, monthStr: string, rest: string;
      // Determine which group is day vs month
      if (match[1] && MONTHS[match[1].toLowerCase()]) {
        // p2: month first
        monthStr = match[1];
        dayStr = match[2];
        rest = match[3] || '';
      } else {
        // p1: day first
        dayStr = match[1];
        monthStr = match[2];
        rest = match[3] || '';
      }
      const day = parseDay(dayStr);
      const month = MONTHS[monthStr.toLowerCase()];
      const year = parseYear(rest);
      if (day && month) {
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }
  }

  return null;
}
