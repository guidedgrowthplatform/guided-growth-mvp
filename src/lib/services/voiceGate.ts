import {
  DEFAULT_PREFERENCES,
  loadLocalPreferences,
  type UserPreferences,
} from '@/lib/preferences/snapshot';
import { queryClient, queryKeys } from '@/lib/query';
import { type MicPausedReason, useVoiceSettingsStore } from '@/stores/voiceSettingsStore';

// Single source of truth for the persistent voice/mic gate, readable from
// non-hook code (speak(), stt). Mirrors what the orb reads via useUserPreferences.

export function getPreferencesSnapshot(): UserPreferences {
  const cached = queryClient.getQueryData<UserPreferences>(queryKeys.preferences.all);
  // Spread over defaults — a partially-seeded cache must not yield undefined fields.
  if (cached) return { ...DEFAULT_PREFERENCES, ...cached };
  return loadLocalPreferences();
}

export function isVoiceOutEnabled(): boolean {
  return getPreferencesSnapshot().voiceMode === 'voice';
}

export function micEnabledFrom(
  prefs: Pick<UserPreferences, 'micPermission' | 'micEnabled'>,
  micPausedReason: MicPausedReason,
): boolean {
  return prefs.micPermission === true && prefs.micEnabled === true && micPausedReason == null;
}

// Mirrors the orb (micAllowed && micEnabled) + transient system pause.
export function isMicEnabled(): boolean {
  return micEnabledFrom(getPreferencesSnapshot(), useVoiceSettingsStore.getState().micPausedReason);
}
