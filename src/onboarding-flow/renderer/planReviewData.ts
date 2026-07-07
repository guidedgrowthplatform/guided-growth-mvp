/**
 * planReviewData - pure helpers for the ONBOARD-COMPLETE plan review + edit
 * screen. No React, no IO: derives the display rows from the flow answers,
 * resolves the path-aware habit cap, and builds the updated habitConfigs map an
 * edit persists (a full-map replace, matching saveStep's per-key JSONB merge).
 *
 * NO EM DASHES.
 */
import { formatCadence } from '@/components/onboarding/constants';
import type { HabitType, OnboardingPath } from '@gg/shared/types';
import { MAX_HABITS_ONBOARDING } from '../flowData';
import type { FlowAnswers } from '../types';

// Serialized habit config as it lives in answers / onboarding_states.data. days
// is number[] on a real walk (card adapters store [...set]) and after a resume
// (JSON), but a Set can slip through from an in-memory capture, so normalize.
export interface PlanHabit {
  name: string;
  days: number[];
  time: string;
  reminder: boolean;
  habitType?: HabitType;
}

export interface PlanRitual {
  time: string;
  days: number[];
  reminder: boolean;
}

const DEFAULT_TIME = '09:00';
const WEEKDAY_DAYS = [1, 2, 3, 4, 5];

// Advanced (braindump) path has no product cap, only a generous safety ceiling
// (mirrors api/_lib/llm/onboarding/schemas.ts MAX_HABITS_ADVANCED / ruling B37).
export const ADVANCED_HABIT_CAP = 50;

const DAY_FULL_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

function toDayArray(days: number[] | Set<number> | undefined): number[] {
  if (Array.isArray(days)) return [...days];
  if (days) return [...days];
  return [];
}

/** The user's captured habits as display rows, in insertion order. */
export function planHabitsFromAnswers(answers: FlowAnswers): PlanHabit[] {
  const cfgs = (answers.habitConfigs ?? {}) as Record<
    string,
    { days?: number[] | Set<number>; time?: string; reminder?: boolean; habitType?: HabitType }
  >;
  return Object.entries(cfgs).map(([name, c]) => ({
    name,
    days: toDayArray(c.days),
    time: c.time ?? DEFAULT_TIME,
    reminder: c.reminder ?? true,
    habitType: c.habitType,
  }));
}

/** The evening reflection ritual row, or null when none is configured. */
export function reflectionRitual(answers: FlowAnswers): PlanRitual | null {
  const r = answers.reflectionConfig;
  if (!r) return null;
  return { time: r.time, days: toDayArray(r.days), reminder: r.reminder };
}

/** The morning check-in ritual row, or null (never for an explicit skip). */
export function morningRitual(answers: FlowAnswers): PlanRitual | null {
  const m = answers.morningCheckin;
  if (!m) return null;
  return { time: m.time, days: toDayArray(m.days), reminder: m.reminder };
}

/** The Weekly review day (0-6), or null when unset. */
export function weeklyDay(answers: FlowAnswers): number | null {
  const day = answers.weeklyConfig?.day;
  return typeof day === 'number' && day >= 0 && day <= 6 ? day : null;
}

export function weeklyDayName(day: number): string {
  return DAY_FULL_NAMES[day] ?? '';
}

/** Habit cap for the review add affordance: beginner 2, advanced the ceiling. */
export function habitCapForPath(path: OnboardingPath | null | undefined): number {
  return path === 'braindump' ? ADVANCED_HABIT_CAP : MAX_HABITS_ONBOARDING;
}

/** Human cadence label ("Daily", "Weekdays", "3 days/week") for a day set. */
export function cadenceLabel(days: number[]): string {
  return formatCadence(new Set(days));
}

/** Rule line for a plan row (matches the old PlanReviewPage phrasing). */
export function ruleLabel(time: string, reminder: boolean): string {
  return reminder ? `Reminder at ${time}` : `At ${time}`;
}

type HabitConfigMap = NonNullable<FlowAnswers['habitConfigs']>;
type HabitConfig = HabitConfigMap[string];

function currentConfigs(answers: FlowAnswers): Record<string, HabitConfig> {
  return { ...((answers.habitConfigs ?? {}) as Record<string, HabitConfig>) };
}

/**
 * Match a name against the existing habit keys case-insensitively (the tools
 * key off the stored name; the UI passes the exact stored name, but a voice
 * result may differ in case). Returns the stored key or undefined.
 */
function matchKey(configs: Record<string, HabitConfig>, name: string): string | undefined {
  const target = name.trim().toLowerCase();
  return Object.keys(configs).find((k) => k.toLowerCase() === target);
}

/** New habitConfigs map with `name` removed (case-insensitive). */
export function habitConfigsWithRemoved(answers: FlowAnswers, name: string): HabitConfigMap {
  const configs = currentConfigs(answers);
  const key = matchKey(configs, name);
  if (key) delete configs[key];
  return configs;
}

/** New habitConfigs map with a field patch merged into `name`'s config. */
export function habitConfigsWithPatch(
  answers: FlowAnswers,
  name: string,
  patch: Partial<PlanHabit>,
): HabitConfigMap {
  const configs = currentConfigs(answers);
  const key = matchKey(configs, name);
  if (!key) return configs;
  const existing = configs[key];
  const nextDays = patch.days ?? toDayArray(existing.days);
  configs[key] = {
    ...existing,
    ...(patch.days !== undefined ? { days: patch.days } : {}),
    ...(patch.time !== undefined ? { time: patch.time } : {}),
    ...(patch.reminder !== undefined ? { reminder: patch.reminder } : {}),
    ...(patch.habitType !== undefined ? { habitType: patch.habitType } : {}),
    // Keep schedule label in sync with days (mirrors updateHabit server-side).
    schedule: scheduleLabelFor(nextDays),
  };
  return configs;
}

/**
 * New habitConfigs map with a default-config habit appended under `name`. No-op
 * (returns the current map) when the name is blank or already present, so a
 * duplicate add never overwrites the existing schedule.
 */
export function habitConfigsWithAdded(answers: FlowAnswers, name: string): HabitConfigMap {
  const trimmed = name.trim();
  const configs = currentConfigs(answers);
  if (!trimmed || matchKey(configs, trimmed)) return configs;
  configs[trimmed] = {
    days: [...WEEKDAY_DAYS],
    time: DEFAULT_TIME,
    reminder: true,
    schedule: 'Weekday',
  };
  return configs;
}

// Canonical schedule label for a day set, matching the app's preset vocabulary
// (Weekday / Weekend / Every day), else a plain "Custom" so downstream never
// reads a stale preset after a manual day toggle.
function scheduleLabelFor(days: number[]): string {
  const set = new Set(days);
  if (set.size === 7) return 'Every day';
  if (days.length === 5 && WEEKDAY_DAYS.every((d) => set.has(d))) return 'Weekday';
  if (set.size === 2 && set.has(0) && set.has(6)) return 'Weekend';
  return 'Custom';
}
