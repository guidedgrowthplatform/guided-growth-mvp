import { useEffect, useRef } from 'react';
import type { UserPreferences as DbUserPreferences } from '@shared/types';
import { apiGet, apiPut } from '@/api/client';
import { useAuth } from '@/hooks/useAuth';
import { useVoiceSettingsStore } from '@/stores/voiceSettingsStore';

const WRITE_DEBOUNCE_MS = 500;
const HYDRATE_GUARD_MS = 100;

interface SyncedSlice {
  ttsEnabled: boolean;
  micEnabled: boolean;
  recordingMode: DbUserPreferences['recording_mode'];
}

function selectSlice(): SyncedSlice {
  const s = useVoiceSettingsStore.getState();
  return {
    ttsEnabled: s.ttsEnabled,
    micEnabled: s.micEnabled,
    recordingMode: s.recordingMode,
  };
}

export function useVoicePreferenceSync(): void {
  const { user } = useAuth();
  const isHydratingRef = useRef(false);
  const lastSyncedRef = useRef<SyncedSlice | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user) {
      lastSyncedRef.current = null;
      return;
    }

    let cancelled = false;
    isHydratingRef.current = true;

    (async () => {
      try {
        const row = await apiGet<Partial<DbUserPreferences>>('/api/preferences');
        if (cancelled) return;
        useVoiceSettingsStore.getState().hydrate({
          ttsEnabled: row.voice_mode === 'voice',
          micEnabled: row.mic_enabled ?? true,
          recordingMode: row.recording_mode ?? 'auto-stop',
        });
        lastSyncedRef.current = selectSlice();
      } catch {
        // offline / API error — keep cache; next user/focus retries
      } finally {
        if (!cancelled) {
          setTimeout(() => {
            isHydratingRef.current = false;
          }, HYDRATE_GUARD_MS);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = useVoiceSettingsStore.subscribe(() => {
      if (isHydratingRef.current) return;
      const last = lastSyncedRef.current;
      if (!last) return;

      const current = selectSlice();
      const recIsTransient = useVoiceSettingsStore.getState().recordingModeTransient;

      const diff: Record<string, unknown> = {};
      const nextSynced: SyncedSlice = { ...last };

      if (current.ttsEnabled !== last.ttsEnabled) {
        diff.voice_mode = current.ttsEnabled ? 'voice' : 'screen';
        nextSynced.ttsEnabled = current.ttsEnabled;
      }
      if (current.micEnabled !== last.micEnabled) {
        diff.mic_enabled = current.micEnabled;
        nextSynced.micEnabled = current.micEnabled;
      }
      if (current.recordingMode !== last.recordingMode && !recIsTransient) {
        diff.recording_mode = current.recordingMode;
        nextSynced.recordingMode = current.recordingMode;
      }

      if (Object.keys(diff).length === 0) return;

      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(async () => {
        try {
          await apiPut('/api/preferences', diff);
          lastSyncedRef.current = nextSynced;
        } catch {
          // swallow — surfaces on next interaction
        }
      }, WRITE_DEBOUNCE_MS);
    });

    return () => {
      unsubscribe();
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [user]);
}
