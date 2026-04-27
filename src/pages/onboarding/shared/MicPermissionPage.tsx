import { Icon } from '@iconify/react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { track } from '@/analytics';
import { IconChatVoice, IconMicMuted } from '@/components/icons';
import { DualButton } from '@/components/ui/DualButton';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { useVoicePlayer } from '@/hooks/useVoicePlayer';

export function MicPermissionPage() {
  const navigate = useNavigate();
  const { preferences, updatePreference } = useUserPreferences();
  const { play, stop } = useVoicePlayer();
  const [requesting, setRequesting] = useState(false);
  const voiceEnabled = preferences.voiceEnabled === true;

  // MIC-01 state machine per Voice System sheet:
  //   screen_load → mic_permission.mp3 (~8s explanation)
  //   after_grant → mic_granted.mp3 (~4s)
  //   after_deny → mic_denied.mp3 (~5s, same MP3 on dismiss per spec: "No problem...")
  useEffect(() => {
    play('mic_permission').catch(() => {
      // Autoplay may be blocked; the screen's button copy carries the same info.
    });
    track('view_mic_permission', {
      ai_output_mode: voiceEnabled ? 'voice' : 'text',
    });
    return () => stop();
    // Intentionally runs once on mount — voiceEnabled doesn't flip here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goNext = () => navigate('/onboarding/ai-coach-intro');

  const handleAllow = async () => {
    if (requesting) return;
    setRequesting(true);
    stop();
    let granted = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      // User tapped Allow — intent is explicit. OS may still prompt or deny
      // separately; we surface that at the point of actual use.
      granted = false;
    }
    track('grant_mic_permission', { granted, dismissed: false });
    await updatePreference('micGranted', granted);
    // Play the post-permission MP3 to completion before advancing so the
    // user hears "Got it" (~4s) or "No problem" (~5s) before the next screen.
    // If autoplay fails, navigate immediately — the flow shouldn't stall.
    await play(granted ? 'mic_granted' : 'mic_denied').catch(() => {});
    goNext();
  };

  const handleDismiss = async () => {
    if (requesting) return;
    setRequesting(true);
    stop();
    track('grant_mic_permission', { granted: false, dismissed: true });
    await updatePreference('micGranted', false);
    await play('mic_denied').catch(() => {});
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

      <div className="flex flex-1 items-center justify-center">
        <DualButton
          size={170}
          width={180}
          leftActive={voiceEnabled}
          leftIcon={<IconChatVoice size={58} />}
          rightIcon={<IconMicMuted size={48} />}
          ariaLabel="Microphone permission illustration"
        />
      </div>

      <div>
        <h1 className="text-[28px] font-bold leading-tight text-primary">
          Would you like to talk?
        </h1>
        <p className="mt-3 text-[15px] leading-[22px] text-content-secondary">
          I always want to give you the option to talk to me. To do that, I need access to your
          microphone.
        </p>

        <div className="mt-8 flex flex-col items-center gap-[12px]">
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
