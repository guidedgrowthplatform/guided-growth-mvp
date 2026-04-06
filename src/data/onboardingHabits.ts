/**
 * Single source of truth for onboarding categories → subcategories → habits.
 * Sourced from the approved Google Sheet.
 */

export const goalsByCategory: Record<string, string[]> = {
  'Sleep better': [
    'Fall asleep earlier',
    'Wake up earlier',
    'Sleep more consistently',
    'Sleep more deeply',
  ],
  'Move more': ['Walk more', 'Exercise consistently', 'Improve mobility'],
  'Eat better': ['Eat more intentionally', 'Reduce overeating', 'Plan food better'],
  'Feel more energized': [
    'Have more morning energy',
    'Avoid afternoon crashes',
    'Keep energy more stable',
  ],
  'Reduce stress': ['Feel calmer during the day', 'Reduce evening stress', 'Feel less overwhelmed'],
  'Improve focus': ['Start work with less friction', 'Do deeper work', 'Procrastinate less'],
  'Break bad habits': [
    'Smoking',
    'Weed',
    'Alcohol',
    'Porn',
    'Phone use',
    'Late-night snacking',
    'Caffeine',
  ],
  'Get more organized': ['Stay on top of tasks', 'Keep spaces tidy', 'Handle life admin better'],
};

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
    'Plan tomorrow\u2019s meals tonight',
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
    'Write tomorrow\u2019s top 3 before bed',
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
