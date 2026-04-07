/**
 * Configuration for ActionDispatcher — externalised from hardcoded values.
 * Edit this file to add language support, change icons, or expand suggestions.
 *
 * COACHING: Conversational AI responses matching Voice Journey Spreadsheet v3.
 * Style: warm, concise, coaching. Not robotic. Not generic. Personal.
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
 */
export const MSG = {
  success: '✓',
  error: '✗',
  warning: '⚠',
  info: 'ℹ',
  journal: '📔',
  suggest: '💡',
  trophy: '🏆',
  chart: '📊',
  list: '📋',
} as const;

/**
 * Coaching-style message templates matching Voice Journey Spreadsheet v3.
 * These make the AI sound like a personal coach, not a robot.
 *
 * Philosophy from spreadsheet:
 * - "We're not fighting the part of you that has resistance.
 *    We're strengthening the part of you that showed up today."
 * - Validate, don't praise generically. Say WHY, not "Great choice!"
 * - Short, confident. "Locked in." "Done." "You're in."
 */
export const COACHING = {
  // Create responses
  habitCreated: (name: string, freq: string) =>
    `Done — "${name}" is set up (${freq}). One habit done consistently beats five that don't stick. You picked well.`,
  habitCreatedShort: (name: string) => `"${name}" is live. Let's make it stick.`,

  // Complete responses
  habitCompleted: (name: string) =>
    `Marked "${name}" done. That's you showing up. The part of you that wanted to do this — it won today.`,
  habitCompletedStreak: (name: string, streak: number) =>
    `"${name}" done — ${streak}-day streak. That's not luck, that's you.`,

  // Delete responses (anti-guilt per spreadsheet)
  habitDeleted: (name: string) =>
    `"${name}" removed. No judgment — sometimes it's the right call to refocus.`,

  // Update responses
  habitUpdated: (name: string) => `Updated "${name}". How's that now?`,

  // Check-in responses (per spreadsheet: evening references morning)
  checkinMorning: (parts: string) =>
    `Got it — ${parts}. What's one thing you want to make sure happens today?`,
  checkinEvening: (parts: string) =>
    `Noted — ${parts}. You showed up today. That's exactly how this works.`,
  checkinGeneric: (parts: string) => `Check-in saved — ${parts}. I see you.`,

  // Journal/Reflect
  journalSaved: () => `Journal saved. These compound over time in a way that surprises people.`,

  // Focus
  focusStarted: (duration: number, habit?: string) =>
    habit
      ? `${duration} minutes of ${habit}. Timer starts now. Go.`
      : `${duration}-minute focus session. Go.`,

  // Query/Stats
  statsIntro: (habitName: string) => `Here's where you're at with "${habitName}":`,

  // Suggestions
  suggestion: (name: string) =>
    `How about "${name}"? Small shifts change everything. Say "create a habit called ${name}" if it feels right.`,

  // Errors — friendly, never technical
  notFound: (entity: string, name: string) =>
    `I couldn't find ${entity === 'habit' ? 'a habit' : 'a metric'} called "${name}". Could you say the name again?`,
  askName: (entity: string) =>
    entity === 'habit'
      ? `Sure! What would you like to call this habit? Just say the name.`
      : `What would you like to track? Tell me the name.`,
  duplicate: (name: string) => `You already have "${name}". Want to update it instead?`,
  generic: () => `Something went wrong on my end. Let me try that again.`,

  // Milestone celebrations (from spreadsheet)
  milestone7: (name: string) =>
    `One week of "${name}". You showed up seven days in a row. That's not luck — that's you.`,
  milestone30: (name: string) =>
    `30 days of "${name}". This started as something you were trying. Now it's something you do. That's a real shift.`,
} as const;
