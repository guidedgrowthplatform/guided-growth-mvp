// Fixes a missing space where two sentences got glued together with no
// separator, e.g. "for weekdays.Now, let's set..." or "there!Now, let's...".
// Seen repeatedly across onboarding beats (B56a) in the LLM's own generated
// turn text: a sentence ending in '.', '!', or '?' is immediately followed by
// the next sentence's capitalized first word with zero characters between
// them.
//
// joinSentences(a, b) is the general-purpose join: always exactly one space
// between a and b, regardless of whether a ends in punctuation, already has
// trailing whitespace, or has no terminal punctuation at all.
//
// fixSentenceJoinSpacing(text) is the same rule applied as a post-hoc repair
// on a single already-concatenated string, for the one call site where the
// two halves already arrived pre-joined (a single LLM turn's full text) and
// there is no earlier point to intervene with the two-argument form.
export function joinSentences(a: string, b: string): string {
  if (!a) return b;
  if (!b) return a;
  return `${a.replace(/\s+$/, '')} ${b.replace(/^\s+/, '')}`;
}

export function fixSentenceJoinSpacing(text: string): string {
  if (!text) return text;
  // Terminal punctuation directly followed by an uppercase letter or digit,
  // with no whitespace between them. Requires the character before the
  // punctuation to be a letter/digit too, so it doesn't fire on stray
  // punctuation (e.g. inside an emoji or symbol run).
  return text.replace(/([a-zA-Z0-9])([.!?])([A-Z])/g, '$1$2 $3');
}
