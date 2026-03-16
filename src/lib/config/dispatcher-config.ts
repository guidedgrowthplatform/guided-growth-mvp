/**
 * Configuration for ActionDispatcher — externalised from hardcoded values.
 * Edit this file to add language support, change icons, or expand suggestions.
 */

/** Day name → index mapping. Extend with additional languages as needed. */
export const DAY_NAMES: Record<string, number> = {
  // English
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
  // Spanish
  domingo: 0,
  lunes: 1,
  martes: 2,
  miércoles: 3,
  jueves: 4,
  viernes: 5,
  sábado: 6,
  // Indonesian
  minggu: 0,
  senin: 1,
  selasa: 2,
  rabu: 3,
  kamis: 4,
  jumat: 5,
  sabtu: 6,
};

/** Habit suggestions pool. The dispatcher picks a random one not already in use. */
export const HABIT_SUGGESTIONS: string[] = [
  'journaling',
  'stretching',
  'hydration tracking',
  'gratitude practice',
  'deep breathing',
  'walking',
  'meal prep',
  'digital detox',
  'cold shower',
  'reading',
  'yoga',
  'no phone before bed',
];

/** Default suggestion when all pool items are already in use. */
export const DEFAULT_SUGGESTION = 'mindful breaks';

/**
 * Status icons used in user-facing messages.
 * Replace with Lucide icon names or any prefix you prefer.
 */
export const MSG = {
  success: '[OK]',
  error: '[ERROR]',
  warning: '[WARNING]',
  info: '[INFO]',
  journal: '[JOURNAL]',
  suggest: '[IDEA]',
  trophy: '[BEST]',
  chart: '[STATS]',
  list: '[LIST]',
} as const;
