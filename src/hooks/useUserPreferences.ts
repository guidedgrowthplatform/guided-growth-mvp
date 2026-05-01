import { useCallback, useEffect, useState } from 'react';
import type {
  UserPreferences as DbUserPreferences,
  VoiceMode,
  RecordingMode,
} from '@shared/types';
import { apiGet, apiPut } from '@/api/client';
import { useAuth } from '@/hooks/useAuth';

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

const DEFAULT_PREFERENCES: UserPreferences = {
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

const SETTINGS_STORAGE_KEY = 'mvp03_page_settings';

type WirePreferences = Partial<DbUserPreferences>;

const CAMEL_TO_SNAKE: Record<keyof UserPreferences, keyof DbUserPreferences> = {
  coachingStyle: 'coaching_style',
  voiceModel: 'voice_model',
  language: 'language',
  morningTime: 'morning_time',
  nightTime: 'night_time',
  pushNotifications: 'push_notifications',
  voiceMode: 'voice_mode',
  micEnabled: 'mic_enabled',
  micPermission: 'mic_permission',
  recordingMode: 'recording_mode',
  defaultView: 'default_view',
  spreadsheetRange: 'spreadsheet_range',
};

function fromWire(row: WirePreferences): UserPreferences {
  return {
    coachingStyle: row.coaching_style ?? DEFAULT_PREFERENCES.coachingStyle,
    voiceModel: row.voice_model ?? DEFAULT_PREFERENCES.voiceModel,
    language: row.language ?? DEFAULT_PREFERENCES.language,
    morningTime: row.morning_time ?? DEFAULT_PREFERENCES.morningTime,
    nightTime: row.night_time ?? DEFAULT_PREFERENCES.nightTime,
    pushNotifications: row.push_notifications ?? DEFAULT_PREFERENCES.pushNotifications,
    voiceMode: row.voice_mode ?? DEFAULT_PREFERENCES.voiceMode,
    micEnabled: row.mic_enabled ?? DEFAULT_PREFERENCES.micEnabled,
    micPermission: row.mic_permission ?? DEFAULT_PREFERENCES.micPermission,
    recordingMode: row.recording_mode ?? DEFAULT_PREFERENCES.recordingMode,
    defaultView: row.default_view ?? DEFAULT_PREFERENCES.defaultView,
    spreadsheetRange: row.spreadsheet_range ?? DEFAULT_PREFERENCES.spreadsheetRange,
  };
}

function toWire(partial: Partial<UserPreferences>): WirePreferences {
  const wire: Record<string, unknown> = {};
  for (const key of Object.keys(partial) as (keyof UserPreferences)[]) {
    const snake = CAMEL_TO_SNAKE[key];
    if (snake) wire[snake] = partial[key];
  }
  return wire as WirePreferences;
}

function loadLocalPreferences(): UserPreferences {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) };
  } catch {
    // ignore
  }
  return DEFAULT_PREFERENCES;
}

function saveLocalPreferences(prefs: UserPreferences) {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

export function useUserPreferences() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<UserPreferences>(loadLocalPreferences);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const row = await apiGet<WirePreferences>('/api/preferences');
        if (cancelled) return;
        const next = fromWire(row);
        setPreferences(next);
        saveLocalPreferences(next);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load preferences');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const updatePreference = useCallback(
    async <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
      const next = { ...preferences, [key]: value };
      setPreferences(next);
      saveLocalPreferences(next);

      if (!user) return;
      try {
        await apiPut<WirePreferences>('/api/preferences', toWire({ [key]: value } as Partial<UserPreferences>));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save preference');
      }
    },
    [preferences, user],
  );

  const updatePreferences = useCallback(
    async (partial: Partial<UserPreferences>) => {
      const next = { ...preferences, ...partial };
      setPreferences(next);
      saveLocalPreferences(next);

      if (!user) return;
      try {
        await apiPut<WirePreferences>('/api/preferences', toWire(partial));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save preferences');
      }
    },
    [preferences, user],
  );

  return {
    preferences,
    isLoading,
    error,
    updatePreference,
    updatePreferences,
  };
}
