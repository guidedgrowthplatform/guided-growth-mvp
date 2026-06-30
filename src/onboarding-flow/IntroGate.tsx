/**
 * IntroGate — two-phase gate before the chat begins:
 *
 * Phase 1 (Get Started): shows the brand screen (heading + eyebrow + primary
 * button + login link). Pressing "Get started" is the browser gesture that
 * satisfies the autoplay policy; no audio plays here.
 *
 * Phase 2 (Coach greeting): renders SplashIntro with autoPlay + skipSplash so
 * the coach MP3 fires immediately off the gesture from phase 1. Because the
 * play() call is synchronous with the button press, the browser allows it and
 * "Tap to play" never appears.
 *
 * After SplashIntro fires onComplete the seen-flag is set and children (the
 * chat) are revealed. First-visit only: a returning/mid-flow user resumes
 * straight into chat, and the flag survives refresh so the intro never replays.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SplashIntro } from '@/components/welcome/SplashIntro';
import { Button } from '@/components/ui/Button';
import { useOnboarding } from '@/hooks/useOnboarding';

const INTRO_SEEN_KEY = 'gg_onboarding_intro_seen';

// Urbanist matches the engine's font stack (same as the flow-builder's FONT token).
const FONT = "Urbanist, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const PRIMARY = 'rgb(19,91,235)';
const PRIMARY_70 = 'rgba(19,91,235,0.7)';
const SUBTLE = 'rgb(100,116,139)';

function readSeen(): boolean {
  try {
    return localStorage.getItem(INTRO_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

type Phase = 'get-started' | 'coach-greeting';

export function IntroGate({ children }: { children: React.ReactNode }) {
  const { state } = useOnboarding();
  // current_step >= 1 means past the auth beat — resume into chat, no intro.
  const hasProgress = (state?.current_step ?? 0) >= 1;
  const [done, setDone] = useState(readSeen);
  const [phase, setPhase] = useState<Phase>('get-started');
  const navigate = useNavigate();

  if (done || hasProgress) return <>{children}</>;

  // Phase 1: Get Started screen. The button press is the gesture that unlocks audio.
  if (phase === 'get-started') {
    return (
      <div
        className="flex h-full w-full flex-col items-center justify-center"
        style={{ fontFamily: FONT, gap: 40, padding: '0 32px' }}
      >
        {/* Brand block */}
        <div className="flex flex-col items-center" style={{ gap: 6 }}>
          <div
            style={{
              color: PRIMARY,
              fontFamily: FONT,
              fontSize: 'clamp(26px, 7vw, 30px)',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              lineHeight: 1,
            }}
          >
            Guided Growth
          </div>
          <span
            style={{
              fontFamily: FONT,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.16em',
              textTransform: 'uppercase' as const,
              color: PRIMARY_70,
            }}
          >
            Behavioral OS
          </span>
        </div>

        {/* CTA cluster */}
        <div className="flex w-full flex-col items-center" style={{ gap: 16 }}>
          <Button
            variant="primary"
            size="auth"
            fullWidth
            onClick={() => setPhase('coach-greeting')}
          >
            Get started
          </Button>
          <button
            type="button"
            style={{ fontFamily: FONT, color: SUBTLE, fontSize: 14, fontWeight: 600 }}
            onClick={() => navigate('/login')}
          >
            I already have an account
          </button>
        </div>
      </div>
    );
  }

  // Phase 2: Coach greeting. autoPlay fires immediately because the Get Started
  // press (a real user gesture) already unlocked audio in this page context.
  return (
    <SplashIntro
      autoPlay
      skipSplash
      audioSrc="/voice/splash_welcome.mp3"
      onComplete={() => {
        try {
          localStorage.setItem(INTRO_SEEN_KEY, '1');
        } catch {
          // best-effort; private mode just replays the intro next mount
        }
        setDone(true);
      }}
    />
  );
}
