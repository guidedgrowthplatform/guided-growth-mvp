import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { queryKeys } from '@/lib/query';
import { getDataService } from '@/lib/services/service-provider';
import type { CheckInData } from '@shared/types';

async function fetchCheckIn(date: string) {
  const ds = await getDataService();
  return ds.getCheckIn(date);
}

async function saveCheckInToService(date: string, data: CheckInData) {
  const ds = await getDataService();
  return ds.saveCheckIn(date, data);
}

export function useCheckIn(date: string) {
  const qc = useQueryClient();

  const {
    data: checkIn = null,
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: queryKeys.checkins.byDate(date),
    queryFn: () => fetchCheckIn(date),
    enabled: !!date,
  });

  const error = queryError ? (queryError as Error).message : null;

  const mutation = useMutation({
    mutationFn: (data: CheckInData) => saveCheckInToService(date, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.checkins.byDate(date) });
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
