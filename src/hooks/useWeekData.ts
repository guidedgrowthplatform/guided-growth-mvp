/**
 * useWeekData: the trailing 7-day week (ending today, inclusive) for The
 * Weekly's week-grid beat. Wraps buildWeekGrid (useWeekData.mapper.ts) with
 * the house data-fetching pattern (react-query + getDataService()), mirroring
 * useHabitAnalytics.ts / useHabitsForDate.ts.
 *
 * loggedDays / thinData: how many of the 7 days have a daily_checkins row
 * (any of sleep/mood/energy/stress filled). Thin state data is the honest
 * nudge the weekly-insights beat context calls for ("that data would
 * genuinely help us see what is going on, try logging it this week").
 *
 * NO EM DASHES.
 */
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { queryKeys } from '@/lib/query';
import { getDataService } from '@/lib/services/service-provider';
import { useAuthStore } from '@/stores/authStore';
import {
  buildWeekGrid,
  trailingWeekDates,
  trailingWeekDayLabels,
  type WeekGrid,
} from './useWeekData.mapper';

// A day counts as "logged" (state data present) if any check-in dimension was filled.
const THIN_DATA_THRESHOLD = 3;

export interface UseWeekDataResult {
  loading: boolean;
  error: string | null;
  grid: WeekGrid;
  dayLabels: string[];
  loggedDays: number;
  thinData: boolean;
}

const EMPTY_GRID: WeekGrid = { overallPercent: 0, overallDone: 0, overallScheduled: 0, rows: [] };

export function useWeekData(): UseWeekDataResult {
  const anonId = useAuthStore((s) => s.anonId);

  const today = useMemo(() => new Date(), []);
  const windowDates = useMemo(() => trailingWeekDates(today), [today]);
  const dayLabels = useMemo(() => trailingWeekDayLabels(today), [today]);
  const startDate = windowDates[0];
  const endDate = windowDates[windowDates.length - 1];

  const habitsQuery = useQuery({
    queryKey: queryKeys.habits.all,
    queryFn: async () => {
      const svc = await getDataService();
      return svc.getHabits();
    },
    enabled: !!anonId,
  });

  const completionsQuery = useQuery({
    queryKey: queryKeys.habits.allCompletions(startDate, endDate),
    queryFn: async () => {
      const svc = await getDataService();
      return svc.getAllCompletions(startDate, endDate);
    },
    enabled: !!anonId,
  });

  const checkInsQuery = useQuery({
    queryKey: queryKeys.checkins.range(startDate, endDate),
    queryFn: async () => {
      const svc = await getDataService();
      return svc.getCheckIns(startDate, endDate);
    },
    enabled: !!anonId,
  });

  const grid = useMemo(
    () =>
      habitsQuery.data
        ? buildWeekGrid(habitsQuery.data, completionsQuery.data ?? [], windowDates)
        : EMPTY_GRID,
    [habitsQuery.data, completionsQuery.data, windowDates],
  );

  const loggedDays = useMemo(() => {
    const checkIns = checkInsQuery.data ?? [];
    const loggedDates = new Set(
      checkIns
        .filter((c) => c.sleep != null || c.mood != null || c.energy != null || c.stress != null)
        .map((c) => c.date),
    );
    return windowDates.filter((d) => loggedDates.has(d)).length;
  }, [checkInsQuery.data, windowDates]);

  const loading = habitsQuery.isLoading || completionsQuery.isLoading || checkInsQuery.isLoading;

  const error = habitsQuery.error || completionsQuery.error || checkInsQuery.error;

  return {
    loading,
    error: error ? (error as Error).message : null,
    grid,
    dayLabels,
    loggedDays,
    thinData: loggedDays < THIN_DATA_THRESHOLD,
  };
}
