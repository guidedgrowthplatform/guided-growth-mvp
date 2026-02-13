import { apiGet, apiPut } from './client';
import type { ViewMode, SpreadsheetRange } from '@shared/types';

export interface PreferencesData {
  default_view: ViewMode;
  spreadsheet_range: SpreadsheetRange;
}

export async function fetchPreferences(): Promise<PreferencesData> {
  return apiGet<PreferencesData>('/api/preferences');
}

export async function savePreferences(prefs: Partial<PreferencesData>): Promise<PreferencesData> {
  return apiPut<PreferencesData>('/api/preferences', prefs);
}
