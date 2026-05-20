import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useSessionLog } from '@/hooks/useSessionLog';
import { queryKeys } from '@/lib/query';
import { getDataService } from '@/lib/services/service-provider';
import { useAuthStore } from '@/stores/authStore';
import type { CheckInData } from '@shared/types';

async function fetchCheckIn(date: string) {
  const ds = await getDataService();
  return ds.getCheckIn(date);
}

async function saveCheckInToService(date: string, data: CheckInData) {
  const ds = await getDataService();
  return ds.saveCheckIn(date, data);
}

export function useCheckIn(
  date: string,
  opts?: { type?: 'morning' | 'evening'; screenId?: string },
) {
  const qc = useQueryClient();
  const { logEvent } = useSessionLog();
  const anonId = useAuthStore((s) => s.anonId);

  const {
    data: checkIn = null,
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: queryKeys.checkins.byDate(date),
    queryFn: () => fetchCheckIn(date),
    enabled: !!date && !!anonId,
  });

  const error = queryError ? (queryError as Error).message : null;

  const mutation = useMutation({
    mutationFn: (data: CheckInData) => saveCheckInToService(date, data),
    onSuccess: (_result, data) => {
      qc.invalidateQueries({ queryKey: queryKeys.checkins.byDate(date) });
      logEvent(
        'checkin_completed',
        {
          type: opts?.type ?? 'morning',
          sleep: data.sleep ?? undefined,
          mood: data.mood ?? undefined,
          energy: data.energy ?? undefined,
          stress: data.stress ?? undefined,
          via: 'tap',
        },
        opts?.screenId,
      );
    },
  });

  const save = useCallback(
    async (data: CheckInData) => {
      return mutation.mutateAsync(data);
    },
    [mutation],
  );

  return {
    checkIn,
    loading,
    error,
    saving: mutation.isPending,
    save,
  };
}
