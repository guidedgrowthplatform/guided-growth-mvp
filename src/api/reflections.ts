import type { ReflectionConfig, DayReflections } from '@shared/types';
import { useSupabase, withDataServiceFallback } from './_helpers';
import { apiGet, apiPut } from './client';

const LS_CONFIG = 'gg_reflections_config';
const LS_REFLECTIONS = 'gg_reflections';
const LS_AFFIRMATION = 'gg_affirmation';

// Default config when API unavailable
const DEFAULT_CONFIG: ReflectionConfig = {
  fields: [
    { id: 'gratitude', label: 'What are you grateful for?', order: 1 },
    { id: 'highlight', label: "Today's highlight", order: 2 },
    { id: 'mood', label: 'How do you feel?', order: 3 },
  ],
  show_affirmation: true,
};

function getLocalConfig(): ReflectionConfig {
  try {
    const raw = localStorage.getItem(LS_CONFIG);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return DEFAULT_CONFIG;
}

function getLocalReflections(): Record<string, DayReflections> {
  try {
    const raw = localStorage.getItem(LS_REFLECTIONS);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return {};
}

export async function fetchReflectionConfig(): Promise<ReflectionConfig> {
  return withDataServiceFallback(async () => {
    const remote = await apiGet<ReflectionConfig>('/api/reflections/config');
    localStorage.setItem(LS_CONFIG, JSON.stringify(remote));
    return remote;
  }, getLocalConfig);
}

export async function saveReflectionConfig(config: ReflectionConfig): Promise<ReflectionConfig> {
  localStorage.setItem(LS_CONFIG, JSON.stringify(config));
  return withDataServiceFallback(
    () => apiPut<ReflectionConfig>('/api/reflections/config', config),
    () => config,
  );
}

export async function fetchReflections(
  start: string,
  end: string,
): Promise<Record<string, DayReflections>> {
  return withDataServiceFallback(
    () => apiGet<Record<string, DayReflections>>(`/api/reflections?start=${start}&end=${end}`),
    getLocalReflections,
  );
}

export async function saveReflections(date: string, reflections: DayReflections): Promise<void> {
  try {
    const all = JSON.parse(localStorage.getItem(LS_REFLECTIONS) || '{}');
    all[date] = reflections;
    localStorage.setItem(LS_REFLECTIONS, JSON.stringify(all));
  } catch {
    /* ignore */
  }
  if (useSupabase) return;
  try {
    await apiPut(`/api/reflections/${date}`, reflections);
  } catch {
    /* silent */
  }
}

export async function fetchAffirmation(): Promise<string> {
  return withDataServiceFallback(
    async () => {
      const result = await apiGet<{ value: string }>('/api/affirmation');
      localStorage.setItem(LS_AFFIRMATION, result.value);
      return result.value;
    },
    () => localStorage.getItem(LS_AFFIRMATION) || '',
  );
}

export async function saveAffirmation(value: string): Promise<void> {
  localStorage.setItem(LS_AFFIRMATION, value);
  if (useSupabase) return;
  try {
    await apiPut('/api/affirmation', { value });
  } catch {
    /* silent */
  }
}
