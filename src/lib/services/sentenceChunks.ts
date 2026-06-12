// Splits an append-only streaming reply into complete sentences for chunked TTS.
// Operates on the raw, untransformed text so offsets stay aligned with the
// final message string (emoji-strip happens per-chunk downstream).

export interface ChunkResult {
  chunks: string[];
  nextOffset: number;
}

const DEFAULT_MIN_CHARS = 30;

// Normalized (lowercased, dots removed) — a `.` after one of these is not a boundary.
const ABBREVIATIONS = new Set(['eg', 'ie', 'etc', 'dr', 'mr', 'mrs', 'ms', 'vs', 'am', 'pm']);

const TERMINATORS = new Set(['.', '!', '?', '…']);
const CLOSERS = new Set(['"', "'", ')', ']', '}', '”', '’', '»']);

function isDigit(ch: string | undefined): boolean {
  return ch !== undefined && ch >= '0' && ch <= '9';
}

// A `.` inside a number (9.30) or after an abbreviation (Dr., e.g.) isn't a sentence end.
function isFalseDot(text: string, dotIndex: number): boolean {
  if (isDigit(text[dotIndex - 1]) && isDigit(text[dotIndex + 1])) return true;
  let start = dotIndex;
  while (start > 0) {
    const c = text[start - 1];
    if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '.') start--;
    else break;
  }
  const token = text.slice(start, dotIndex).replace(/\./g, '').toLowerCase();
  return token.length > 0 && ABBREVIATIONS.has(token);
}

/**
 * Returns sentences completed since `consumedOffset`, plus the new offset.
 * A sentence is complete only when its terminator is followed by whitespace
 * (proving more text exists), so a trailing in-progress fragment stays buffered.
 * Sub-`minChars` sentences merge forward to avoid choppy clips — except the
 * first sentence of the message (consumedOffset 0), kept fast for low latency.
 */
export function nextSentenceChunks(
  text: string,
  consumedOffset: number,
  opts?: { minChars?: number },
): ChunkResult {
  const minChars = opts?.minChars ?? DEFAULT_MIN_CHARS;
  const chunks: string[] = [];
  let accStart = consumedOffset;
  let emittedOffset = consumedOffset;
  let firstOfMessage = consumedOffset === 0;

  let i = consumedOffset;
  while (i < text.length) {
    const ch = text[i];
    if (!TERMINATORS.has(ch)) {
      i++;
      continue;
    }
    let j = i;
    while (j < text.length && TERMINATORS.has(text[j])) j++;
    while (j < text.length && CLOSERS.has(text[j])) j++;
    const followedByWhitespace = j < text.length && /\s/.test(text[j]);
    if (!followedByWhitespace || (ch === '.' && isFalseDot(text, i))) {
      i = j;
      continue;
    }
    let k = j;
    while (k < text.length && /\s/.test(text[k])) k++;
    const candidate = text.slice(accStart, k).trim();
    if (candidate.length > 0 && (candidate.length >= minChars || firstOfMessage)) {
      chunks.push(candidate);
      accStart = k;
      emittedOffset = k;
      firstOfMessage = false;
    }
    i = k;
  }

  return { chunks, nextOffset: emittedOffset };
}

/** Whatever remains unspoken past `consumedOffset` — flushed at end of turn. */
export function flushSentenceTail(text: string, consumedOffset: number): string {
  return text.slice(consumedOffset).trim();
}
