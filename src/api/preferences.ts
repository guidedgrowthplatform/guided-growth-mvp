import { apiGet, apiPut } from './client';
import type { ViewMode, SpreadsheetRange } from '@shared/types';

export interface PreferencesData {
  default_view: ViewMode;
  spreadsheet_range: SpreadsheetRange;
}

const LS_KEY = 'gg_preferences';
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const useSupabase = supabaseUrl.length > 0 && !supabaseUrl.includes('placeholder');

function getLocalPrefs(): PreferencesData {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {
    default_view: 'spreadsheet',
    spreadsheet_range: window.innerWidth < 768 ? 'week' : 'month',
  };
}

function setLocalPrefs(prefs: Partial<PreferencesData>): PreferencesData {
  const current = getLocalPrefs();
  const merged = { ...current, ...prefs };
  localStorage.setItem(LS_KEY, JSON.stringify(merged));
  return merged;
}

export async function fetchPreferences(): Promise<PreferencesData> {
  // When using Supabase, skip /api/* routes entirely (they return 401)
  if (useSupabase) return getLocalPrefs();
  try {
    const remote = await apiGet<PreferencesData>('/api/preferences');
    localStorage.setItem(LS_KEY, JSON.stringify(remote));
    return remote;
  } catch {
    return getLocalPrefs();
  }
}

export async function savePreferences(prefs: Partial<PreferencesData>): Promise<PreferencesData> {
  const merged = setLocalPrefs(prefs);
  // When using Supabase, skip /api/* routes entirely
  if (useSupabase) return merged;
  try {
    return await apiPut<PreferencesData>('/api/preferences', prefs);
  } catch {
    return merged;
  }
}
