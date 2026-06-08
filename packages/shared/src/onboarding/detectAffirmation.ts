import type { ScreenKind } from './screenKind.js';

export interface AffirmationResult {
  affirmed: boolean;
  reason: 'affirmation' | 'done_signal' | 'negation' | 'additive' | 'none' | 'empty';
  matched?: string;
}

const NEGATION = [
  'no',
  'nope',
  'nah',
  'not',
  'not yet',
  'not now',
  'wait',
  'hold on',
  'hold up',
  'stop',
  'wrong',
  'incorrect',
  'but',
  'change',
  'edit',
  'switch',
  'redo',
  'go back',
  'hang on',
  'let me',
  'actually no',
];

const ADDITIVE = ['add', 'also', 'another', 'too', 'more', 'one more', 'plus'];

const DONE_SIGNALS = [
  'done',
  'all done',
  "that's all",
  "i'm done",
  'im done',
  "i'm finished",
  'im finished',
  'finished',
  'all set',
  'move on',
  'next',
  'continue',
  "let's go",
  'lets go',
  'go ahead',
  'proceed',
  "that's it",
  'thats it',
];

const SINGLE_AFFIRM = [
  'yes',
  'yep',
  'yeah',
  'yup',
  'sure',
  'ok',
  'okay',
  'looks good',
  'sounds good',
  'that works',
  'works for me',
  'perfect',
  'correct',
  'ready',
  'keep it',
  'keep going',
  'keep that',
  'go on',
  'all good',
  "that's right",
];

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// word-boundary phrase regex; spaces escaped
function compile(phrases: string[]): { phrase: string; re: RegExp }[] {
  return phrases.map((p) => ({ phrase: p, re: new RegExp(`\\b${escapeRegex(p)}\\b`) }));
}

const NEGATION_RE = compile(NEGATION);
const ADDITIVE_RE = compile(ADDITIVE);
const DONE_RE = compile(DONE_SIGNALS);
const SINGLE_AFFIRM_RE = compile(SINGLE_AFFIRM);

function normalize(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^[^\w]+|[^\w]+$/g, '');
}

function firstMatch(text: string, compiled: { phrase: string; re: RegExp }[]): string | undefined {
  for (const { phrase, re } of compiled) {
    if (re.test(text)) return phrase;
  }
  return undefined;
}

export function detectAffirmation(raw: string, kind: ScreenKind): AffirmationResult {
  if (raw == null || raw.trim() === '') return { affirmed: false, reason: 'empty' };

  const text = normalize(raw);
  if (text === '') return { affirmed: false, reason: 'empty' };

  const neg = firstMatch(text, NEGATION_RE);
  if (neg) return { affirmed: false, reason: 'negation', matched: neg };

  const add = firstMatch(text, ADDITIVE_RE);
  if (add) return { affirmed: false, reason: 'additive', matched: add };

  if (kind === 'multi') {
    const done = firstMatch(text, DONE_RE);
    if (done) return { affirmed: true, reason: 'done_signal', matched: done };
    return { affirmed: false, reason: 'none' };
  }

  const done = firstMatch(text, DONE_RE);
  if (done) return { affirmed: true, reason: 'done_signal', matched: done };
  const aff = firstMatch(text, SINGLE_AFFIRM_RE);
  if (aff) return { affirmed: true, reason: 'affirmation', matched: aff };

  return { affirmed: false, reason: 'none' };
}
