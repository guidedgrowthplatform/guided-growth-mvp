import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { queryKeys } from '@/lib/query';
import type { Habit, HabitCompletion } from '@/lib/services/data-service.interface';
import { getDataService } from '@/lib/services/service-provider';

export interface HabitDetailStats {
  completionRate: number;
  currentStreak: number;
  longestStreak: number;
  failedDays: number;
  totalRepetitions: number;
  sinceDate: string;
}

export type CalendarCell = { status: 'done' | 'missed' | 'empty' | 'today' | 'today-done'; day: number | null };

export interface HabitDetailData {
  habit: Habit | null;
  completions: HabitCompletion[];
  stats: HabitDetailStats;
  calendarMonth: string;
  calendarData: CalendarCell[][];
  activeDays: boolean[];
  frequencyLabel: string;
  isLoading: boolean;
  error: string | null;
}

const EMPTY_STATS: HabitDetailStats = {
  completionRate: 0,
  currentStreak: 0,
  longestStreak: 0,
  failedDays: 0,
  totalRepetitions: 0,
  sinceDate: '',
};

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function calcStreaks(dates: string[]): { current: number; longest: number } {
  if (dates.length === 0) return { current: 0, longest: 0 };

  const unique = [...new Set(dates)].sort();
  let longest = 0;
  let streak = 0;

  for (let i = 0; i < unique.length; i++) {
    if (i === 0) {
      streak = 1;
    } else {
      const prev = new Date(unique[i - 1]);
      const curr = new Date(unique[i]);
      const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
      streak = diff === 1 ? streak + 1 : 1;
    }
    longest = Math.max(longest, streak);
  }

  const today = todayStr();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  let current = 0;
  if (unique.includes(today) || unique.includes(yesterdayStr)) {
    const start = unique.includes(today) ? today : yesterdayStr;
    const checkDate = new Date(start);
    while (unique.includes(checkDate.toISOString().split('T')[0])) {
      current++;
      checkDate.setDate(checkDate.getDate() - 1);
    }
  }

  return { current, longest };
}

function parseCadence(
  frequency: string,
  scheduleDays: number[] | null,
): { activeDays: boolean[]; label: string } {
  if (scheduleDays && scheduleDays.length > 0) {
    const activeDays = Array(7).fill(false) as boolean[];
    for (const d of scheduleDays) activeDays[d] = true;
    return { activeDays, label: `${scheduleDays.length}x / week` };
  }

  const allDays = [true, true, true, true, true, true, true];
  const weekdays = [false, true, true, true, true, true, false];

  switch (frequency) {
    case 'daily':
      return { activeDays: allDays, label: '7x / week' };
    case 'weekdays':
      return { activeDays: weekdays, label: '5x / week (weekdays)' };
    case '3_specific_days':
    case '3x/week':
      return {
        activeDays: [false, true, false, true, false, true, false],
        label: '3x / week',
      };
    case 'once_a_week':
    case 'weekly':
      return {
        activeDays: [false, true, false, false, false, false, false],
        label: '1x / week',
      };
    default:
      return { activeDays: allDays, label: frequency };
  }
}

function buildCalendarGrid(
  completionDates: Set<string>,
  activeDays: boolean[],
  startDate: string,
): { month: string; grid: CalendarCell[][] } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const monthName = now.toLocaleString('en-US', { month: 'long' });

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const today = todayStr();

  const grid: CalendarCell[][] = [];
  const startOffset = firstDay.getDay();

  for (let week = 0; week < 5; week++) {
    const row: CalendarCell[] = [];
    for (let dow = 0; dow < 7; dow++) {
      const dayNum = week * 7 + dow - startOffset + 1;
      if (dayNum < 1 || dayNum > lastDay.getDate()) {
        row.push({ status: 'empty', day: null });
        continue;
      }

      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;

      if (dateStr < startDate || dateStr > today) {
        row.push({ status: 'empty', day: dayNum });
        continue;
      }

      if (!activeDays[dow]) {
        row.push({ status: 'empty', day: dayNum });
        continue;
      }

      if (dateStr === today) {
        row.push({ status: completionDates.has(dateStr) ? 'today-done' : 'today', day: dayNum });
      } else {
        row.push({ status: completionDates.has(dateStr) ? 'done' : 'missed', day: dayNum });
      }
    }
    grid.push(row);
  }

  return { month: monthName, grid };
}

export function useHabitDetail(habitId: string | undefined): HabitDetailData {
  const habitQuery = useQuery({
    queryKey: queryKeys.habits.detail(habitId ?? ''),
    queryFn: async () => {
      const ds = await getDataService();
      return ds.getHabitById(habitId!);
    },
    enabled: !!habitId,
  });

  const startStr = useMemo(() => {
    const start = new Date();
    start.setDate(start.getDate() - 90);
    return start.toISOString().split('T')[0];
  }, []);

  const completionsQuery = useQuery({
    queryKey: queryKeys.habits.completions(habitId ?? '', startStr),
    queryFn: async () => {
      const ds = await getDataService();
      return ds.getCompletions(habitId!, startStr, todayStr());
    },
    enabled: !!habitId && !!habitQuery.data,
  });

  const habit = habitQuery.data ?? null;
  const completions = completionsQuery.data ?? [];
  const isLoading = habitQuery.isLoading || completionsQuery.isLoading;
  const queryError = habitQuery.error || completionsQuery.error;
  const error = !habitId
    ? null
    : habitQuery.data === null && !habitQuery.isLoading
      ? 'Habit not found'
      : queryError
        ? (queryError as Error).message
        : null;

  const dates = completions.map((c) => c.date);
  const { current: currentStreak, longest: longestStreak } = calcStreaks(dates);

  const { activeDays, label: frequencyLabel } = habit
    ? parseCadence(habit.frequency, habit.scheduleDays)
    : { activeDays: Array(7).fill(true) as boolean[], label: '' };

  const completionDates = new Set(dates);
  const habitStartDate = habit ? habit.createdAt.split('T')[0] : todayStr();
  const { month: calendarMonth, grid: calendarData } = buildCalendarGrid(
    completionDates,
    activeDays,
    habitStartDate,
  );

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();
  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
  const startDay = habitStartDate.startsWith(monthStr)
    ? parseInt(habitStartDate.split('-')[2], 10)
    : 1;
  let activeDaysCount = 0;
  let missedCount = 0;

  for (let d = startDay; d <= today; d++) {
    const dow = new Date(year, month, d).getDay();
    if (activeDays[dow]) {
      activeDaysCount++;
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (!completionDates.has(dateStr)) {
        missedCount++;
      }
    }
  }

  const completionRate =
    activeDaysCount > 0 ? Math.round(((activeDaysCount - missedCount) / activeDaysCount) * 100) : 0;

  const stats: HabitDetailStats = habit
    ? {
        completionRate,
        currentStreak,
        longestStreak,
        failedDays: missedCount,
        totalRepetitions: completionDates.size,
        sinceDate: new Date(habit.createdAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
      }
    : EMPTY_STATS;

  return {
    habit,
    completions,
    stats,
    calendarMonth,
    calendarData,
    activeDays,
    frequencyLabel,
    isLoading,
    error,
  };
}
