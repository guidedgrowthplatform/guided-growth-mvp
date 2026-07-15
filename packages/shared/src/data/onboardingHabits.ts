// Single source of truth: onboarding goal → suggested habits.
// Sourced from the approved Google Sheet. Imported by the Vite frontend
// (src/data/onboardingHabits.ts) and the serverless system-prompt builder.

export const habitsByGoal: Record<string, string[]> = {
  // Sleep better
  'Fall asleep earlier': [
    'No caffeine after 2 PM',
    'No screens after 10 PM',
    'Start wind-down by 10 PM',
    'Be in bed by target bedtime',
  ],
  'Wake up earlier': [
    'Out of bed by target time',
    'No snooze',
    'Phone stays outside bedroom',
    'Lights out by target bedtime',
  ],
  'Sleep more consistently': [
    'Same bedtime within 30 minutes',
    'Same wake time within 30 minutes',
    'No screens in bed',
    'No food after 9 PM',
  ],
  'Sleep more deeply': [
    'Bedroom cool and dark before bed',
    'No alcohol on sleep nights',
    'No heavy meal within 2 hours of bed',
    'Read 10 pages before bed',
  ],

  // Move more
  'Walk more': [
    '8,000+ steps',
    '10-minute walk after lunch',
    '10-minute walk after dinner',
    'Stand up once each work hour',
  ],
  'Exercise consistently': [
    'Workout on 2 selected days',
    'Workout on 3 selected days',
    '20-minute home workout',
    'Lay out workout clothes the night before',
  ],
  'Improve mobility': [
    '5-minute morning stretch',
    '5-minute post-work stretch',
    'Stretch after each workout',
    '2-minute desk stretch at 3 PM',
  ],

  // Eat better
  'Eat more intentionally': [
    'Protein at breakfast',
    'Vegetables at lunch',
    'Vegetables at dinner',
    'No eating while scrolling',
  ],
  'Reduce overeating': [
    'No second helping at dinner',
    'One planned snack max',
    'No food after 9 PM',
    'Drink water before dinner',
  ],
  'Plan food better': [
    'Plan tomorrow’s meals tonight',
    'Prep lunch for tomorrow',
    'Buy groceries on selected day',
    'Pack a healthy snack',
  ],

  // Feel more energized
  'Have more morning energy': [
    'Get outside within 30 minutes of waking',
    'Drink water before coffee',
    'Eat breakfast within 90 minutes of waking',
    'No screens after 10 PM',
  ],
  'Avoid afternoon crashes': [
    '10-minute walk after lunch',
    'No caffeine after 2 PM',
    'Protein with lunch',
    'No sugary drink after lunch',
  ],
  'Keep energy more stable': [
    '2 liters of water',
    'Stand up once each work hour',
    'In bed by target bedtime',
    '15-minute walk',
  ],

  // Reduce stress
  'Feel calmer during the day': [
    '5-minute breathing session',
    '10-minute walk without phone',
    'No notifications during first work block',
    '2-minute reset at lunch',
  ],
  'Reduce evening stress': [
    'End work by target time',
    'Write tomorrow’s top 3 before bed',
    'No work email after target time',
    '10-minute wind-down',
  ],
  'Feel less overwhelmed': [
    'Capture all tasks in one list',
    'One 15-minute admin block',
    'Say no to one nonessential task',
    'Take one screen-free break',
  ],

  // Improve focus
  'Start work with less friction': [
    'Write top 3 priorities before starting work',
    'Phone in another room for first work block',
    'Start first work block by target time',
    'Desk cleared before first work block',
  ],
  'Do deeper work': [
    'One 45-minute focus block',
    'Two 45-minute focus blocks',
    'Notifications off during focus block',
    'No social media before lunch',
  ],
  'Procrastinate less': [
    'Start hardest task before checking messages',
    'Work 10 minutes on avoided task',
    'Block distracting sites during work hours',
    'Choose one must-do task the night before',
  ],

  // Break bad habits
  Smoking: [
    'No cigarettes today',
    'No smoking before noon',
    'Do urge delay before each cigarette',
    'Carry gum instead of cigarettes',
  ],
  Weed: [
    'No weed today',
    'No weed on weeknights',
    'No weed before 8 PM',
    'Replace evening use with 10-minute walk',
  ],
  Alcohol: [
    'No alcohol today',
    'No alcohol on weekdays',
    'Max 2 drinks on selected nights',
    'Order nonalcoholic first drink',
  ],
  Porn: [
    'No porn today',
    'No porn after 10 PM',
    'Phone stays out of bedroom',
    'Use blocker on selected devices',
  ],
  'Phone use': [
    'No phone during first 30 minutes after waking',
    'No phone during meals',
    'Phone outside bedroom',
    'Social apps under target minutes',
  ],
  'Late-night snacking': [
    'No calories after 9 PM',
    'Kitchen closed after dinner',
    'Brush teeth after dinner',
    'Prepare planned evening tea instead',
  ],
  Caffeine: [
    'No caffeine after 2 PM',
    'Max 2 caffeinated drinks',
    'Water before first caffeine',
    'No energy drinks',
  ],

  // Get more organized
  'Stay on top of tasks': [
    'Check task list before starting work',
    'Use one task list only',
    'Plan tomorrow before ending work',
    'Clear inbox to target number',
  ],
  'Keep spaces tidy': [
    '10-minute desk reset',
    '10-minute evening tidy',
    'Put clothes away before bed',
    'One weekly reset block',
  ],
  'Handle life admin better': [
    'Check calendar every morning',
    '15-minute admin block',
    'Pay bills on selected day',
    'Process mail and papers',
  ],
};

// ---------------------------------------------------------------------------
// Habit polarity (Build / Break). Explicit, catalog-sourced values so the
// coach word and the DB habit_type do not rely on a runtime regex guess.
// build = do more of it; break = stay away from it. See gg-spec/docs/habit-polarity.md.
// ---------------------------------------------------------------------------
export type HabitPolarity = 'build' | 'break';

export const habitPolarityByName: Record<string, HabitPolarity> = {
  // Fall asleep earlier
  'No caffeine after 2 PM': 'break',
  'No screens after 10 PM': 'break',
  'Start wind-down by 10 PM': 'build',
  'Be in bed by target bedtime': 'build',
  // Wake up earlier
  'Out of bed by target time': 'build',
  'No snooze': 'break',
  'Phone stays outside bedroom': 'build',
  'Lights out by target bedtime': 'build',
  // Sleep more consistently
  'Same bedtime within 30 minutes': 'build',
  'Same wake time within 30 minutes': 'build',
  'No screens in bed': 'break',
  'No food after 9 PM': 'break',
  // Sleep more deeply
  'Bedroom cool and dark before bed': 'build',
  'No alcohol on sleep nights': 'break',
  'No heavy meal within 2 hours of bed': 'break',
  'Read 10 pages before bed': 'build',
  // Walk more
  '8,000+ steps': 'build',
  '10-minute walk after lunch': 'build',
  '10-minute walk after dinner': 'build',
  'Stand up once each work hour': 'build',
  // Exercise consistently
  'Workout on 2 selected days': 'build',
  'Workout on 3 selected days': 'build',
  '20-minute home workout': 'build',
  'Lay out workout clothes the night before': 'build',
  // Improve mobility
  '5-minute morning stretch': 'build',
  '5-minute post-work stretch': 'build',
  'Stretch after each workout': 'build',
  '2-minute desk stretch at 3 PM': 'build',
  // Eat more intentionally
  'Protein at breakfast': 'build',
  'Vegetables at lunch': 'build',
  'Vegetables at dinner': 'build',
  'No eating while scrolling': 'break',
  // Reduce overeating
  'No second helping at dinner': 'break',
  'One planned snack max': 'break',
  'Drink water before dinner': 'build',
  // Plan food better
  'Plan tomorrow’s meals tonight': 'build',
  'Prep lunch for tomorrow': 'build',
  'Buy groceries on selected day': 'build',
  'Pack a healthy snack': 'build',
  // Have more morning energy
  'Get outside within 30 minutes of waking': 'build',
  'Drink water before coffee': 'build',
  'Eat breakfast within 90 minutes of waking': 'build',
  // Avoid afternoon crashes
  'Protein with lunch': 'build',
  'No sugary drink after lunch': 'break',
  // Keep energy more stable
  '2 liters of water': 'build',
  'In bed by target bedtime': 'build',
  '15-minute walk': 'build',
  // Feel calmer during the day
  '5-minute breathing session': 'build',
  '10-minute walk without phone': 'build',
  'No notifications during first work block': 'break',
  '2-minute reset at lunch': 'build',
  // Reduce evening stress
  'End work by target time': 'build',
  'Write tomorrow’s top 3 before bed': 'build',
  'No work email after target time': 'break',
  '10-minute wind-down': 'build',
  // Feel less overwhelmed
  'Capture all tasks in one list': 'build',
  'One 15-minute admin block': 'build',
  'Say no to one nonessential task': 'build',
  'Take one screen-free break': 'build',
  // Start work with less friction
  'Write top 3 priorities before starting work': 'build',
  'Phone in another room for first work block': 'build',
  'Start first work block by target time': 'build',
  'Desk cleared before first work block': 'build',
  // Do deeper work
  'One 45-minute focus block': 'build',
  'Two 45-minute focus blocks': 'build',
  'Notifications off during focus block': 'break',
  'No social media before lunch': 'break',
  // Procrastinate less
  'Start hardest task before checking messages': 'build',
  'Work 10 minutes on avoided task': 'build',
  'Block distracting sites during work hours': 'build',
  'Choose one must-do task the night before': 'build',
  // Smoking
  'No cigarettes today': 'break',
  'No smoking before noon': 'break',
  'Do urge delay before each cigarette': 'build',
  'Carry gum instead of cigarettes': 'build',
  // Weed
  'No weed today': 'break',
  'No weed on weeknights': 'break',
  'No weed before 8 PM': 'break',
  'Replace evening use with 10-minute walk': 'build',
  // Alcohol
  'No alcohol today': 'break',
  'No alcohol on weekdays': 'break',
  'Max 2 drinks on selected nights': 'break',
  'Order nonalcoholic first drink': 'build',
  // Porn
  'No porn today': 'break',
  'No porn after 10 PM': 'break',
  'Phone stays out of bedroom': 'build',
  'Use blocker on selected devices': 'build',
  // Phone use
  'No phone during first 30 minutes after waking': 'break',
  'No phone during meals': 'break',
  'Phone outside bedroom': 'build',
  'Social apps under target minutes': 'break',
  // Late-night snacking
  'No calories after 9 PM': 'break',
  'Kitchen closed after dinner': 'break',
  'Brush teeth after dinner': 'build',
  'Prepare planned evening tea instead': 'build',
  // Caffeine
  'Max 2 caffeinated drinks': 'break',
  'Water before first caffeine': 'build',
  'No energy drinks': 'break',
  // Stay on top of tasks
  'Check task list before starting work': 'build',
  'Use one task list only': 'build',
  'Plan tomorrow before ending work': 'build',
  'Clear inbox to target number': 'build',
  // Keep spaces tidy
  '10-minute desk reset': 'build',
  '10-minute evening tidy': 'build',
  'Put clothes away before bed': 'build',
  'One weekly reset block': 'build',
  // Handle life admin better
  'Check calendar every morning': 'build',
  '15-minute admin block': 'build',
  'Pay bills on selected day': 'build',
  'Process mail and papers': 'build',
};

const normKey = (s: string): string => s.toLowerCase().replace(/\s+/g, ' ').trim();

// Casing/spacing-tolerant index so a predefined habit that arrives from the LLM
// addHabit path with slightly different formatting still resolves to the map.
const normalizedPolarityByName: Record<string, HabitPolarity> = Object.fromEntries(
  Object.entries(habitPolarityByName).map(([k, v]) => [normKey(k), v]),
);

// Avoidance wording reads as break; everything else builds. Fallback for genuinely
// custom (user-spoken) habits that are not in the predefined catalog.
const BREAK_PATTERN =
  /\b(no|not|never|avoid|stop|quit|less|fewer|without|away|off|cut|reduce|limit|skip|ban|drop|ditch|unplug|put down|cut out|stay off)\b/i;

// Resolve a habit name to its polarity: exact catalog hit, then normalized
// (casing/spacing) hit, then the regex fallback for genuinely custom habits.
export function polarityForHabit(name: string): HabitPolarity {
  const exact = habitPolarityByName[name];
  if (exact) return exact;
  const normHit = normalizedPolarityByName[normKey(name)];
  if (normHit) return normHit;
  return BREAK_PATTERN.test(name) ? 'break' : 'build';
}

// Map a habit name to the DB user_habits.habit_type enum value.
export function dbHabitType(name: string): 'binary_build' | 'binary_break' {
  return polarityForHabit(name) === 'break' ? 'binary_break' : 'binary_build';
}
