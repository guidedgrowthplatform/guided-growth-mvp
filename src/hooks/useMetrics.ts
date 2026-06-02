import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import * as metricsApi from '@/api/metrics';
import { useToast } from '@/contexts/ToastContext';
import { useSessionLog } from '@/hooks/useSessionLog';
import { queryKeys } from '@/lib/query';
import type { MetricCreate, MetricUpdate } from '@gg/shared/types';

export function useMetrics() {
  const { addToast } = useToast();
  const qc = useQueryClient();
  const { logEvent } = useSessionLog();

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
    onSuccess: (result, data) => {
      qc.invalidateQueries({ queryKey: queryKeys.metrics.all });
      addToast('success', `Habit "${data.name}" created`);
      logEvent('habit_added', {
        habit_id: result.id,
        name: data.name,
        frequency: data.frequency,
        has_reminder: false,
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: MetricUpdate }) =>
      metricsApi.updateMetric(id, data),
    onSuccess: (_result, { id, data }) => {
      qc.invalidateQueries({ queryKey: queryKeys.metrics.all });
      logEvent('habit_edited', {
        habit_id: id,
        fields_changed: Object.keys(data),
      });
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
