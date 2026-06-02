import { getDataService } from '@/lib/services/service-provider';
import type { Metric, MetricCreate, MetricUpdate } from '@gg/shared/types';

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
    anon_id: 'local',
  };
}

export async function fetchMetrics(): Promise<Metric[]> {
  const ds = await getDataService();
  const habits = await ds.getHabits();
  return habits.map(habitToMetric);
}

export async function createMetric(data: MetricCreate): Promise<Metric> {
  const ds = await getDataService();
  const habit = await ds.createHabit(data.name, data.frequency || 'daily', data.schedule_days);
  return habitToMetric(habit);
}

export async function updateMetric(id: string, data: MetricUpdate): Promise<Metric> {
  const ds = await getDataService();
  const habit = await ds.updateHabit(id, data);
  return habitToMetric(habit);
}

export async function reorderMetrics(metricIds: string[]): Promise<Metric[]> {
  const { supabase } = await import('@/lib/supabase');
  for (let i = 0; i < metricIds.length; i++) {
    await supabase
      .from('user_habits')
      .update({ sort_order: i + 1 })
      .eq('id', metricIds[i]);
  }
  const ds = await getDataService();
  const habits = await ds.getHabits();
  return habits.map(habitToMetric);
}
