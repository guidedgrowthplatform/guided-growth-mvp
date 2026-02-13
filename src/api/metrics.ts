import { apiGet, apiPost, apiPatch, apiDelete, apiPut } from './client';
import type { Metric, MetricCreate, MetricUpdate } from '@shared/types';

export async function fetchMetrics(): Promise<Metric[]> {
  return apiGet<Metric[]>('/api/metrics');
}

export async function createMetric(data: MetricCreate): Promise<Metric> {
  return apiPost<Metric>('/api/metrics', data);
}

export async function updateMetric(id: string, data: MetricUpdate): Promise<Metric> {
  return apiPatch<Metric>(`/api/metrics/${id}`, data);
}

export async function deleteMetric(id: string): Promise<void> {
  await apiDelete(`/api/metrics/${id}`);
}

export async function reorderMetrics(metricIds: string[]): Promise<Metric[]> {
  return apiPut<Metric[]>('/api/metrics/reorder', { metric_ids: metricIds });
}
