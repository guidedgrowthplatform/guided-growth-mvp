import { useEffect, useRef } from 'react';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { useVoiceSettingsStore } from '@/stores/voiceSettingsStore';

export interface VoicePreferenceSyncInput {
  loaded: boolean;
  voiceEnabled: boolean | undefined;
  ttsEnabled: boolean;
}

export type VoicePreferenceSyncDecision = 'noop' | 'force-off';

export function decideVoicePreferenceSync(
  input: VoicePreferenceSyncInput,
): VoicePreferenceSyncDecision {
  if (!input.loaded) return 'noop';
  if (input.voiceEnabled !== false) return 'noop';
  if (!input.ttsEnabled) return 'noop';
  return 'force-off';
}

export function useVoicePreferenceSync(): void {
  const { preferences, isLoading } = useUserPreferences();
  const hasSyncedRef = useRef(false);

  useEffect(() => {
    if (isLoading) return;
    if (hasSyncedRef.current) return;

    const decision = decideVoicePreferenceSync({
      loaded: !isLoading,
      voiceEnabled: preferences.voiceEnabled,
      ttsEnabled: useVoiceSettingsStore.getState().ttsEnabled,
    });

    if (decision === 'force-off') {
      useVoiceSettingsStore.getState().setTtsEnabled(false);
    }

    hasSyncedRef.current = true;
  }, [isLoading, preferences.voiceEnabled]);
}
