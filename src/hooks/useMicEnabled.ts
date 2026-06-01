import { useUserPreferences } from '@/hooks/useUserPreferences';
import { micEnabledFrom } from '@/lib/services/voiceGate';
import { useVoiceSettingsStore } from '@/stores/voiceSettingsStore';

export function useMicEnabled(): boolean {
  const { preferences } = useUserPreferences();
  const micPausedReason = useVoiceSettingsStore((s) => s.micPausedReason);
  return micEnabledFrom(preferences, micPausedReason);
}
