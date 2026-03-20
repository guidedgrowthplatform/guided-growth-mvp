import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import * as metricsApi from '@/api/metrics';
import type { MetricUpdate } from '@shared/types';

const ALL_METRICS_KEY = ['metrics', 'all-including-inactive'] as const;

export function useAllMetrics() {
  const qc = useQueryClient();

  const {
    data: allMetrics = [],
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: ALL_METRICS_KEY,
    queryFn: metricsApi.fetchAllMetrics,
  });

  const error = queryError ? (queryError as Error).message : null;

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: MetricUpdate }) =>
      metricsApi.updateMetric(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['metrics'] });
    },
  });

  const update = useCallback(
    async (id: string, data: MetricUpdate) => {
      return updateMutation.mutateAsync({ id, data });
    },
    [updateMutation],
  );

  return { allMetrics, loading, error, update };
}
