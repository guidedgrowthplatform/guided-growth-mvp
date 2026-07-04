/**
 * Pure mapper for The Weekly's trailing-7-day grid. Extracted from useWeekData
 * so the cell-mapping logic is unit-testable without mounting React or hitting
 * the data service.
 *
 * Window: trailing 7 days ending TODAY (inclusive), oldest-first. This differs
 * from the Monday-first ISO week used elsewhere (getWeekRange/getWeekDays):
 * The Weekly always looks back over "the last 7 days", regardless of which
 * weekday it runs on.
 *
 * Cell rule (mirrors the skimmer WeeklyHabitsSummary + isHabitScheduledOnDate):
 *   - a completion row with status 'done'   -> 'done'
 *   - a completion row with status 'missed' -> 'missed'
 *   - scheduled that day, no row            -> 'gap'   (never reported)
 *   - not scheduled that day                -> 'off'
 *
 * NO EM DASHES. Pure module, no React, no IO.
 */
import type { HabitWeekCell } from '@/components/habit-detail/WeeklyHabitsSummary';
import type { Habit, HabitCompletion } from '@/lib/services/data-service.interface';
import { isHabitScheduledOnDate } from './useHabitsForDate';

export interface WeekGridRow {
  name: string;
  cells: HabitWeekCell[];
  done: number;
  scheduled: number;
}

export interface WeekGrid {
  overallPercent: number;
  overallDone: number;
  overallScheduled: number;
  rows: WeekGridRow[];
}

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']; // index = JS getDay(), 0=Sun

function fmtLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Trailing 7-day window ending on `today` (inclusive), oldest-first, as yyyy-MM-dd. */
export function trailingWeekDates(today: Date): string[] {
  const dates: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(fmtLocal(d));
  }
  return dates;
}

/** One-letter day labels matching trailingWeekDates's order. */
export function trailingWeekDayLabels(today: Date): string[] {
  return trailingWeekDates(today).map((dateStr) => {
    const dow = new Date(dateStr + 'T00:00:00').getDay();
    return DAY_LETTERS[dow];
  });
}

/**
 * Build the week grid for a set of habits + their completions over the given
 * trailing-window dates (oldest-first). Habits are assumed already filtered to
 * "active" by the caller (getHabits() already does this).
 */
export function buildWeekGrid(
  habits: Habit[],
  completions: HabitCompletion[],
  windowDates: string[],
): WeekGrid {
  const completionsByHabit = new Map<string, Map<string, HabitCompletion>>();
  for (const c of completions) {
    let byDate = completionsByHabit.get(c.habitId);
    if (!byDate) {
      byDate = new Map();
      completionsByHabit.set(c.habitId, byDate);
    }
    byDate.set(c.date, c);
  }

  let overallDone = 0;
  let overallScheduled = 0;

  const rows: WeekGridRow[] = habits.map((habit) => {
    const byDate = completionsByHabit.get(habit.id);
    let done = 0;
    let scheduled = 0;
    const cells: HabitWeekCell[] = windowDates.map((date) => {
      const isScheduled = isHabitScheduledOnDate(habit.scheduleDays, date);
      if (!isScheduled) return 'off';
      scheduled++;
      const row = byDate?.get(date);
      if (row?.status === 'done') {
        done++;
        return 'done';
      }
      if (row?.status === 'missed') return 'missed';
      return 'gap';
    });
    overallDone += done;
    overallScheduled += scheduled;
    return { name: habit.name, cells, done, scheduled };
  });

  const overallPercent =
    overallScheduled > 0 ? Math.round((overallDone / overallScheduled) * 100) : 0;

  return { overallPercent, overallDone, overallScheduled, rows };
}
