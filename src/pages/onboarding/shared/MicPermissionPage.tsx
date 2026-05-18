import { Icon } from '@iconify/react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { track } from '@/analytics';
import { IconChatText, IconChatVoice, IconMic, IconMicMuted } from '@/components/icons';
import { DualButton } from '@/components/ui/DualButton';
import { useSessionLog } from '@/hooks/useSessionLog';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { useStepTiming } from './useStepTiming';

export function MicPermissionPage() {
  const navigate = useNavigate();
  const { preferences, updatePreferences } = useUserPreferences();
  const { logEvent } = useSessionLog();
  const [requesting, setRequesting] = useState(false);
  const voiceEnabled = preferences.voiceMode === 'voice';
  const micGranted = preferences.micPermission === true;
  const trackStepComplete = useStepTiming(1, 'mic_permission', null);

  useEffect(() => {
    localStorage.setItem('gg_onboarding_started_at', String(Date.now()));
    track('start_onboarding');
    track('view_mic_permission', {
      ai_output_mode: voiceEnabled ? 'voice' : 'screen',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goNext = useCallback(() => {
    trackStepComplete();
    navigate('/onboarding/step-1');
  }, [trackStepComplete, navigate]);

  const handleAllow = async () => {
    if (requesting) return;
    setRequesting(true);
    let granted = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      granted = false;
    }
    track('grant_mic_permission', { granted, dismissed: false });
    logEvent(granted ? 'mic_permission_granted' : 'mic_permission_denied', {}, 'MIC-PERMISSION');
    await updatePreferences({ micPermission: granted, micEnabled: granted });
    goNext();
  };

  const handleDismiss = async () => {
    if (requesting) return;
    setRequesting(true);
    track('grant_mic_permission', { granted: false, dismissed: true });
    logEvent('mic_permission_denied', {}, 'MIC-PERMISSION');
    await updatePreferences({ micPermission: false, micEnabled: false });
    goNext();
  };

  return (
    <div className="flex min-h-dvh flex-col bg-surface px-6 pb-[max(32px,env(safe-area-inset-bottom))] pt-[max(16px,env(safe-area-inset-top))]">
      <button
        type="button"
        onClick={() => navigate('/onboarding/voice-preference')}
        aria-label="Go back"
        className="flex h-10 w-10 items-center justify-center rounded-2xl bg-surface shadow-card"
      >
        <Icon icon="ic:round-arrow-back" width={18} height={18} className="text-content" />
      </button>

      <div className="mt-4">
        <h1 className="text-[28px] font-bold leading-tight text-primary">
          Would you like to talk?
        </h1>
        <p className="mt-3 text-[15px] leading-[22px] text-content-secondary">
          I always want to give you the option to talk to me. To do that, I need access to your
          microphone.
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center">
        <DualButton
          size={170}
          width={180}
          leftActive={voiceEnabled}
          rightActive={micGranted}
          leftIcon={voiceEnabled ? <IconChatVoice size={58} /> : <IconChatText size={58} />}
          rightIcon={micGranted ? <IconMic size={48} /> : <IconMicMuted size={48} />}
          leftAriaLabel="Coach voice indicator"
          rightAriaLabel="Microphone indicator"
        />
      </div>

      <div>
        <div className="flex flex-col items-center gap-[12px]">
          <button
            type="button"
            onClick={handleAllow}
            disabled={requesting}
            className="flex h-[56px] w-full items-center justify-center rounded-full bg-primary text-[18px] font-bold text-white shadow-[0px_10px_15px_-3px_rgba(19,91,236,0.25),0px_4px_6px_-4px_rgba(19,91,236,0.25)] transition-opacity disabled:opacity-50"
          >
            Allow Microphone
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            disabled={requesting}
            className="py-[8px] text-[15px] font-semibold text-content"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
