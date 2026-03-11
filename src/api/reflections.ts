import { getDataService } from '@/lib/services/service-provider';
import type { ReflectionConfig } from '@/lib/services/data-service.interface';
import type { DayReflections } from '@shared/types';

export type { ReflectionConfig };

const LS_CONFIG = 'gg_reflections_config';
const LS_REFLECTIONS = 'gg_reflections';
const LS_AFFIRMATION = 'gg_affirmation';

// Default config when no data available
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
  } catch { /* ignore */ }
  return DEFAULT_CONFIG;
}

function getLocalReflections(): Record<string, DayReflections> {
  try {
    const raw = localStorage.getItem(LS_REFLECTIONS);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
}

// ─── Public API ───

export async function fetchReflectionConfig(): Promise<ReflectionConfig> {
  try {
    const ds = await getDataService();
    const config = await ds.getReflectionConfig();
    localStorage.setItem(LS_CONFIG, JSON.stringify(config));
    return config;
  } catch {
    return getLocalConfig();
  }
}

export async function saveReflectionConfig(config: ReflectionConfig): Promise<ReflectionConfig> {
  localStorage.setItem(LS_CONFIG, JSON.stringify(config));
  try {
    const ds = await getDataService();
    return await ds.saveReflectionConfig(config);
  } catch {
    return config;
  }
}

export async function fetchReflections(_start: string, _end: string): Promise<Record<string, DayReflections>> {
  // Day-level reflections are stored locally (no dedicated Supabase table)
  // Journal entries (voice reflect) already go to journal_entries table
  return getLocalReflections();
}

export async function saveReflections(date: string, reflections: DayReflections): Promise<void> {
  try {
    const all = JSON.parse(localStorage.getItem(LS_REFLECTIONS) || '{}');
    all[date] = reflections;
    localStorage.setItem(LS_REFLECTIONS, JSON.stringify(all));
  } catch { /* ignore */ }
}

export async function fetchAffirmation(): Promise<string> {
  try {
    const ds = await getDataService();
    const val = await ds.getAffirmation();
    localStorage.setItem(LS_AFFIRMATION, val);
    return val;
  } catch {
    return localStorage.getItem(LS_AFFIRMATION) || '';
  }
}

export async function saveAffirmation(value: string): Promise<void> {
  localStorage.setItem(LS_AFFIRMATION, value);
  try {
    const ds = await getDataService();
    await ds.saveAffirmation(value);
  } catch { /* silent */ }
}
