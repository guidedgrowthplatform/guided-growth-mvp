import type { ReflectionSettings, ReflectionSettingsUpdate } from '@gg/shared/types';
import { apiGet, apiPut } from './client';

export function fetchReflectionSettings(): Promise<ReflectionSettings> {
  return apiGet<ReflectionSettings>('/api/reflections/config');
}

export function updateReflectionSettings(
  update: ReflectionSettingsUpdate,
): Promise<ReflectionSettings> {
  return apiPut<ReflectionSettings>('/api/reflections/config', update);
}
