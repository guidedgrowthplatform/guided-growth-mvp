// Fixes a missing space where two sentences got glued together with no
// separator, e.g. "for weekdays.Now, let's set..." or "there!Now, let's...".
// Seen repeatedly across onboarding beats (B56a) in the LLM's streamed turn
// text: a sentence ending in '.', '!', or '?' is immediately followed by the
// next sentence's capitalized first word with zero characters between them.
//
// joinSentences(a, b) is the general-purpose join: always exactly one space
// between a and b, regardless of whether a ends in punctuation, already has
// trailing whitespace, or has no terminal punctuation at all.
//
// fixSentenceJoinSpacing(text) repairs an already-concatenated string. It is
// applied at the STREAM point in useLLM.ts (per delta, via fixedStreamAppend
// below) so the live streamed response, the TTS sentence chunker, and the
// final persisted message all carry identical corrected text and the
// chunker's raw-text offset invariant holds (sentenceChunks.ts operates on
// offsets into the final message string). The done-time application in
// useLLM.ts is an idempotent backstop once the stream is corrected.
//
// The pattern requires TWO word characters before the terminator so
// initialisms stay intact ("U.S.A.", "p.m.") at the cost of missing a glued
// seam after a single-letter word ("...did I.Then"), which has never been
// observed. Decimals ("3.5") and lowercase continuations are never touched.
export function joinSentences(a: string, b: string): string {
  if (!a) return b;
  if (!b) return a;
  return `${a.replace(/\s+$/, '')} ${b.replace(/^\s+/, '')}`;
}

export function fixSentenceJoinSpacing(text: string): string {
  if (!text) return text;
  return text.replace(/([a-zA-Z0-9]{2})([.!?])([A-Z])/g, '$1$2 $3');
}

// Chars of already-accumulated text needed to detect a pattern spanning an
// append seam: two word chars plus the terminator.
const JOIN_SEAM_WINDOW = 3;

/**
 * Stream-safe append: returns the text to append when `incoming` is added
 * after `prior`, with any glued sentence seam (fully inside `incoming` or
 * spanning the junction) repaired. Never modifies `prior`, so text already
 * emitted downstream (spoken TTS chunks, rendered partials) keeps its
 * offsets. `prior` is assumed to have been built by prior fixed appends, so
 * no unrepaired pattern sits fully inside its tail.
 */
export function fixedStreamAppend(prior: string, incoming: string): string {
  if (!incoming) return incoming;
  const window = prior.slice(-JOIN_SEAM_WINDOW);
  return fixSentenceJoinSpacing(window + incoming).slice(window.length);
}
