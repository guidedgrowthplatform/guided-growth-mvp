// Heuristic end-of-turn classifier (Phase 1 of coach turn-taking).
//
// Pure, dependency-free, transcript-only. Decides whether a buffered utterance
// SOUNDS finished so the aggregation pause can adapt: shorter when the user is
// clearly done, longer when they're clearly mid-thought (trailing "and",
// "because", an article…), default when ambiguous.
//
// Deliberately CONSERVATIVE: a miss only falls back to the base pause (= the
// Phase 0 behavior), but a false "incomplete" would annoyingly delay a finished
// turn. So we only flag words that almost never end a real utterance.

export type TurnVerdict = 'complete' | 'incomplete' | 'unsure';

// Trailing words that strongly imply more is coming. High-confidence only.
const TRAILING_INCOMPLETE = new Set<string>([
  // coordinating / subordinating conjunctions
  'and',
  'but',
  'or',
  'so',
  'because',
  'cause',
  'cuz',
  'although',
  'though',
  'unless',
  'until',
  'whereas',
  'plus',
  'nor',
  // articles
  'the',
  'a',
  'an',
  // infinitive / directional prepositions that rarely end an utterance
  'to',
  'into',
  'onto',
  'upon',
  // possessives awaiting a noun
  'my',
  'your',
  'our',
  'their',
  'its',
]);

// Single-word (or near) replies that ARE complete even without punctuation —
// covers the common "yes"/"okay" answer so it doesn't wait the full base pause.
const SHORT_AFFIRMATIONS = new Set<string>([
  'yes',
  'yeah',
  'yep',
  'yup',
  'no',
  'nope',
  'nah',
  'okay',
  'ok',
  'sure',
  'done',
  'correct',
  'right',
  'exactly',
  'thanks',
  'great',
  'perfect',
  'stop',
]);

const TERMINAL_PUNCT = /[.!?]['")\]]?\s*$/;
const TRAILING_COMMA = /,\s*$/;

function lastWord(trimmed: string): string {
  const words = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return words[words.length - 1] ?? '';
}

export function isSemanticEndOfTurn(text: string): TurnVerdict {
  const trimmed = text.trim();
  if (!trimmed) return 'unsure';

  // Trailing comma or conjunction/article → still going.
  if (TRAILING_COMMA.test(trimmed)) return 'incomplete';
  const last = lastWord(trimmed);
  if (TRAILING_INCOMPLETE.has(last)) return 'incomplete';

  // Explicit sentence terminator → done.
  if (TERMINAL_PUNCT.test(trimmed)) return 'complete';

  // Short standalone affirmation (≤2 words, ends in an answer word) → done.
  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount <= 2 && SHORT_AFFIRMATIONS.has(last)) return 'complete';

  return 'unsure';
}

export interface TurnPauseConfig {
  /** Ambiguous transcript — the default quiet gap. */
  base: number;
  /** Clearly finished — flush sooner. */
  complete: number;
  /** Clearly mid-thought — wait longer so the user isn't cut off. */
  incomplete: number;
}

export function resolveTurnPauseMs(text: string, cfg: TurnPauseConfig): number {
  switch (isSemanticEndOfTurn(text)) {
    case 'complete':
      return cfg.complete;
    case 'incomplete':
      return cfg.incomplete;
    default:
      return cfg.base;
  }
}

// Clamp a re-armed flush delay so buffered speech can't defer its flush past
// heldSince + maxHold. Every interim/final re-arms the pause timer; without the
// clamp a steady cadence (user repeating an utterance faster than the adaptive
// pause) re-arms forever and the turn never reaches the LLM.
export function clampFlushDelayMs(
  pauseMs: number,
  heldSinceMs: number | null,
  nowMs: number,
  maxHoldMs: number,
): number {
  if (heldSinceMs === null) return pauseMs;
  return Math.max(0, Math.min(pauseMs, heldSinceMs + maxHoldMs - nowMs));
}
