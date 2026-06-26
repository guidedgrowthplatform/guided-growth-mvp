/**
 * Habit polarity inference.
 *
 * Every habit in Guided Growth carries a polarity:
 *   - positive  = a DO habit  (binary_do)    succeeds when the user DID it.
 *   - negative  = a BREAK habit (binary_avoid) succeeds when the user ABSTAINED.
 *
 * The check-in already treats these differently (a slip on an avoid habit is left
 * unmarked, never logged as a win), so polarity has to be known at capture time.
 *
 * Rule (from Yair): tag it automatically when the wording is clear; when it is
 * NOT clear, do NOT guess silently, surface it for the user to confirm. Curated
 * onboarding habits are known and should be pre-tagged in their data; this
 * function is for free-form / custom / advanced-list habits the user speaks.
 *
 * `confident: false` (polarity null) is the signal to ask the user.
 */
export type HabitPolarity = 'positive' | 'negative';

export interface HabitPolarityGuess {
  /** 'negative' = break/avoid, 'positive' = do, null = unclear (must confirm). */
  polarity: HabitPolarity | null;
  /** true only when a clear signal drove the guess. false => confirm with user. */
  confident: boolean;
  /** the matched signal, for explaining the guess / debugging. */
  reason: string;
}

// Reduction / abstinence wording => a break habit. Checked FIRST so "drink less
// coffee" (has a do-verb AND a reduce-word) classifies as negative.
const NEGATIVE_SIGNALS: readonly string[] = [
  'no ',
  'not ',
  "don't",
  'dont',
  'never',
  'avoid',
  'quit',
  'stop',
  'cut ',
  'cut back',
  'cut out',
  'cut down',
  'reduce',
  'less ',
  'fewer',
  'limit',
  'skip',
  'abstain',
  'without',
  'stay off',
  'stay away',
  'give up',
  'kick the',
];

// Clear do-action verbs (stems) => a positive habit.
const POSITIVE_VERBS: readonly string[] = [
  'walk',
  'run',
  'jog',
  'exercise',
  'workout',
  'work out',
  'gym',
  'stretch',
  'meditat',
  'breath',
  'drink',
  'hydrate',
  'eat',
  'read',
  'write',
  'journal',
  'reflect',
  'sleep',
  'wake',
  'plan',
  'practice',
  'cook',
  'clean',
  'review',
  'study',
  'learn',
  'move',
  'stand',
  'floss',
  'pray',
];

function norm(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** True if `signal` appears as a left-bounded token in `text`. */
function hasSignal(text: string, signal: string): boolean {
  const escaped = signal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Left boundary only: signals like "no " carry their own trailing space, and
  // verb stems should match prefixes ("meditat" -> "meditating").
  return new RegExp(`(^|[^a-z])${escaped}`).test(text);
}

/**
 * Infer a habit's polarity from its name. Negative signals win over positive
 * ones (reduction framing dominates). When neither is clear, returns
 * { polarity: null, confident: false } so the caller asks the user.
 */
export function inferHabitPolarity(name: string): HabitPolarityGuess {
  const text = norm(name);
  if (!text) return { polarity: null, confident: false, reason: 'empty' };

  for (const sig of NEGATIVE_SIGNALS) {
    if (hasSignal(text, sig)) {
      return { polarity: 'negative', confident: true, reason: `negative:"${sig.trim()}"` };
    }
  }
  for (const verb of POSITIVE_VERBS) {
    if (hasSignal(text, verb)) {
      return { polarity: 'positive', confident: true, reason: `positive:"${verb}"` };
    }
  }
  return { polarity: null, confident: false, reason: 'unclear' };
}
