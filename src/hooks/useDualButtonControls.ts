import { useCallback } from 'react';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { stopTTS, unlockTTS } from '@/lib/services/tts-service';

export interface DualButtonControls {
  voiceOn: boolean;
  micOn: boolean;
  micAllowed: boolean;
  toggleVoice: () => void;
  toggleMic: () => void;
  requestMicPermission: () => Promise<boolean>;
}

export function useDualButtonControls(): DualButtonControls {
  const { preferences, updatePreferences } = useUserPreferences();
  const voiceOn = preferences.voiceMode === 'voice';
  const micAllowed = preferences.micPermission === true;
  const micOn = micAllowed && preferences.micEnabled === true;

  const toggleVoice = useCallback(() => {
    const next = !voiceOn;
    if (!next) stopTTS();
    void updatePreferences({ voiceMode: next ? 'voice' : 'screen' });
  }, [voiceOn, updatePreferences]);

  const toggleMic = useCallback(() => {
    if (!micAllowed) return;
    const next = !micOn;
    void updatePreferences({ micEnabled: next });
  }, [micAllowed, micOn, updatePreferences]);

  const requestMicPermission = useCallback(async () => {
    let granted = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      granted = false;
    }
    await updatePreferences({ micPermission: granted, micEnabled: granted });
    if (granted) unlockTTS();
    return granted;
  }, [updatePreferences]);

  return { voiceOn, micOn, micAllowed, toggleVoice, toggleMic, requestMicPermission };
}
