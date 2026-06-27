/**
 * parseBrainDumpRegex — instant, local, no-network first pass over a brain dump.
 *
 * Splits the dump into habit clauses, pulls a clean name and any EXPLICIT days
 * out of each. Runs on every keystroke / transcript update so habits appear with
 * zero lag; the AI parse refines names and catches messy cases a moment later.
 * Both feed one persistent list (see FlowOnboardingSim), so nothing ever drops.
 *
 * Days are extracted only when concrete (named days, "daily", "weekdays",
 * "weekends"); vague counts ("three times a week") leave days empty for the user
 * to pick, same rule as the AI parse.
 */

const DAY_INDEX: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  weds: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAYS = [1, 2, 3, 4, 5];
const WEEKENDS = [0, 6];

export function extractDaysRegex(lc: string): number[] | undefined {
  if (/\b(every\s?day|everyday|daily)\b/.test(lc)) return [...ALL_DAYS];
  if (/\b(every\s+weekday|weekdays?)\b/.test(lc)) return [...WEEKDAYS];
  if (/\bweekends?\b/.test(lc)) return [...WEEKENDS];
  const found = new Set<number>();
  for (const m of lc.matchAll(
    /\b(sunday|saturday|monday|tuesday|wednesday|thursday|friday|sun|mon|tues?|weds?|thur?s?|fri|sat)\b/g,
  )) {
    const d = DAY_INDEX[m[1]];
    if (d != null) found.add(d);
  }
  return found.size ? [...found].sort((a, b) => a - b) : undefined;
}

// Filler words people say (repeatable) before the real content.
const FILLER =
  /^(?:\s*(?:um|uh|er|so|like|ok|okay|yeah|yep|nah|well|and|also|then|plus|maybe|just|really|basically|honestly|i mean)\b[\s,]*)+/i;
// "I" / "I'm" / "I am" / "I would" lead.
const SUBJECT = /^(?:i\s+would\s+|i\s+am\s+|i'?m\s+|i'?ve\s+(?:been\s+)?|i\s+)/i;
// Intent verbs, with or without a subject ("want to read", "going to run").
const INTENT =
  /^(?:want(?:ing)?\s+to|wanna|going\s+to|gonna|need(?:ing)?\s+to|would\s+like\s+to|'?d\s+like\s+to|like\s+to|hoping\s+to|hope\s+to|try(?:ing)?\s+to|have\s+to|gotta|got\s+to|should|will|plan(?:ning)?\s+to|start(?:ing)?|begin|keep)\s+/i;

// Schedule wording to strip from the NAME (and, for days, captured separately).
const SCHEDULE_PHRASE =
  /\b(?:on\s+)?(?:(?:sunday|saturday|monday|tuesday|wednesday|thursday|friday)(?:[\s,]*(?:and\s+)?))+|\b(?:every\s?day|everyday|daily)\b|\b(?:every\s+weekday|weekdays?)\b|\bweekends?\b|\b(?:once|twice|three times|four times|five times|\d+\s*(?:times|x))\s+(?:a|per)\s+week\b|\b(?:once|twice)\s+weekly\b|\bweekly\b|\bevery\s+(?:morning|evening|night|afternoon)\b|\bevery\s+other\s+day\b/gi;

// Cleaned clauses that aren't habits.
const REJECT = new Set([
  'you know',
  'etc',
  'and so on',
  'that',
  'thats it',
  "that's it",
  'thats all',
  "that's all",
  'stuff',
  'things',
  'whatever',
  'something',
  'anything',
  'more',
]);

function cleanName(clause: string): string {
  let n = clause.replace(FILLER, '');
  n = n.replace(SUBJECT, '');
  n = n.replace(INTENT, '');
  // A second intent pass catches "want to go to the gym" -> after SUBJECT it can
  // still lead with an intent verb, and stacked fillers like "just start".
  n = n.replace(INTENT, '');
  n = n
    .replace(SCHEDULE_PHRASE, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,.;:-]+|[\s,.;:!?-]+$/g, '')
    .trim();
  return n;
}

export function parseHabitsRegex(text: string): { name: string; days?: number[] }[] {
  const clauses = text
    .split(/,|\band then\b|\band\b|\balso\b|;|\n|\bthen\b/i)
    .map((c) => c.trim())
    .filter(Boolean);
  const out: { name: string; days?: number[] }[] = [];
  const seen = new Set<string>();
  for (const clause of clauses) {
    const days = extractDaysRegex(clause.toLowerCase());
    const name = cleanName(clause);
    const key = name.toLowerCase();
    if (name.length >= 2 && name.length <= 60 && !seen.has(key) && !REJECT.has(key)) {
      seen.add(key);
      out.push(days ? { name, days } : { name });
    }
  }
  return out;
}
