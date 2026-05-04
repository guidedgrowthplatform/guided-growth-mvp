import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setUserProperty, track } from '@/analytics';
import { IconChatVoice, IconMicMuted } from '@/components/icons';
import { DualButton } from '@/components/ui/DualButton';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { useVoicePlayer } from '@/hooks/useVoicePlayer';
import { useVoiceSettingsStore } from '@/stores/voiceSettingsStore';

export function VoicePreferencePage() {
  const navigate = useNavigate();
  const { updatePreferences } = useUserPreferences();
  const { play, stop } = useVoicePlayer();
  const [saving, setSaving] = useState(false);

  // PREF-01 per Voice System sheet: play pref_can_i_talk.mp3 on screen load
  // (~6s). Any subsequent button tap stops the audio mid-playback.
  useEffect(() => {
    play('pref_can_i_talk').catch(() => {
      // Autoplay may be blocked until the user interacts with the page —
      // that's fine, the screen text is self-explanatory.
    });
    return () => stop();
  }, [play, stop]);

  const choose = async (voiceEnabled: boolean) => {
    if (saving) return;
    setSaving(true);
    stop();
    track('set_voice_preference', {
      preference: voiceEnabled ? 'voice' : 'text',
      screen: 'pref_01',
    });
    setUserProperty({ ai_output_mode: voiceEnabled ? 'voice' : 'text' });
    await updatePreferences({ voiceMode: voiceEnabled ? 'voice' : 'screen' });
    useVoiceSettingsStore.getState().hydrate({ ttsEnabled: voiceEnabled });
    navigate('/onboarding/mic-permission');
  };

  return (
    <div className="flex min-h-dvh flex-col bg-surface px-6 pb-[max(32px,env(safe-area-inset-bottom))] pt-[max(16px,env(safe-area-inset-top))]">
      <div className="flex flex-1 items-center justify-center">
        <DualButton
          size={170}
          width={180}
          leftIcon={<IconChatVoice size={58} />}
          rightIcon={<IconMicMuted size={48} />}
          ariaLabel="Voice preference illustration"
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
