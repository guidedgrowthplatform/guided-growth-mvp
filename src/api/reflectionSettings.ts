import type { ReflectionSettings } from '@gg/shared/types';
import { apiGet } from './client';

export function fetchReflectionSettings(): Promise<ReflectionSettings> {
  return apiGet<ReflectionSettings>('/api/reflections/config');
}

