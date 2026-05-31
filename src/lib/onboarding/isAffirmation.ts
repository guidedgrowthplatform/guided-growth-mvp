const AFFIRMATION_TOKENS = new Set([
  'yes',
  'yep',
  'yeah',
  'yup',
  'sure',
  'ok',
  'okay',
  'sounds good',
  'looks good',
  'all good',
  'move on',
  'keep',
  'keep it',
  'keep going',
  'keep that',
  'next',
  'continue',
  'go on',
  "that's right",
  'correct',
  'done',
  'perfect',
]);
const AFFIRMATION_PHRASES = ['move on', 'looks good', 'sounds good'];
const NEGATION_TOKENS = ['no', 'nope', 'nah', 'not', 'change', 'wrong', 'edit', 'switch'];

// Revisit "move on" intent. Conservative: any negation falls through so edits never auto-advance.
export function isAffirmation(text: string): boolean {
  const cleaned = text
    .toLowerCase()
    .replace(/[.,!?;:]+$/g, '')
    .trim();
  if (!cleaned) return false;
  const words = cleaned.split(/\s+/);
  if (words.some((w) => NEGATION_TOKENS.includes(w))) return false;
  if (AFFIRMATION_TOKENS.has(cleaned)) return true;
  return AFFIRMATION_PHRASES.some((p) => cleaned.includes(p));
}
