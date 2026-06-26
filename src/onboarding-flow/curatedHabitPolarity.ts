/**
 * Pre-tagged polarity for every curated Guided Growth habit.
 *
 * Yair's rule: the curated set is known, so it is tagged explicitly here rather
 * than left to inference. Free-form / custom / advanced-list habits fall through
 * to inferHabitPolarity, and anything still unclear is surfaced for the user to
 * confirm (resolveHabitPolarity returns source 'unclear').
 *
 * Lens used to tag: positive = an action the user PERFORMS (the check-in scores
 * it when DONE); negative = a behavior the user refrains from or caps (scores
 * when ABSTAINED / kept under). Keys are the exact names in
 * @gg/shared/data/onboardingHabits (habitsByGoal).
 *
 * A handful are genuinely debatable and worth Yair's confirm (he may flip them):
 * the phone-out-of-bedroom variants and the "Max N" / "under target" caps are
 * tagged negative (refrain/cap); "Say no to one nonessential task",
 * "End work by target time", and "Notifications off during focus block" are
 * tagged positive (an action). See the spec doc Section 9.
 */
import { inferHabitPolarity, type HabitPolarity } from './habitPolarity';

export const CURATED_HABIT_POLARITY: Record<string, HabitPolarity> = {
  '10-minute desk reset': 'positive',
  '10-minute evening tidy': 'positive',
  '10-minute walk after dinner': 'positive',
  '10-minute walk after lunch': 'positive',
  '10-minute walk without phone': 'positive',
  '10-minute wind-down': 'positive',
  '15-minute admin block': 'positive',
  '15-minute walk': 'positive',
  '2 liters of water': 'positive',
  '2-minute desk stretch at 3 PM': 'positive',
  '2-minute reset at lunch': 'positive',
  '20-minute home workout': 'positive',
  '5-minute breathing session': 'positive',
  '5-minute morning stretch': 'positive',
  '5-minute post-work stretch': 'positive',
  '8,000+ steps': 'positive',
  'Be in bed by target bedtime': 'positive',
  'Bedroom cool and dark before bed': 'positive',
  'Block distracting sites during work hours': 'positive',
  'Brush teeth after dinner': 'positive',
  'Buy groceries on selected day': 'positive',
  'Capture all tasks in one list': 'positive',
  'Carry gum instead of cigarettes': 'positive',
  'Check calendar every morning': 'positive',
  'Check task list before starting work': 'positive',
  'Choose one must-do task the night before': 'positive',
  'Clear inbox to target number': 'positive',
  'Desk cleared before first work block': 'positive',
  'Do urge delay before each cigarette': 'positive',
  'Drink water before coffee': 'positive',
  'Drink water before dinner': 'positive',
  'Eat breakfast within 90 minutes of waking': 'positive',
  'End work by target time': 'positive',
  'Get outside within 30 minutes of waking': 'positive',
  'In bed by target bedtime': 'positive',
  'Kitchen closed after dinner': 'negative',
  'Lay out workout clothes the night before': 'positive',
  'Lights out by target bedtime': 'positive',
  'Max 2 caffeinated drinks': 'negative',
  'Max 2 drinks on selected nights': 'negative',
  'No alcohol on sleep nights': 'negative',
  'No alcohol on weekdays': 'negative',
  'No alcohol today': 'negative',
  'No caffeine after 2 PM': 'negative',
  'No calories after 9 PM': 'negative',
  'No cigarettes today': 'negative',
  'No eating while scrolling': 'negative',
  'No energy drinks': 'negative',
  'No food after 9 PM': 'negative',
  'No heavy meal within 2 hours of bed': 'negative',
  'No notifications during first work block': 'negative',
  'No phone during first 30 minutes after waking': 'negative',
  'No phone during meals': 'negative',
  'No porn after 10 PM': 'negative',
  'No porn today': 'negative',
  'No screens after 10 PM': 'negative',
  'No screens in bed': 'negative',
  'No second helping at dinner': 'negative',
  'No smoking before noon': 'negative',
  'No snooze': 'negative',
  'No social media before lunch': 'negative',
  'No sugary drink after lunch': 'negative',
  'No weed before 8 PM': 'negative',
  'No weed on weeknights': 'negative',
  'No weed today': 'negative',
  'No work email after target time': 'negative',
  'Notifications off during focus block': 'positive',
  'One 15-minute admin block': 'positive',
  'One 45-minute focus block': 'positive',
  'One planned snack max': 'negative',
  'One weekly reset block': 'positive',
  'Order nonalcoholic first drink': 'positive',
  'Out of bed by target time': 'positive',
  'Pack a healthy snack': 'positive',
  'Pay bills on selected day': 'positive',
  'Phone in another room for first work block': 'positive',
  'Phone outside bedroom': 'negative',
  'Phone stays out of bedroom': 'negative',
  'Phone stays outside bedroom': 'negative',
  'Plan tomorrow before ending work': 'positive',
  'Plan tomorrow’s meals tonight': 'positive',
  'Prep lunch for tomorrow': 'positive',
  'Prepare planned evening tea instead': 'positive',
  'Process mail and papers': 'positive',
  'Protein at breakfast': 'positive',
  'Protein with lunch': 'positive',
  'Put clothes away before bed': 'positive',
  'Read 10 pages before bed': 'positive',
  'Replace evening use with 10-minute walk': 'positive',
  'Same bedtime within 30 minutes': 'positive',
  'Same wake time within 30 minutes': 'positive',
  'Say no to one nonessential task': 'positive',
  'Social apps under target minutes': 'negative',
  'Stand up once each work hour': 'positive',
  'Start first work block by target time': 'positive',
  'Start hardest task before checking messages': 'positive',
  'Start wind-down by 10 PM': 'positive',
  'Stretch after each workout': 'positive',
  'Take one screen-free break': 'positive',
  'Two 45-minute focus blocks': 'positive',
  'Use blocker on selected devices': 'positive',
  'Use one task list only': 'positive',
  'Vegetables at dinner': 'positive',
  'Vegetables at lunch': 'positive',
  'Water before first caffeine': 'positive',
  'Work 10 minutes on avoided task': 'positive',
  'Workout on 2 selected days': 'positive',
  'Workout on 3 selected days': 'positive',
  'Write tomorrow’s top 3 before bed': 'positive',
  'Write top 3 priorities before starting work': 'positive',
};

export type PolaritySource = 'curated' | 'inferred' | 'unclear';

export interface ResolvedPolarity {
  polarity: HabitPolarity | null;
  source: PolaritySource;
}

/**
 * Canonical polarity resolution for any habit name:
 *   curated tag (known) -> inference (clearly worded) -> unclear (confirm).
 * Callers treat source 'unclear' as the signal to ask the user.
 */
export function resolveHabitPolarity(name: string): ResolvedPolarity {
  const key = name.trim();
  const curated = CURATED_HABIT_POLARITY[key];
  if (curated) return { polarity: curated, source: 'curated' };
  const guess = inferHabitPolarity(key);
  if (guess.confident && guess.polarity) return { polarity: guess.polarity, source: 'inferred' };
  return { polarity: null, source: 'unclear' };
}
