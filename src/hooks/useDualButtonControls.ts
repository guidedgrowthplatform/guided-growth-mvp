import { useCallback } from 'react';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { stopVoice, unlockCartesiaVoice } from '@/lib/services/cartesiaVoice';
import { prewarmSoniox } from '@/lib/services/soniox-prewarm';
import { stopTTS, unlockTTS } from '@/lib/services/tts-service';

export type MicRequestResult = 'granted' | 'denied' | 'unavailable';

export interface DualButtonControls {
  voiceOn: boolean;
  micOn: boolean;
  micAllowed: boolean;
  toggleVoice: () => void;
  toggleMic: () => void;
  requestMicPermission: () => Promise<MicRequestResult>;
}

export function useDualButtonControls(): DualButtonControls {
  const { preferences, updatePreferences } = useUserPreferences();
  const voiceOn = preferences.voiceMode === 'voice';
  const micAllowed = preferences.micPermission === true;
  const micOn = micAllowed && preferences.micEnabled === true;

  const toggleVoice = useCallback(() => {
    const next = !voiceOn;
    if (!next) {
      stopTTS();
      stopVoice();
    }
    void updatePreferences({ voiceMode: next ? 'voice' : 'screen' });
  }, [voiceOn, updatePreferences]);

  const toggleMic = useCallback(() => {
    if (!micAllowed) return;
    const next = !micOn;
    void updatePreferences({ micEnabled: next });
  }, [micAllowed, micOn, updatePreferences]);

  const requestMicPermission = useCallback(async (): Promise<MicRequestResult> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      await updatePreferences({ micPermission: true, micEnabled: true });
      unlockTTS();
      unlockCartesiaVoice();
      // Fire-and-forget: mint the Soniox temp key + pre-open its WS now, well
      // before the first utterance, instead of paying that cost at connect
      // time (see soniox-prewarm.ts). No-op when SONIOX_PREWARM is off.
      prewarmSoniox();
      return 'granted';
    } catch (err) {
      const name = err instanceof DOMException ? err.name : '';
      // True denial — downgrade the stored grant.
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        await updatePreferences({ micPermission: false, micEnabled: false });
        return 'denied';
      }
      // Transient (device busy / NotReadableError / AbortError) — keep a prior grant.
      if (micAllowed) {
        void updatePreferences({ micEnabled: true });
        unlockTTS();
        unlockCartesiaVoice();
        prewarmSoniox();
        return 'granted';
      }
      return 'unavailable';
    }
  }, [updatePreferences, micAllowed]);

  return { voiceOn, micOn, micAllowed, toggleVoice, toggleMic, requestMicPermission };
}
