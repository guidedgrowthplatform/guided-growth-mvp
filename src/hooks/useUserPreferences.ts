import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSessionLog } from '@/hooks/useSessionLog';
import { rescheduleFromPrefs } from '@/lib/localReminders';
import {
  DEFAULT_PREFERENCES,
  loadLocalPreferences,
  saveLocalPreferences,
  type UserPreferences,
} from '@/lib/preferences/snapshot';
import { queryKeys } from '@/lib/query';
import { supabaseDataService } from '@/lib/services/supabase-data-service';
import type { UserPreferences as DbUserPreferences } from '@gg/shared/types';

export type { UserPreferences };
export { DEFAULT_PREFERENCES };

const REMINDER_KEYS = ['morningTime', 'nightTime', 'pushNotifications'] as const;

// reschedule from resolved `next` (not the snapshot) to avoid a write/read race
function maybeReschedule(partial: Partial<UserPreferences>, next: UserPreferences): void {
  if (REMINDER_KEYS.some((k) => k in partial)) void rescheduleFromPrefs(next);
}

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
  const out = { ...DEFAULT_PREFERENCES };
  for (const camel of Object.keys(CAMEL_TO_SNAKE) as (keyof UserPreferences)[]) {
    const value = row[CAMEL_TO_SNAKE[camel]];
    if (value != null) (out as Record<string, unknown>)[camel] = value;
  }
  return out;
}

function toWire(partial: Partial<UserPreferences>): WirePreferences {
  const wire: Record<string, unknown> = {};
  for (const key of Object.keys(partial) as (keyof UserPreferences)[]) {
    const snake = CAMEL_TO_SNAKE[key];
    if (snake) wire[snake] = partial[key];
  }
  return wire as WirePreferences;
}

export function useUserPreferences() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { logEvent } = useSessionLog();

  const query = useQuery<UserPreferences>({
    queryKey: queryKeys.preferences.all,
    queryFn: async () => {
      const row = await supabaseDataService.getPreferences();
      const next = fromWire((row ?? {}) as WirePreferences);
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
    mutationFn: async (partial) =>
      (await supabaseDataService.upsertPreferences(
        toWire(partial) as Partial<DbUserPreferences>,
      )) as WirePreferences,
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
      maybeReschedule(partial, next);
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
        maybeReschedule({ [key]: value } as Partial<UserPreferences>, next);
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
        maybeReschedule(partial, next);
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
