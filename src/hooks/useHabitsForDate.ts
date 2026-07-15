import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo } from 'react';
import { useSessionLog } from '@/hooks/useSessionLog';
import type { Habit, HabitCompletion, HabitDayStatus } from '@/lib/services/data-service.interface';
import { getDataService } from '@/lib/services/service-provider';
import { useAuthStore } from '@/stores/authStore';

export interface HabitWithStatus {
  habit: Habit;
  status: HabitDayStatus;
  completed: boolean;
  streak: number;
}

const HABITS_FOR_DATE_KEY = 'habitsForDate';

function fmtLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Returns true iff the habit was created on or before `selectedDate` in the
 * user's local timezone. `habit.createdAt` is a UTC ISO timestamp from
 * Postgres `timestamptz`; we convert it to a local-tz yyyy-MM-dd then do a
 * string compare (lexicographic compare is safe for that format).
 *
 * Inclusive on the creation date itself — a habit created on May 26 shows
 * starting May 26.
 *
 * Exported for unit-testing the timezone edge cases.
 */
export function isHabitVisibleOnDate(createdAtIso: string, selectedDate: string): boolean {
  const created = new Date(createdAtIso);
  if (Number.isNaN(created.getTime())) {
    // Malformed createdAt — fail open (show the habit) so we never hide real data
    // due to a parse glitch; this matches prior behavior.
    return true;
  }
  const createdLocal = fmtLocal(created);
  return createdLocal <= selectedDate;
}

// scheduleDays null/empty = cadence-default (show daily). date's weekday read
// as a LOCAL day so the schedule matches the user's calendar, not UTC.
export function isHabitScheduledOnDate(
  scheduleDays: number[] | null | undefined,
  date: string,
): boolean {
  if (!scheduleDays || scheduleDays.length === 0) return true;
  const dow = new Date(date + 'T00:00:00').getDay();
  return scheduleDays.includes(dow);
}

// Rule 7: a rest day BRIDGES the flame streak (skipped, not counted) rather than
// breaking it; a done day counts, anything else (missed/pending) stops the run.
export function calcCurrentStreak(completions: HabitCompletion[], fromDate: string): number {
  const done = new Set(completions.filter((c) => c.status === 'done').map((c) => c.date));
  if (done.size === 0) return 0;
  const rest = new Set(completions.filter((c) => c.status === 'rest').map((c) => c.date));
  let streak = 0;
  const checkDate = new Date(fromDate + 'T00:00:00');
  while (true) {
    const d = fmtLocal(checkDate);
    if (done.has(d)) streak++;
    else if (!rest.has(d)) break;
    checkDate.setDate(checkDate.getDate() - 1);
  }
  return streak;
}

// Streak shown in the UI: stays "alive" through yesterday while today is still
// pending — so an unbroken run displays a (grey) flame + count before the user
// completes today, then turns colored + increments on completion. When `date`
// isn't completed, count the run ending the day before instead.
export function calcDisplayStreak(completions: HabitCompletion[], date: string): number {
  if (completions.some((c) => c.date === date && c.status === 'done'))
    return calcCurrentStreak(completions, date);
  const prev = new Date(date + 'T00:00:00');
  prev.setDate(prev.getDate() - 1);
  return calcCurrentStreak(completions, fmtLocal(prev));
}

async function loadHabitsForDate(date: string): Promise<HabitWithStatus[]> {
  const ds = await getDataService();
  const allHabits = await ds.getHabits();

  // Hide habits that didn't exist yet on `date` (issue #173). Prevents the
  // newly-created habit from appearing on prior dates and skewing
  // completion analytics.
  const visibleHabits = allHabits.filter(
    (habit) =>
      isHabitVisibleOnDate(habit.createdAt, date) &&
      isHabitScheduledOnDate(habit.scheduleDays, date),
  );

  const streakStart = new Date(date + 'T00:00:00');
  streakStart.setDate(streakStart.getDate() - 30);
  const streakStartStr = fmtLocal(streakStart);

  const allCompletions = await ds.getAllCompletions(streakStartStr, date);
  const byHabit = new Map<string, HabitCompletion[]>();
  for (const c of allCompletions) {
    const arr = byHabit.get(c.habitId) ?? [];
    arr.push(c);
    byHabit.set(c.habitId, arr);
  }

  return visibleHabits.map((habit) => {
    const habitCompletions = byHabit.get(habit.id) ?? [];
    const row = habitCompletions.find((c) => c.date === date);
    const status: HabitDayStatus = row ? row.status : 'pending';
    return {
      habit,
      status,
      completed: status === 'done',
      streak: calcDisplayStreak(habitCompletions, date),
    };
  });
}

export function useHabitsForDate(date: string, screenId?: string) {
  const qc = useQueryClient();
  const { logEvent } = useSessionLog();
  const anonId = useAuthStore((s) => s.anonId);
  const queryKey = useMemo(() => [HABITS_FOR_DATE_KEY, date] as const, [date]);

  const query = useQuery({
    queryKey,
    queryFn: () => loadHabitsForDate(date),
    enabled: !!anonId,
  });

  useEffect(() => {
    const handler = () => qc.invalidateQueries({ queryKey: [HABITS_FOR_DATE_KEY] });
    window.addEventListener('habits-changed', handler);
    return () => window.removeEventListener('habits-changed', handler);
  }, [qc]);

  const statusMutation = useMutation({
    mutationFn: async ({ habitId, next }: { habitId: string; next: HabitDayStatus }) => {
      const ds = await getDataService();
      if (next === 'done') await ds.completeHabit(habitId, date);
      else if (next === 'missed') await ds.missHabit(habitId, date);
      else if (next === 'rest') await ds.restHabit(habitId, date);
      else await ds.clearHabit(habitId, date);
      return { habitId, next };
    },
    onMutate: async ({ habitId, next }) => {
      await qc.cancelQueries({ queryKey });
      const prev = qc.getQueryData<HabitWithStatus[]>(queryKey);
      qc.setQueryData<HabitWithStatus[]>(queryKey, (old) =>
        (old ?? []).map((h) =>
          h.habit.id === habitId ? { ...h, status: next, completed: next === 'done' } : h,
        ),
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKey, ctx.prev);
    },
    onSuccess: ({ habitId, next }) => {
      if (next === 'done') {
        logEvent(
          'habit_completed',
          { habit_id: habitId, completed_at: new Date().toISOString(), via: 'tap' },
          screenId,
        );
      } else if (next === 'missed') {
        logEvent(
          'habit_missed',
          { habit_id: habitId, missed_at: new Date().toISOString(), via: 'tap' },
          screenId,
        );
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey });
    },
  });

  const setHabitStatus = useCallback(
    (habitId: string, next: HabitDayStatus) => statusMutation.mutateAsync({ habitId, next }),
    [statusMutation],
  );

  const reload = useCallback(() => qc.invalidateQueries({ queryKey }), [qc, queryKey]);

  return {
    habits: query.data ?? [],
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    setHabitStatus,
    reload,
  };
}
