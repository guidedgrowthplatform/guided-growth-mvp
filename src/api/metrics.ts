import { getDataService } from '@/lib/services/service-provider';
import type { Metric, MetricCreate, MetricUpdate } from '@shared/types';
import { useSupabase, withDataServiceFallback } from './_helpers';
import { apiGet, apiPost, apiPatch, apiDelete, apiPut } from './client';

// Convert DataService habit to Metric format
function habitToMetric(h: {
  id: string;
  name: string;
  frequency: string;
  createdAt: string;
  active: boolean;
}): Metric {
  return {
    id: h.id,
    name: h.name,
    question: '',
    input_type: 'binary',
    frequency: h.frequency as Metric['frequency'],
    active: h.active,
    sort_order: 0,
    target_value: null,
    target_unit: null,
    created_at: h.createdAt,
    updated_at: h.createdAt,
    user_id: 'local',
  };
}

async function fetchHabitsAsMetrics(includeInactive: boolean): Promise<Metric[]> {
  const ds = await getDataService();
  const habits = includeInactive ? await ds.getAllHabits() : await ds.getHabits();
  return habits.map(habitToMetric);
}

export async function fetchAllMetrics(): Promise<Metric[]> {
  return withDataServiceFallback(
    () => apiGet<Metric[]>('/api/metrics'),
    () => fetchHabitsAsMetrics(true),
  );
}

export async function fetchMetrics(): Promise<Metric[]> {
  return withDataServiceFallback(
    () => apiGet<Metric[]>('/api/metrics'),
    () => fetchHabitsAsMetrics(false),
  );
}

export async function createMetric(data: MetricCreate): Promise<Metric> {
  return withDataServiceFallback(
    () => apiPost<Metric>('/api/metrics', data),
    async () => {
      const ds = await getDataService();
      const habit = await ds.createHabit(data.name, data.frequency || 'daily', data.schedule_days);
      return habitToMetric(habit);
    },
  );
}

export async function updateMetric(id: string, data: MetricUpdate): Promise<Metric> {
  return withDataServiceFallback(
    () => apiPatch<Metric>(`/api/metrics/${id}`, data),
    async () => {
      const ds = await getDataService();
      const habit = await ds.updateHabit(id, data);
      return habitToMetric(habit);
    },
  );
}

export async function deleteMetric(id: string): Promise<void> {
  return withDataServiceFallback(
    () => apiDelete(`/api/metrics/${id}`).then(() => undefined),
    async () => {
      const ds = await getDataService();
      await ds.deleteHabit(id);
    },
  );
}

// reorderMetrics intentionally does NOT use withDataServiceFallback. The
// useSupabase path writes the new sort_order to user_habits before reading
// back; the API-failure path only re-reads. Forcing both into the same
// fallback would change behavior, so the two branches stay distinct.
export async function reorderMetrics(metricIds: string[]): Promise<Metric[]> {
  if (useSupabase) {
    const { supabase } = await import('@/lib/supabase');
    for (let i = 0; i < metricIds.length; i++) {
      await supabase
        .from('user_habits')
        .update({ sort_order: i + 1 })
        .eq('id', metricIds[i]);
    }
    return fetchHabitsAsMetrics(false);
  }
  try {
    return await apiPut<Metric[]>('/api/metrics/reorder', { metric_ids: metricIds });
  } catch {
    return fetchHabitsAsMetrics(false);
  }
}
