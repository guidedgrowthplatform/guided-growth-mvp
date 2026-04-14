import { Icon } from '@iconify/react';
import { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useVoice } from '@/hooks/useVoice';
import { useVoicePlayer } from '@/hooks/useVoicePlayer';
import { supabase } from '@/lib/supabase';

/**
 * PREF-01: "Can I talk?" — Voice/Screen preference selection.
 *
 * Phase 1 docs: MP3 plays, user taps voice or screen preference.
 * Saves ai_output_mode to Supabase profiles table.
 */
export function PrefPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const voicePlayer = useVoicePlayer();
  const { setPreference } = useVoice();

  useEffect(() => {
    voicePlayer.play('pref_can_i_talk').catch(() => {});
    return () => voicePlayer.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChoice = useCallback(
    async (choice: 'voice' | 'screen') => {
      voicePlayer.stop();
      // Set local voice mode (docs Step 6 Screen 2: setVoiceMode)
      setPreference(choice === 'screen' ? 'text_only' : 'full_voice');
      if (user?.id) {
        await supabase
          .from('profiles')
          .update({ ai_output_mode: choice })
          .eq('id', user.id)
          .then(null, () => {});
      }
      navigate('/onboarding/mic-permission', { replace: true });
    },
    [navigate, voicePlayer, user?.id, setPreference],
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
