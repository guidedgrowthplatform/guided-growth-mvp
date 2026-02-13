import { useState, useEffect, useCallback } from 'react';
import type { Metric, MetricCreate, MetricUpdate } from '@shared/types';
import * as metricsApi from '@/api/metrics';
import { cache } from '@/cache/cacheManager';
import { useToast } from '@/contexts/ToastContext';

export function useMetrics() {
  const { addToast } = useToast();
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await metricsApi.fetchMetrics();
      setMetrics(data);
      cache.set('metrics', data);
    } catch (err: any) {
      setError(err.message);
      // Try cache fallback
      const cached = cache.get<Metric[]>('metrics');
      if (cached) setMetrics(cached);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = useCallback(async (data: MetricCreate) => {
    const metric = await metricsApi.createMetric(data);
    setMetrics((prev) => [...prev, metric]);
    cache.invalidate('metrics');
    addToast('success', `Habit "${data.name}" created`);
    return metric;
  }, [addToast]);

  const update = useCallback(async (id: string, data: MetricUpdate) => {
    const metric = await metricsApi.updateMetric(id, data);
    setMetrics((prev) => prev.map((m) => (m.id === id ? metric : m)));
    cache.invalidate('metrics');
    return metric;
  }, []);

  const remove = useCallback(async (id: string) => {
    await metricsApi.deleteMetric(id);
    setMetrics((prev) => prev.filter((m) => m.id !== id));
    cache.invalidate('metrics');
    addToast('info', 'Habit removed');
  }, [addToast]);

  const reorder = useCallback(async (metricIds: string[]) => {
    const reordered = await metricsApi.reorderMetrics(metricIds);
    setMetrics(reordered);
    cache.invalidate('metrics');
  }, []);

  const activeMetrics = metrics.filter((m) => m.active);

  return { metrics, activeMetrics, loading, error, load, create, update, remove, reorder };
}
