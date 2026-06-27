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

// Filler / discourse words people say (repeatable) before the real content.
const FILLER =
  /^(?:\s*(?:um|uh|er|erm|so|like|ok|okay|yeah|yep|nah|well|and|also|then|plus|maybe|just|really|basically|honestly|i mean|but|actually|look|anyway|alright|right|now|i guess)\b[\s,]*)+/i;

// Disfluency / false-start markers. A clause carrying one of these is someone
// trailing off or self-correcting ("but I don't—uh", "um, so like"), never a
// real habit, so it must not become a card.
const DISFLUENCY = /(?:^|\s)(?:uh+|um+|er+|erm)(?:\s|$)|[—–]|--/i;
// Bare negation lead with no real object ("I don't", "don't") = an incomplete
// thought, not a "no X" habit (which the AI handles).
const NEGATION_FRAGMENT = /^(?:i\s+)?don'?t\b/i;
// Pronoun-led narration ("it said", "we need to", "that shows up") is the user
// talking ABOUT things, not naming a habit. No real habit name leads with these.
const PRONOUN_LEAD = /^(?:it|he|she|they|we|that|this|there|here)\b/i;
// "I" / "I'm" / "I am" / "I would" lead.
const SUBJECT = /^(?:i\s+would\s+|i\s+am\s+|i'?m\s+|i'?ve\s+(?:been\s+)?|i\s+)/i;
// Intent verbs, with or without a subject ("want to read", "going to run").
// Trailing separator accepts punctuation, so "want to." (a comma/period crept in
// by the transcriber) still strips instead of surviving as "Want to. I want".
const INTENT =
  /^(?:want(?:ing)?\s+to|wanna|going\s+to|gonna|need(?:ing)?\s+to|would\s+like\s+to|'?d\s+like\s+to|like\s+to|hoping\s+to|hope\s+to|try(?:ing)?\s+to|have\s+to|gotta|got\s+to|should|will|plan(?:ning)?\s+to|start(?:ing)?|begin|keep)[\s.,;:]+/i;

// Schedule wording to strip from the NAME (and, for days, captured separately).
const SCHEDULE_PHRASE =
  /\b(?:on\s+)?(?:(?:sunday|saturday|monday|tuesday|wednesday|thursday|friday)(?:[\s,]*(?:and\s+)?))+|\b(?:every\s?day|everyday|daily)\b|\b(?:every\s+weekday|weekdays?)\b|\bweekends?\b|\b(?:once|twice|three times|four times|five times|\d+\s*(?:times|x))\s+(?:a|per)\s+week\b|\b(?:once|twice)\s+weekly\b|\bweekly\b|\bevery\s+(?:morning|evening|night|afternoon)\b|\bevery\s+other\s+day\b/gi;

// Cleaned clauses that aren't habits. Includes the lead-in residue that's left
// when someone trails off ("I want to...", "I'm going to") with no real verb, so
// a half-spoken fragment never becomes a card.
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
  // disfluency / connective residue
  'is',
  'are',
  'was',
  'be',
  'but',
  'so',
  'well',
  'actually',
  'look',
  'dont',
  "don't",
  'i dont',
  "i don't",
  // intent / pronoun residue from trailed-off speech
  'i',
  'i want',
  'i want to',
  'want',
  'want to',
  'i need',
  'i need to',
  'need to',
  'going to',
  "i'm going to",
  'im going to',
  'i would',
  'i would like',
  'i would like to',
  'gonna',
  'wanna',
  'to',
  'do',
]);

// Strip the lead-ins (filler, subject "I", intent verb) repeatedly until the
// string stops changing. One pass leaves residue on stacked lead-ins like
// "I want to start to ..." or "want to. I want to ..." (after the first strip a
// new lead-in is exposed), which is exactly what produced the half-baked cards.
function stripLeadIns(s: string): string {
  let prev: string;
  let n = s;
  do {
    prev = n;
    n = n
      .replace(FILLER, '')
      .replace(SUBJECT, '')
      .replace(INTENT, '')
      // A bare "to" left over from "start to ...", "try to ..." is lead-in
      // residue; no real habit name starts with "to".
      .replace(/^to\s+/i, '')
      .replace(/^[\s,.;:!?-]+/, '');
  } while (n !== prev);
  return n;
}

function cleanName(clause: string): string {
  const n = stripLeadIns(clause)
    .replace(SCHEDULE_PHRASE, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,.;:-]+|[\s,.;:!?-]+$/g, '')
    .trim();
  return n;
}

export function parseHabitsRegex(text: string): { name: string; days?: number[] }[] {
  // Normalize smart apostrophes so "don't" matches regardless of quote style,
  // and drop double quotes entirely (a transcriber sometimes wraps a phrase in
  // them, which otherwise blocks the lead-in strip: '"But I don't' -> a card).
  const normalized = text.replace(/[‘’]/g, "'").replace(/[“”„"]/g, '');
  // Note: we do NOT split on the em-dash. Splitting it truncates a cut-off word
  // ("don't" -> "don"); instead the whole disfluent clause is dropped below.
  const clauses = normalized
    .split(/,|\band then\b|\band\b|\balso\b|\bbut\b|;|\n|\bthen\b/i)
    .map((c) => c.trim())
    .filter(Boolean);
  const out: { name: string; days?: number[] }[] = [];
  const seen = new Set<string>();
  for (const clause of clauses) {
    // A clause that still carries a disfluency marker is a false start, drop it.
    if (DISFLUENCY.test(clause)) continue;
    const days = extractDaysRegex(clause.toLowerCase());
    const name = cleanName(clause);
    const key = name.toLowerCase();
    if (
      name.length >= 2 &&
      name.length <= 60 &&
      !seen.has(key) &&
      !REJECT.has(key) &&
      !DISFLUENCY.test(name) &&
      !NEGATION_FRAGMENT.test(name) &&
      !PRONOUN_LEAD.test(name)
    ) {
      seen.add(key);
      out.push(days ? { name, days } : { name });
    }
  }
  return out;
}
