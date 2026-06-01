import type { UserPreferences as DbUserPreferences, VoiceMode, RecordingMode } from '@shared/types';

// Leaf module: no hooks, no supabase, no react-query — safe to import from
// non-hook services (voiceGate, tts-service graph).

export interface UserPreferences {
  coachingStyle: string;
  voiceModel: string;
  language: string;
  morningTime: string;
  nightTime: string;
  pushNotifications: boolean;
  voiceMode: VoiceMode;
  micEnabled: boolean;
  micPermission: boolean;
  recordingMode: RecordingMode;
  defaultView: DbUserPreferences['default_view'];
  spreadsheetRange: DbUserPreferences['spreadsheet_range'];
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  coachingStyle: 'friendly',
  voiceModel: 'alex',
  language: 'en-US',
  morningTime: '07:00',
  nightTime: '22:30',
  pushNotifications: true,
  voiceMode: 'voice',
  micEnabled: true,
  micPermission: false,
  recordingMode: 'auto-stop',
  defaultView: 'spreadsheet',
  spreadsheetRange: 'month',
};

export const SETTINGS_STORAGE_KEY = 'mvp03_page_settings';

export function loadLocalPreferences(): UserPreferences {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) };
  } catch {
    // ignore
  }
  return DEFAULT_PREFERENCES;
}

export function saveLocalPreferences(prefs: UserPreferences) {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}
