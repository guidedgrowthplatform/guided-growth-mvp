import { Icon } from '@iconify/react';
import { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useVoicePlayer } from '@/hooks/useVoicePlayer';
import { unlockTTS } from '@/lib/services/tts-service';
import { supabase } from '@/lib/supabase';

/**
 * MIC-01: Microphone permission screen.
 *
 * Phase 1 docs: MP3 plays, user grants or denies mic.
 * Saves mic_permission to Supabase profiles table.
 * Plays mic_granted or mic_denied MP3 based on result.
 */
export function MicPermissionPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const voicePlayer = useVoicePlayer();

  useEffect(() => {
    voicePlayer.play('mic_permission').catch(() => {});
    return () => voicePlayer.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAllow = useCallback(async () => {
    voicePlayer.stop();
    unlockTTS();

    try {
      // Request mic permission from browser
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Granted
      if (user?.id) {
        await supabase
          .from('user_preferences')
          .upsert({ user_id: user.id, mic_permission: true }, { onConflict: 'user_id' })
          .then(null, () => {});
      }
      await voicePlayer.play('mic_granted').catch(() => {});
    } catch {
      // Denied or dismissed — treat same as deny
      if (user?.id) {
        await supabase
          .from('user_preferences')
          .upsert({ user_id: user.id, mic_permission: false }, { onConflict: 'user_id' })
          .then(null, () => {});
      }
      await voicePlayer.play('mic_denied').catch(() => {});
    }

    // Either way, continue to welcome
    setTimeout(() => navigate('/onboarding/welcome', { replace: true }), 2000);
  }, [navigate, voicePlayer, user?.id]);

  return (
    <div className="flex min-h-dvh flex-col bg-surface px-6 pb-[48px] pt-[max(24px,env(safe-area-inset-top))]">
      <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10">
          <Icon icon="mdi:microphone" width={40} height={40} className="text-primary" />
        </div>

        <div className="space-y-3">
          <h1 className="text-[28px] font-bold leading-tight text-content">Can I listen?</h1>
          <p className="text-[16px] leading-relaxed text-content-secondary">
            I always want to give you the option to talk to me. To do that, I need access to your
            microphone.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <button
          type="button"
          onClick={handleAllow}
          className="flex h-[56px] w-full items-center justify-center gap-3 rounded-full bg-primary text-[18px] font-medium text-white shadow-[0px_20px_25px_-5px_rgba(26,47,176,0.2)]"
        >
          <Icon icon="mdi:microphone" width={22} height={22} />
          Allow microphone
        </button>
        <button
          type="button"
          onClick={() => {
            voicePlayer.stop();
            voicePlayer.play('mic_denied').catch(() => {});
            if (user?.id) {
              supabase
                .from('profiles')
                .update({ mic_permission: false })
                .eq('id', user.id)
                .then(null, () => {});
            }
            setTimeout(() => navigate('/onboarding/welcome', { replace: true }), 2000);
          }}
          className="w-full py-3 text-center text-[16px] font-semibold text-content-secondary"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
