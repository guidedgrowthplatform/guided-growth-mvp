import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo } from 'react';
import type { Habit, HabitCompletion } from '@/lib/services/data-service.interface';
import { getDataService } from '@/lib/services/service-provider';

export interface HabitWithStatus {
  habit: Habit;
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

export function calcCurrentStreak(completions: HabitCompletion[], fromDate: string): number {
  if (completions.length === 0) return 0;
  const dates = [...new Set(completions.map((c) => c.date))].sort().reverse();
  let streak = 0;
  const checkDate = new Date(fromDate + 'T00:00:00');
  while (dates.includes(fmtLocal(checkDate))) {
    streak++;
    checkDate.setDate(checkDate.getDate() - 1);
  }
  return streak;
}

async function loadHabitsForDate(date: string): Promise<HabitWithStatus[]> {
  const ds = await getDataService();
  const allHabits = await ds.getHabits();

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

  return allHabits.map((habit) => {
    const habitCompletions = byHabit.get(habit.id) ?? [];
    return {
      habit,
      completed: habitCompletions.some((c) => c.date === date),
      streak: calcCurrentStreak(habitCompletions, date),
    };
  });
}

export function useHabitsForDate(date: string) {
  const qc = useQueryClient();
  const queryKey = useMemo(() => [HABITS_FOR_DATE_KEY, date] as const, [date]);

  const query = useQuery({
    queryKey,
    queryFn: () => loadHabitsForDate(date),
  });

  useEffect(() => {
    const handler = () => qc.invalidateQueries({ queryKey: [HABITS_FOR_DATE_KEY] });
    window.addEventListener('habits-changed', handler);
    return () => window.removeEventListener('habits-changed', handler);
  }, [qc]);

  const toggleMutation = useMutation({
    mutationFn: async ({
      habitId,
      currentlyCompleted,
    }: {
      habitId: string;
      currentlyCompleted: boolean;
    }) => {
      const ds = await getDataService();
      if (currentlyCompleted) await ds.uncompleteHabit(habitId, date);
      else await ds.completeHabit(habitId, date);
      return { habitId, currentlyCompleted };
    },
    onMutate: async ({ habitId, currentlyCompleted }) => {
      await qc.cancelQueries({ queryKey });
      const prev = qc.getQueryData<HabitWithStatus[]>(queryKey);
      qc.setQueryData<HabitWithStatus[]>(queryKey, (old) =>
        (old ?? []).map((h) =>
          h.habit.id === habitId ? { ...h, completed: !currentlyCompleted } : h,
        ),
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKey, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey });
    },
  });

  const toggleComplete = useCallback(
    (habitId: string, currentlyCompleted: boolean) =>
      toggleMutation.mutateAsync({ habitId, currentlyCompleted }),
    [toggleMutation],
  );

  const reload = useCallback(() => qc.invalidateQueries({ queryKey }), [qc, queryKey]);

  return {
    habits: query.data ?? [],
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    toggleComplete,
    reload,
  };
}
