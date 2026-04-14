import { Icon } from '@iconify/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useVoicePlayer } from '@/hooks/useVoicePlayer';
import { track } from '@/lib/analytics';

/**
 * POST-AUTH-01: Welcome screen with two-part MP3.
 *
 * Phase 1 docs: welcome_intro.mp3 (60s) plays on load.
 * User taps "I'm ready" → stops intro, plays welcome_presence.mp3 (25s).
 * Then navigates to ONBOARD-01.
 */

type WelcomePhase = 'intro' | 'presence_ask' | 'done';

export function PostAuthWelcomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const voicePlayer = useVoicePlayer();
  const [phase, setPhase] = useState<WelcomePhase>('intro');
  const mountedRef = useRef(true);

  const displayName = user?.nickname || user?.name?.split(' ')[0] || '';

  // Play welcome_intro MP3 on mount
  useEffect(() => {
    mountedRef.current = true;
    // Small delay to let VoiceContext reset from previous page's audio
    const timer = setTimeout(() => {
      if (mountedRef.current) voicePlayer.play('welcome_intro').catch(() => {});
    }, 500);
    return () => {
      mountedRef.current = false;
      clearTimeout(timer);
      voicePlayer.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleReady = useCallback(() => {
    track('post_auth_welcome', { action: 'ready', has_name: !!displayName });
    voicePlayer.stop();
    setPhase('presence_ask');

    // Play welcome_presence MP3 (25s), then navigate
    voicePlayer
      .play('welcome_presence')
      .catch(() => {})
      .finally(() => {
        if (mountedRef.current) {
          setPhase('done');
          setTimeout(() => navigate('/onboarding', { replace: true }), 1200);
        }
      });
  }, [navigate, displayName, voicePlayer]);

  const handleComeback = useCallback(() => {
    track('post_auth_welcome', { action: 'come_back_later', has_name: !!displayName });
    voicePlayer.stop();
    navigate('/login', { replace: true });
  }, [navigate, displayName, voicePlayer]);

  return (
    <div className="flex min-h-dvh flex-col bg-surface px-6 pb-[48px] pt-[max(24px,env(safe-area-inset-top))]">
      <div className="flex items-center justify-center pt-8">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Icon icon="mdi:microphone" width={32} height={32} className="text-primary" />
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        {phase === 'intro' && (
          <div className="space-y-3">
            <h1 className="text-[28px] font-bold leading-tight text-content">
              Welcome{displayName ? `, ${displayName}` : ''}
            </h1>
            <p className="text-[16px] leading-relaxed text-content-secondary">
              Meet your AI coach. Listen — this is the most important minute.
            </p>
          </div>
        )}

        {phase === 'presence_ask' && (
          <div className="space-y-3">
            <h1 className="text-[28px] font-bold leading-tight text-content">One thing first</h1>
            <p className="text-[16px] leading-relaxed text-content-secondary">
              Be present. This moment is yours.
            </p>
          </div>
        )}

        {phase === 'done' && (
          <div className="space-y-3">
            <h1 className="text-[28px] font-bold leading-tight text-content">Let's go</h1>
            <div className="flex items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary" />
            </div>
          </div>
        )}
      </div>

      {phase === 'intro' && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleReady}
            className="flex h-[56px] w-full items-center justify-center gap-2 rounded-full bg-primary text-[18px] font-medium leading-[28px] text-white shadow-[0px_20px_25px_-5px_rgba(26,47,176,0.2),0px_8px_10px_-6px_rgba(26,47,176,0.2)]"
          >
            I'm ready — let's go
          </button>
          <button
            type="button"
            onClick={handleComeback}
            className="w-full py-3 text-center text-[16px] font-semibold text-content-secondary"
          >
            I'll come back later
          </button>
        </div>
      )}
    </div>
  );
}
