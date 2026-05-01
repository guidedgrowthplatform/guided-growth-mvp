import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import * as metricsApi from '@/api/metrics';
import { useToast } from '@/contexts/ToastContext';
import { queryKeys } from '@/lib/query';
import type { MetricCreate, MetricUpdate } from '@shared/types';

export function useMetrics() {
  const { addToast } = useToast();
  const qc = useQueryClient();

  const {
    data: metrics = [],
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: queryKeys.metrics.all,
    queryFn: metricsApi.fetchMetrics,
  });

  const error = queryError ? (queryError as Error).message : null;

  const createMutation = useMutation({
    mutationFn: (data: MetricCreate) => metricsApi.createMetric(data),
    onSuccess: (_result, data) => {
      qc.invalidateQueries({ queryKey: queryKeys.metrics.all });
      addToast('success', `Habit "${data.name}" created`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: MetricUpdate }) =>
      metricsApi.updateMetric(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.metrics.all });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (metricIds: string[]) => metricsApi.reorderMetrics(metricIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.metrics.all });
    },
  });

  const create = useCallback(
    async (data: MetricCreate) => {
      return createMutation.mutateAsync(data);
    },
    [createMutation],
  );

  const update = useCallback(
    async (id: string, data: MetricUpdate) => {
      return updateMutation.mutateAsync({ id, data });
    },
    [updateMutation],
  );

  const reorder = useCallback(
    async (metricIds: string[]) => {
      return reorderMutation.mutateAsync(metricIds);
    },
    [reorderMutation],
  );

  const load = useCallback(() => {
    qc.invalidateQueries({ queryKey: queryKeys.metrics.all });
  }, [qc]);

  const activeMetrics = metrics.filter((m) => m.active);

  return { metrics, activeMetrics, loading, error, load, create, update, reorder };
}
