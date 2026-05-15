import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { track } from '@/analytics';
import { IconChatText, IconChatVoice, IconMic, IconMicMuted } from '@/components/icons';
import { DualButton } from '@/components/ui/DualButton';
import { useOnboardingVoice } from '@/contexts/useOnboardingVoiceSession';
import { useSessionLog } from '@/hooks/useSessionLog';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { useVoiceSettingsStore } from '@/stores/voiceSettingsStore';

export function VoicePreferencePage() {
  const navigate = useNavigate();
  const { updatePreferences } = useUserPreferences();
  const { logEvent } = useSessionLog();
  const onboardingVoice = useOnboardingVoice();
  const [saving, setSaving] = useState(false);

  // Vapi runs throughout the pre-onboarding screens via OnboardingVoiceProvider.
  // It auto-starts on this route with the mic muted (`startAudioOff: true`) so
  // the assistant can speak the VOICE-PREFERENCE context block while the user
  // chooses voice or screen mode — no MP3 broadcast on this screen.

  const vapiStatus = onboardingVoice?.status ?? 'idle';
  const vapiActive = vapiStatus === 'active';
  const vapiConnecting = vapiStatus === 'connecting';
  const vapiIsMuted = onboardingVoice?.isMuted ?? true;
  const vapiTtsMuted = onboardingVoice?.isTtsMuted ?? false;
  const vapiSpeaking = onboardingVoice?.isAssistantSpeaking ?? false;
  const ttsOn = vapiActive && !vapiTtsMuted;
  const micOn = vapiActive && !vapiIsMuted;

  const handleTtsToggleClick = () => {
    if (!vapiActive) return;
    const next = vapiTtsMuted;
    onboardingVoice?.setTtsEnabled(next);
    void updatePreferences({ voiceMode: next ? 'voice' : 'screen' });
  };

  const handleMicToggleClick = () => {
    if (!vapiActive) return;
    const next = vapiIsMuted;
    onboardingVoice?.setMicEnabled(next);
    void updatePreferences({ micEnabled: next });
  };

  const choose = async (voiceEnabled: boolean) => {
    if (saving) return;
    setSaving(true);
    track('set_voice_preference', {
      preference: voiceEnabled ? 'voice' : 'text',
      screen: 'pref_01',
    });
    logEvent(
      'voice_preference_set',
      { preference: voiceEnabled ? 'voice' : 'screen' },
      'VOICE-PREFERENCE',
    );
    await updatePreferences({ voiceMode: voiceEnabled ? 'voice' : 'screen' });
    useVoiceSettingsStore.getState().hydrate({ ttsEnabled: voiceEnabled });
    // If the user opted out of voice, tear down Vapi before leaving the
    // screen so it doesn't keep running on mic-permission.
    if (!voiceEnabled) onboardingVoice?.endCall();
    navigate('/onboarding/mic-permission');
  };

  return (
    <div className="flex min-h-dvh flex-col bg-surface px-6 pb-[max(32px,env(safe-area-inset-bottom))] pt-[max(16px,env(safe-area-inset-top))]">
      <div className="flex flex-1 items-center justify-center">
        <DualButton
          size={170}
          width={180}
          leftActive={ttsOn || vapiConnecting}
          rightActive={micOn}
          activeRings={ttsOn && vapiSpeaking ? 'left' : null}
          leftIcon={ttsOn ? <IconChatVoice size={58} /> : <IconChatText size={58} />}
          rightIcon={micOn ? <IconMic size={48} /> : <IconMicMuted size={48} />}
          onLeftClick={handleTtsToggleClick}
          onRightClick={handleMicToggleClick}
          leftAriaLabel={ttsOn ? 'Mute coach voice' : 'Unmute coach voice'}
          rightAriaLabel={micOn ? 'Mute mic' : 'Unmute mic'}
        />
      </div>

      <div>
        <h1 className="text-[28px] font-bold leading-tight text-primary">Can I talk?</h1>
        <p className="mt-3 text-[15px] leading-[22px] text-content-secondary">
          Do you prefer that I talk, or write on the screen to you? If you&apos;d like me to talk,
          just say yes. If not, say screen.
        </p>

        <div className="mt-8 flex flex-col gap-[12px]">
          <button
            type="button"
            onClick={() => choose(true)}
            disabled={saving}
            className="flex h-[56px] items-center justify-center rounded-full bg-primary text-[18px] font-bold text-white shadow-[0px_10px_15px_-3px_rgba(19,91,236,0.25),0px_4px_6px_-4px_rgba(19,91,236,0.25)] transition-opacity disabled:opacity-50"
          >
            Talk to me
          </button>
          <button
            type="button"
            onClick={() => choose(false)}
            disabled={saving}
            className="flex h-[56px] items-center justify-center rounded-full border-2 border-primary bg-surface text-[18px] font-bold text-primary transition-opacity disabled:opacity-50"
          >
            Screen is fine
          </button>
        </div>

        <p className="mt-[14px] text-center text-[13px] text-content-tertiary">
          Interact using text and buttons only.
        </p>
      </div>
    </div>
  );
}
