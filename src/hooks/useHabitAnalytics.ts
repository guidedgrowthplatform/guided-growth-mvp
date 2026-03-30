import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { queryKeys } from '@/lib/query';
import type { Habit, HabitCompletion, HabitSummary } from '@/lib/services/data-service.interface';
import { getDataService } from '@/lib/services/service-provider';
import type { BarDataPoint, CompletionStats, HabitPerformance } from './useHabitAnalytics.types';

export type { BarDataPoint, CompletionStats, HabitPerformance };

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function dateNDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

function getDayOfWeek(dateStr: string): number {
  return new Date(dateStr + 'T00:00:00').getDay(); // 0=Sun..6=Sat
}

const DAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function computeCompletionByRange(
  habits: Habit[],
  completions: HabitCompletion[],
): Record<string, CompletionStats> {
  const today = todayStr();
  const totalHabits = habits.length || 1;

  // Week stats
  const weekStart = dateNDaysAgo(6);
  const weekCompletions = completions.filter((c) => c.date >= weekStart && c.date <= today);
  const weekDayCounts = new Array(7).fill(0);
  for (const c of weekCompletions) {
    const dow = getDayOfWeek(c.date);
    weekDayCounts[dow]++;
  }
  const weekBars: BarDataPoint[] = DAY_LABELS.map((label, i) => ({
    label,
    value: Math.max(weekDayCounts[i], 1), // min 1 so bars render
  }));
  const weekPct =
    totalHabits > 0 ? Math.round((new Set(weekCompletions.map((c) => c.date)).size / 7) * 100) : 0;

  // Month stats
  const monthStart = dateNDaysAgo(29);
  const monthCompletions = completions.filter((c) => c.date >= monthStart && c.date <= today);
  const weekBuckets = [0, 0, 0, 0];
  for (const c of monthCompletions) {
    const daysAgo = Math.floor((new Date(today).getTime() - new Date(c.date).getTime()) / 86400000);
    const weekIdx = Math.min(3, Math.floor(daysAgo / 7));
    weekBuckets[3 - weekIdx]++;
  }
  const monthBars: BarDataPoint[] = weekBuckets.map((v, i) => ({
    label: `W${i + 1}`,
    value: Math.max(v, 1),
  }));
  const monthPct =
    totalHabits > 0
      ? Math.round((new Set(monthCompletions.map((c) => c.date)).size / 30) * 100)
      : 0;

  // Year stats (last 12 months, simplified)
  const MONTH_LABELS = [
    'JAN',
    'FEB',
    'MAR',
    'APR',
    'MAY',
    'JUN',
    'JUL',
    'AUG',
    'SEP',
    'OCT',
    'NOV',
    'DEC',
  ];
  const yearStart = dateNDaysAgo(364);
  const yearCompletions = completions.filter((c) => c.date >= yearStart && c.date <= today);
  const monthCounts = new Array(12).fill(0);
  for (const c of yearCompletions) {
    const month = new Date(c.date + 'T00:00:00').getMonth();
    monthCounts[month]++;
  }
  const yearBars: BarDataPoint[] = MONTH_LABELS.map((label, i) => ({
    label,
    value: Math.max(monthCounts[i], 1),
  }));
  const yearPct =
    totalHabits > 0
      ? Math.round((new Set(yearCompletions.map((c) => c.date)).size / 365) * 100)
      : 0;

  return {
    week: {
      percentage: weekPct,
      trend: weekPct > 0 ? `+${weekPct}%` : '0%',
      trendPositive: weekPct >= 50,
      subtitle: 'Average Completion',
      bars: weekBars,
    },
    month: {
      percentage: monthPct,
      trend: monthPct > 0 ? `+${monthPct}%` : '0%',
      trendPositive: monthPct >= 50,
      subtitle: 'Monthly Average',
      bars: monthBars,
    },
    year: {
      percentage: yearPct,
      trend: yearPct > 0 ? `+${yearPct}%` : '0%',
      trendPositive: yearPct >= 50,
      subtitle: 'Yearly Average',
      bars: yearBars,
    },
  };
}

function computeHabitPerformance(
  summaries: HabitSummary[],
  completions: HabitCompletion[],
): HabitPerformance[] {
  return summaries.map((s) => {
    const habitCompletions = completions.filter((c) => c.habitId === s.habit.id);
    const weeklyData = new Array(7).fill(0);
    const today = todayStr();
    const weekStart = dateNDaysAgo(6);

    for (const c of habitCompletions) {
      if (c.date >= weekStart && c.date <= today) {
        weeklyData[getDayOfWeek(c.date)] += 100;
      }
    }

    // Find best day
    const maxIdx = weeklyData.indexOf(Math.max(...weeklyData));
    const bestDay = DAY_NAMES[maxIdx] || 'N/A';

    return {
      name: s.habit.name,
      percentage: Math.round(s.completionRate),
      streak: `${s.currentStreak} day streak`,
      weeklyData,
      bestDay,
      totalCompletions: s.completionsThisPeriod,
    };
  });
}

export function useHabitAnalytics() {
  const habitsQuery = useQuery({
    queryKey: queryKeys.habits.all,
    queryFn: async () => {
      const svc = await getDataService();
      return svc.getHabits();
    },
  });

  const startDate = dateNDaysAgo(364);
  const endDate = todayStr();

  const completionsQuery = useQuery({
    queryKey: queryKeys.habits.allCompletions(startDate, endDate),
    queryFn: async () => {
      const svc = await getDataService();
      return svc.getAllCompletions(startDate, endDate);
    },
    enabled: !!habitsQuery.data,
  });

  const summariesQuery = useQuery({
    queryKey: [...queryKeys.habits.all, 'summaries'],
    queryFn: async () => {
      const svc = await getDataService();
      const habits = await svc.getHabits();
      return Promise.all(habits.map((h) => svc.getHabitSummary(h.id, 'month')));
    },
    enabled: !!habitsQuery.data,
  });

  const completionByRange = useMemo(
    () => computeCompletionByRange(habitsQuery.data ?? [], completionsQuery.data ?? []),
    [habitsQuery.data, completionsQuery.data],
  );

  const habitStats = useMemo(
    () => computeHabitPerformance(summariesQuery.data ?? [], completionsQuery.data ?? []),
    [summariesQuery.data, completionsQuery.data],
  );

  const isLoading = habitsQuery.isLoading || completionsQuery.isLoading || summariesQuery.isLoading;
  const error = habitsQuery.error || completionsQuery.error || summariesQuery.error;

  return {
    habitStats,
    completionByRange,
    isLoading,
    error: error ? (error as Error).message : null,
  };
}
