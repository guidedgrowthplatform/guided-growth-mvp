import { apiGet, apiPost, apiPatch, apiDelete, apiPut } from './client';
import type { Metric, MetricCreate, MetricUpdate } from '@shared/types';
import { getDataService } from '@/lib/services/service-provider';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const useSupabase = supabaseUrl.length > 0 && !supabaseUrl.includes('placeholder');

// Convert DataService habit to Metric format
function habitToMetric(h: { id: string; name: string; frequency: string; createdAt: string; active: boolean }): Metric {
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

export async function fetchMetrics(): Promise<Metric[]> {
  if (useSupabase) {
    const ds = await getDataService();
    const habits = await ds.getHabits();
    return habits.map(habitToMetric);
  }
  try {
    return await apiGet<Metric[]>('/api/metrics');
  } catch {
    const ds = await getDataService();
    const habits = await ds.getHabits();
    return habits.map(habitToMetric);
  }
}

export async function createMetric(data: MetricCreate): Promise<Metric> {
  if (useSupabase) {
    const ds = await getDataService();
    const habit = await ds.createHabit(data.name, data.frequency || 'daily');
    window.dispatchEvent(new CustomEvent('voice-data-changed'));
    return habitToMetric(habit);
  }
  try {
    return await apiPost<Metric>('/api/metrics', data);
  } catch {
    const ds = await getDataService();
    const habit = await ds.createHabit(data.name, data.frequency || 'daily');
    window.dispatchEvent(new CustomEvent('voice-data-changed'));
    return habitToMetric(habit);
  }
}

export async function updateMetric(id: string, data: MetricUpdate): Promise<Metric> {
  if (useSupabase) {
    const ds = await getDataService();
    const habit = await ds.updateHabit(id, data);
    window.dispatchEvent(new CustomEvent('voice-data-changed'));
    return habitToMetric(habit);
  }
  try {
    return await apiPatch<Metric>(`/api/metrics/${id}`, data);
  } catch {
    const ds = await getDataService();
    const habit = await ds.updateHabit(id, data);
    window.dispatchEvent(new CustomEvent('voice-data-changed'));
    return habitToMetric(habit);
  }
}

export async function deleteMetric(id: string): Promise<void> {
  if (useSupabase) {
    const ds = await getDataService();
    await ds.deleteHabit(id);
    window.dispatchEvent(new CustomEvent('voice-data-changed'));
    return;
  }
  try {
    await apiDelete(`/api/metrics/${id}`);
  } catch {
    const ds = await getDataService();
    await ds.deleteHabit(id);
    window.dispatchEvent(new CustomEvent('voice-data-changed'));
  }
}

export async function reorderMetrics(metricIds: string[]): Promise<Metric[]> {
  if (useSupabase) {
    // Only persist sort order to Supabase if NOT in auth bypass mode
    // (MockDataService does not track sort_order)
    const { AUTH_BYPASS } = await import('@/lib/services/service-provider');
    if (!AUTH_BYPASS) {
      const { supabase } = await import('@/lib/supabase');
      for (let i = 0; i < metricIds.length; i++) {
        await supabase
          .from('user_habits')
          .update({ sort_order: i + 1 })
          .eq('id', metricIds[i]);
      }
    }
    const ds = await getDataService();
    const habits = await ds.getHabits();
    return habits.map(habitToMetric);
  }
  try {
    return await apiPut<Metric[]>('/api/metrics/reorder', { metric_ids: metricIds });
  } catch {
    const ds = await getDataService();
    const habits = await ds.getHabits();
    return habits.map(habitToMetric);
  }
}
