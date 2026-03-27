import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { queryKeys } from '@/lib/query';
import type { Habit } from '@/lib/services/data-service.interface';
import { getDataService } from '@/lib/services/service-provider';

export interface UseHabitsReturn {
  habits: Habit[];
  isLoading: boolean;
  error: string | null;
  reload: () => void;
}

export function useHabits(): UseHabitsReturn {
  const qc = useQueryClient();

  const {
    data: habits = [],
    isLoading,
    error: queryError,
  } = useQuery({
    queryKey: queryKeys.habits.all,
    queryFn: async () => {
      const ds = await getDataService();
      return ds.getHabits();
    },
  });

  const reload = useCallback(() => {
    qc.invalidateQueries({ queryKey: queryKeys.habits.all });
  }, [qc]);

  const error = queryError ? (queryError as Error).message : null;

  return { habits, isLoading, error, reload };
}
