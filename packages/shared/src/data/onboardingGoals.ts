// Single source of truth: onboarding category → allowed goals.
// Sourced from the approved Google Sheet. Imported by both the Vite frontend
// (src/data/onboardingHabits.ts) and the serverless submit_goals handler.

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
