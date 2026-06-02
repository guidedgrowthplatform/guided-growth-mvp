import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { track } from '@/analytics';
import { IconChatText, IconChatVoice, IconMic, IconMicMuted } from '@/components/icons';
import { DualButton } from '@/components/ui/DualButton';
import { useOnboardingVoice } from '@/contexts/useOnboardingVoiceSession';
import { useSessionLog } from '@/hooks/useSessionLog';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { useStepTiming } from './useStepTiming';

export function VoicePreferencePage() {
  const navigate = useNavigate();
  const { preferences, updatePreferences } = useUserPreferences();
  const { logEvent } = useSessionLog();
  const onboardingVoice = useOnboardingVoice();
  const [saving, setSaving] = useState(false);
  const trackStepComplete = useStepTiming(2, 'voice_preference', null);

  const voiceChosen = preferences.voiceMode === 'voice';
  const micGranted = preferences.micPermission === true;

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
    if (!voiceEnabled) onboardingVoice?.endCall();
    trackStepComplete();
    navigate('/onboarding/mic-permission');
  };

  return (
    <div className="flex min-h-dvh flex-col bg-surface px-6 pb-[max(32px,env(safe-area-inset-bottom))] pt-[max(16px,env(safe-area-inset-top))]">
      <div className="mt-8">
        <h1 className="text-[28px] font-bold leading-tight text-primary">Can I talk?</h1>
        <p className="mt-3 text-[15px] leading-[22px] text-content-secondary">
          Do you prefer that I talk, or write on the screen to you? If you&apos;d like me to talk,
          just say yes. If not, say screen.
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center">
        <DualButton
          size={170}
          width={180}
          leftActive={false}
          rightActive={false}
          leftIcon={voiceChosen ? <IconChatVoice size={58} /> : <IconChatText size={58} />}
          rightIcon={micGranted ? <IconMic size={48} /> : <IconMicMuted size={48} />}
          leftAriaLabel="Coach voice indicator"
          rightAriaLabel="Microphone indicator"
        />
      </div>

      <div>
        <div className="flex flex-col gap-[12px]">
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
