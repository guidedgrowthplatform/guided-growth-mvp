import { getDataService } from '@/lib/services/service-provider';
import type { PreferencesData } from '@/lib/services/data-service.interface';

export type { PreferencesData };

const LS_KEY = 'gg_preferences';

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

export async function fetchPreferences(): Promise<PreferencesData> {
  try {
    const ds = await getDataService();
    const prefs = await ds.getPreferences();
    localStorage.setItem(LS_KEY, JSON.stringify(prefs));
    return prefs;
  } catch {
    return getLocalPrefs();
  }
}

export async function savePreferences(prefs: Partial<PreferencesData>): Promise<PreferencesData> {
  try {
    const ds = await getDataService();
    const merged = await ds.savePreferences(prefs);
    localStorage.setItem(LS_KEY, JSON.stringify(merged));
    return merged;
  } catch {
    // Fallback: save locally
    const current = getLocalPrefs();
    const merged = { ...current, ...prefs };
    localStorage.setItem(LS_KEY, JSON.stringify(merged));
    return merged;
  }
}
