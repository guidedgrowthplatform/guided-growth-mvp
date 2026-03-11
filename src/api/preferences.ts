import { apiGet, apiPut } from './client';
import type { ViewMode, SpreadsheetRange } from '@shared/types';
import { useSupabase } from '@/lib/services/service-provider';
import { supabase } from '@/lib/supabase';

export interface PreferencesData {
  default_view: ViewMode;
  spreadsheet_range: SpreadsheetRange;
}

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

function setLocalPrefs(prefs: Partial<PreferencesData>): PreferencesData {
  const current = getLocalPrefs();
  const merged = { ...current, ...prefs };
  localStorage.setItem(LS_KEY, JSON.stringify(merged));
  return merged;
}

async function getSupabasePrefs(): Promise<PreferencesData> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return getLocalPrefs();

  const { data } = await supabase
    .from('user_preferences')
    .select('default_view, spreadsheet_range')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!data) return getLocalPrefs();

  const prefs: PreferencesData = {
    default_view: data.default_view as ViewMode,
    spreadsheet_range: data.spreadsheet_range as SpreadsheetRange,
  };
  // Keep local cache in sync
  localStorage.setItem(LS_KEY, JSON.stringify(prefs));
  return prefs;
}

async function saveSupabasePrefs(prefs: Partial<PreferencesData>): Promise<PreferencesData> {
  const merged = setLocalPrefs(prefs);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return merged;

  await supabase
    .from('user_preferences')
    .upsert({
      user_id: user.id,
      default_view: merged.default_view,
      spreadsheet_range: merged.spreadsheet_range,
    }, { onConflict: 'user_id' });

  return merged;
}

export async function fetchPreferences(): Promise<PreferencesData> {
  if (useSupabase) return getSupabasePrefs();
  try {
    const remote = await apiGet<PreferencesData>('/api/preferences');
    localStorage.setItem(LS_KEY, JSON.stringify(remote));
    return remote;
  } catch {
    return getLocalPrefs();
  }
}

export async function savePreferences(prefs: Partial<PreferencesData>): Promise<PreferencesData> {
  if (useSupabase) return saveSupabasePrefs(prefs);
  const merged = setLocalPrefs(prefs);
  try {
    return await apiPut<PreferencesData>('/api/preferences', prefs);
  } catch {
    return merged;
  }
}
