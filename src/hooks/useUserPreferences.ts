import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { apiGet, apiPut } from '@/api/client';
import { useAuth } from '@/hooks/useAuth';
import { useSessionLog } from '@/hooks/useSessionLog';
import { queryKeys } from '@/lib/query';
import type { UserPreferences as DbUserPreferences, VoiceMode, RecordingMode } from '@shared/types';

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
  const qc = useQueryClient();
  const { logEvent } = useSessionLog();

  const query = useQuery<UserPreferences>({
    queryKey: queryKeys.preferences.all,
    queryFn: async () => {
      const row = await apiGet<WirePreferences>('/api/preferences');
      const next = fromWire(row);
      saveLocalPreferences(next);
      return next;
    },
    enabled: !!user,
    staleTime: 60 * 60_000,
    initialData: loadLocalPreferences,
    initialDataUpdatedAt: 0,
  });

  const updateMutation = useMutation<
    WirePreferences,
    Error,
    Partial<UserPreferences>,
    { previous: UserPreferences | undefined }
  >({
    mutationFn: (partial) => apiPut<WirePreferences>('/api/preferences', toWire(partial)),
    onMutate: async (partial) => {
      await qc.cancelQueries({ queryKey: queryKeys.preferences.all });
      const previous = qc.getQueryData<UserPreferences>(queryKeys.preferences.all);
      const next = { ...(previous ?? DEFAULT_PREFERENCES), ...partial };
      qc.setQueryData<UserPreferences>(queryKeys.preferences.all, next);
      saveLocalPreferences(next);
      return { previous };
    },
    onError: (_err, _partial, ctx) => {
      if (ctx?.previous) {
        qc.setQueryData(queryKeys.preferences.all, ctx.previous);
        saveLocalPreferences(ctx.previous);
      }
    },
    onSuccess: (wire, partial, ctx) => {
      const next = fromWire(wire);
      qc.setQueryData(queryKeys.preferences.all, next);
      saveLocalPreferences(next);
      for (const key of Object.keys(partial) as (keyof UserPreferences)[]) {
        const oldValue = ctx?.previous?.[key] ?? null;
        const newValue = partial[key] ?? null;
        // Skip no-op writes — the Settings page can call updatePreferences
        // with an unchanged object on init / form re-submits, which used to
        // spam session_log with rows where old_value === new_value.
        if (JSON.stringify(oldValue) === JSON.stringify(newValue)) continue;
        logEvent(
          'settings_changed',
          { field: key, old_value: oldValue, new_value: newValue },
          'SETTINGS',
        );
      }
    },
  });

  const updatePreference = useCallback(
    <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
      if (!user) {
        const previous = qc.getQueryData<UserPreferences>(queryKeys.preferences.all);
        const next = { ...(previous ?? DEFAULT_PREFERENCES), [key]: value };
        qc.setQueryData<UserPreferences>(queryKeys.preferences.all, next);
        saveLocalPreferences(next);
        return Promise.resolve();
      }
      return updateMutation.mutateAsync({ [key]: value } as Partial<UserPreferences>);
    },
    [qc, updateMutation, user],
  );

  const updatePreferences = useCallback(
    (partial: Partial<UserPreferences>) => {
      if (!user) {
        const previous = qc.getQueryData<UserPreferences>(queryKeys.preferences.all);
        const next = { ...(previous ?? DEFAULT_PREFERENCES), ...partial };
        qc.setQueryData<UserPreferences>(queryKeys.preferences.all, next);
        saveLocalPreferences(next);
        return Promise.resolve();
      }
      return updateMutation.mutateAsync(partial);
    },
    [qc, updateMutation, user],
  );

  return {
    preferences: query.data ?? DEFAULT_PREFERENCES,
    isLoading: query.isLoading,
    error: query.error
      ? query.error.message
      : updateMutation.error
        ? updateMutation.error.message
        : null,
    updatePreference,
    updatePreferences,
  };
}
