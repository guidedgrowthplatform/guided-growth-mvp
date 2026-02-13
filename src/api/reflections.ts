import { apiGet, apiPut } from './client';
import type { ReflectionConfig, DayReflections } from '@shared/types';

export async function fetchReflectionConfig(): Promise<ReflectionConfig> {
  return apiGet<ReflectionConfig>('/api/reflections/config');
}

export async function saveReflectionConfig(config: ReflectionConfig): Promise<ReflectionConfig> {
  return apiPut<ReflectionConfig>('/api/reflections/config', config);
}

export async function fetchReflections(start: string, end: string): Promise<Record<string, DayReflections>> {
  return apiGet<Record<string, DayReflections>>(`/api/reflections?start=${start}&end=${end}`);
}

export async function saveReflections(date: string, reflections: DayReflections): Promise<void> {
  await apiPut(`/api/reflections/${date}`, reflections);
}

export async function fetchAffirmation(): Promise<string> {
  const result = await apiGet<{ value: string }>('/api/affirmation');
  return result.value;
}

export async function saveAffirmation(value: string): Promise<void> {
  await apiPut('/api/affirmation', { value });
}

export async function fetchPreferences(): Promise<{ default_view: string }> {
  return apiGet<{ default_view: string }>('/api/preferences');
}

export async function savePreferences(prefs: { default_view: string }): Promise<void> {
  await apiPut('/api/preferences', prefs);
}
