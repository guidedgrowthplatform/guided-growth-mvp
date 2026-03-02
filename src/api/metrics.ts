import { apiGet, apiPost, apiPatch, apiDelete, apiPut } from './client';
import type { Metric, MetricCreate, MetricUpdate } from '@shared/types';
import { mockDataService } from '@/lib/services/mock-data-service';

// Convert MockDataService habit to Metric format
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
    user_id: 'mock',
  };
}

export async function fetchMetrics(): Promise<Metric[]> {
  try {
    return await apiGet<Metric[]>('/api/metrics');
  } catch {
    // Fallback to MockDataService
    const habits = await mockDataService.getHabits();
    return habits.map(habitToMetric);
  }
}

export async function createMetric(data: MetricCreate): Promise<Metric> {
  try {
    return await apiPost<Metric>('/api/metrics', data);
  } catch {
    const habit = await mockDataService.createHabit(data.name, data.frequency || 'daily');
    window.dispatchEvent(new CustomEvent('voice-data-changed'));
    return habitToMetric(habit);
  }
}

export async function updateMetric(id: string, data: MetricUpdate): Promise<Metric> {
  try {
    return await apiPatch<Metric>(`/api/metrics/${id}`, data);
  } catch {
    const habit = await mockDataService.updateHabit(id, data);
    window.dispatchEvent(new CustomEvent('voice-data-changed'));
    return habitToMetric(habit);
  }
}

export async function deleteMetric(id: string): Promise<void> {
  try {
    await apiDelete(`/api/metrics/${id}`);
  } catch {
    await mockDataService.deleteHabit(id);
    window.dispatchEvent(new CustomEvent('voice-data-changed'));
  }
}

export async function reorderMetrics(metricIds: string[]): Promise<Metric[]> {
  try {
    return await apiPut<Metric[]>('/api/metrics/reorder', { metric_ids: metricIds });
  } catch {
    const habits = await mockDataService.getHabits();
    return habits.map(habitToMetric);
  }
}
