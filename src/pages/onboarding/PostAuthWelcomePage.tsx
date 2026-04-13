import { Icon } from '@iconify/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { track } from '@/lib/analytics';
import { speak, stopTTS, unlockTTS } from '@/lib/services/tts-service';

/**
 * POST-AUTH-01: Coach introduction after authentication.
 *
 * Voice Journey CSV: auto-plays welcome → "I'm ready" → presence ask → onboarding.
 * Full text sent as single API call (no chunking) for seamless audio.
 */

type WelcomePhase = 'intro' | 'presence_ask' | 'done';

const WELCOME_TEXT = (name: string) =>
  `Welcome${name ? `, ${name}` : ''}. I'm your AI coach inside Guided Growth, and I'm going to be with you from here on. This isn't an app that gives you a list and hopes for the best. You'll talk to me in the morning. You'll talk to me at night. And between those two moments, the habits you want will start happening, not because you're forcing them, but because we're removing what's in the way. This setup takes about three to five minutes. This is probably the longest we'll ever talk. After this, your check-ins are between thirty seconds and a couple of minutes, depending on how much you want to share. And those few minutes a day? They're designed to save you time, not add to your schedule. When the right habits click into place, you stop wasting energy on the things that weren't working. That's time back. Real time. Everything you share with me, your mood, your habits, your reflections, we use all of it to give you better insights. But here's the thing: your data is anonymized from the first second. We never connect it to you personally. That's the best of both worlds. When you're ready, let's begin.`;

const PRESENCE_TEXT = `One thing before we start. I need you here right now. Present. Not multitasking. Not half-listening. What we're about to do is focus on you, and that deserves your full attention. I know it sounds like a paradox, an app asking you to be present. But that's actually the goal: to help you spend less time on your phone, not more. That's why you talk to me instead of scrolling. Talking to your phone is better than being on your phone. Let's go.`;

export function PostAuthWelcomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [phase, setPhase] = useState<WelcomePhase>('intro');
  const mountedRef = useRef(true);

  const displayName = user?.nickname || user?.name?.split(' ')[0] || '';

  // Auto-play welcome on mount — unlockTTS was called on login/signup page
  useEffect(() => {
    mountedRef.current = true;
    const timer = setTimeout(() => {
      if (!mountedRef.current) return;
      unlockTTS();
      speak(WELCOME_TEXT(displayName));
    }, 300);
    return () => {
      mountedRef.current = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleReady = useCallback(() => {
    track('post_auth_welcome', { action: 'ready', has_name: !!displayName });
    stopTTS();
    setPhase('presence_ask');
    setTimeout(() => speak(PRESENCE_TEXT), 200);
    setTimeout(() => {
      setPhase('done');
      setTimeout(() => navigate('/onboarding', { replace: true }), 1200);
    }, 25000);
  }, [navigate, displayName]);

  const handleComeback = useCallback(() => {
    track('post_auth_welcome', { action: 'come_back_later', has_name: !!displayName });
    stopTTS();
    setTimeout(() => speak(`No rush. I'll be here when you're ready.`), 200);
    setTimeout(() => navigate('/login', { replace: true }), 3500);
  }, [navigate, displayName]);

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
