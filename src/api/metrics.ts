import { apiGet, apiPost, apiPatch, apiDelete, apiPut } from './client';
import type { Metric, MetricCreate, MetricUpdate } from '@shared/types';
import { getDataService, useSupabase, AUTH_BYPASS } from '@/lib/services/service-provider';

// Use DataService when Supabase is active OR when auth is bypassed (mock mode)
const useDataService = useSupabase || AUTH_BYPASS;

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
  if (useDataService) {
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
  if (useDataService) {
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
  if (useDataService) {
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
  if (useDataService) {
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
  if (useDataService) {
    const ds = await getDataService();
    await ds.reorderHabits(metricIds);
    const habits = await ds.getHabits();
    return habits.map(habitToMetric);
  }
  try {
    return await apiPut<Metric[]>('/api/metrics/reorder', { metric_ids: metricIds });
  } catch {
    const ds = await getDataService();
    await ds.reorderHabits(metricIds);
    const habits = await ds.getHabits();
    return habits.map(habitToMetric);
  }
}
