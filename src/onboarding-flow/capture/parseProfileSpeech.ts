export type ParsedProfileSpeech = {
  age?: number;
  gender?: 'Male' | 'Female' | 'Other';
};

const AGE_MIN = 13;
const AGE_MAX = 120;

const ONES: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
};

const TEENS: Record<string, number> = {
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
};

const TENS: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fourty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

type Token = { value: string; index: number };
type AgeCandidate = { value: number; index: number };

function inAgeRange(value: number): boolean {
  return Number.isInteger(value) && value >= AGE_MIN && value <= AGE_MAX;
}

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  const re = /[a-z]+|\d+/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    tokens.push({ value: match[0].toLowerCase(), index: match.index });
  }
  return tokens;
}

function parseNumberWordsAt(tokens: Token[], start: number): number | undefined {
  const word = tokens[start]?.value;
  if (!word) return undefined;

  if (word in TEENS) return TEENS[word];

  if (word in TENS) {
    let value = TENS[word];
    const next = tokens[start + 1]?.value;
    if (next && next in ONES) value += ONES[next];
    return value;
  }

  if (word in ONES) {
    const base = ONES[word];
    if (tokens[start + 1]?.value !== 'hundred') return base;

    let value = base * 100;
    let cursor = start + 2;
    if (tokens[cursor]?.value === 'and') cursor += 1;

    const next = tokens[cursor]?.value;
    if (next && next in TEENS) {
      value += TEENS[next];
    } else if (next && next in TENS) {
      value += TENS[next];
      const afterTens = tokens[cursor + 1]?.value;
      if (afterTens && afterTens in ONES) value += ONES[afterTens];
    } else if (next && next in ONES) {
      value += ONES[next];
    }
    return value;
  }

  if (word === 'hundred') return 100;

  return undefined;
}

function parseAge(text: string): number | undefined {
  const candidates: AgeCandidate[] = [];
  const digitRe = /\d+/g;
  let digitMatch: RegExpExecArray | null;
  while ((digitMatch = digitRe.exec(text)) !== null) {
    const value = Number.parseInt(digitMatch[0], 10);
    if (inAgeRange(value)) candidates.push({ value, index: digitMatch.index });
  }

  const tokens = tokenize(text);
  tokens.forEach((token, index) => {
    if (/^\d+$/.test(token.value)) return;
    const value = parseNumberWordsAt(tokens, index);
    if (value !== undefined && inAgeRange(value)) {
      candidates.push({ value, index: token.index });
    }
  });

  candidates.sort((a, b) => a.index - b.index);
  return candidates[0]?.value;
}

function collectGenderMatches(
  text: string,
  pattern: RegExp,
  gender: NonNullable<ParsedProfileSpeech['gender']>,
): Array<{ gender: NonNullable<ParsedProfileSpeech['gender']>; index: number }> {
  const matches: Array<{ gender: NonNullable<ParsedProfileSpeech['gender']>; index: number }> = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const prefix = match[1] ?? '';
    matches.push({ gender, index: match.index + prefix.length });
  }
  return matches;
}

function parseGender(text: string): ParsedProfileSpeech['gender'] | undefined {
  const normalized = text.toLowerCase();
  const maleMatches = collectGenderMatches(
    normalized,
    /(^|[^a-z0-9'])(male|man|guy|boy|m)(?![a-z0-9'])/g,
    'Male',
  );
  const femaleMatches = collectGenderMatches(
    normalized,
    /(^|[^a-z0-9'])(female|woman|girl|lady|f)(?![a-z0-9'])/g,
    'Female',
  );

  if (maleMatches.length > 0 && femaleMatches.length > 0) return undefined;

  const otherMatches = collectGenderMatches(
    normalized,
    /(^|[^a-z0-9'])(other|non[-\s]?binary|nb|enby)(?![a-z0-9'])/g,
    'Other',
  );

  const first = [...maleMatches, ...femaleMatches, ...otherMatches].sort(
    (a, b) => a.index - b.index,
  )[0];
  return first?.gender;
}

export function parseProfileSpeech(text: string): ParsedProfileSpeech {
  const parsed: ParsedProfileSpeech = {};
  const age = parseAge(text);
  const gender = parseGender(text);
  if (age !== undefined) parsed.age = age;
  if (gender !== undefined) parsed.gender = gender;
  return parsed;
}
