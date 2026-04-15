import { Icon } from '@iconify/react';
import { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVoice } from '@/hooks/useVoice';
import { useVoicePlayer } from '@/hooks/useVoicePlayer';

/**
 * PREF-01: "Can I talk?" — Voice/Screen preference selection.
 *
 * Phase 1 spec (2026-04-16): MP3 plays; user picks voice or screen.
 * Preference persists to user_preferences.voice_mode via VoiceContext
 * (single source of truth; no parallel write to profiles).
 */
export function PrefPage() {
  const navigate = useNavigate();
  const voicePlayer = useVoicePlayer();
  const { setPreference } = useVoice();

  useEffect(() => {
    voicePlayer.play('pref_can_i_talk').catch(() => {});
    return () => voicePlayer.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChoice = useCallback(
    (choice: 'voice' | 'screen') => {
      voicePlayer.stop();
      setPreference(choice);
      navigate('/onboarding/mic-permission', { replace: true });
    },
    [navigate, voicePlayer, setPreference],
  );

  return (
    <div className="flex min-h-dvh flex-col bg-surface px-6 pb-[48px] pt-[max(24px,env(safe-area-inset-top))]">
      <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10">
          <Icon icon="mdi:chat-processing" width={40} height={40} className="text-primary" />
        </div>

        <div className="space-y-3">
          <h1 className="text-[28px] font-bold leading-tight text-content">Can I talk?</h1>
          <p className="text-[16px] leading-relaxed text-content-secondary">
            I have something to share with you. Do you prefer that I talk, or write on the screen?
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <button
          type="button"
          onClick={() => handleChoice('voice')}
          className="flex h-[56px] w-full items-center justify-center gap-3 rounded-full bg-primary text-[18px] font-medium text-white shadow-[0px_20px_25px_-5px_rgba(26,47,176,0.2)]"
        >
          <Icon icon="mdi:volume-high" width={22} height={22} />
          Talk to me
        </button>
        <button
          type="button"
          onClick={() => handleChoice('screen')}
          className="flex h-[56px] w-full items-center justify-center gap-3 rounded-full border-2 border-border-light bg-surface text-[18px] font-medium text-content"
        >
          <Icon icon="mdi:text-box-outline" width={22} height={22} />
          Screen is fine
        </button>
      </div>
    </div>
  );
}
