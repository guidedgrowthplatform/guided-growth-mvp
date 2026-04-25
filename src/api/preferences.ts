import type { ViewMode, SpreadsheetRange } from '@shared/types';
import { withDataServiceFallback } from './_helpers';
import { apiGet, apiPut } from './client';

export interface PreferencesData {
  default_view: ViewMode;
  spreadsheet_range: SpreadsheetRange;
}

const LS_KEY = 'gg_preferences';

function getLocalPrefs(): PreferencesData {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
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
  return withDataServiceFallback(async () => {
    const remote = await apiGet<PreferencesData>('/api/preferences');
    localStorage.setItem(LS_KEY, JSON.stringify(remote));
    return remote;
  }, getLocalPrefs);
}

export async function savePreferences(prefs: Partial<PreferencesData>): Promise<PreferencesData> {
  const merged = setLocalPrefs(prefs);
  return withDataServiceFallback(
    () => apiPut<PreferencesData>('/api/preferences', prefs),
    () => merged,
  );
}
