/**
 * IntroGate — plays the opening animation (orb bloom + coach MP3) before the
 * chat begins, then reveals it. The intro is a phase before the flow, not a beat,
 * so the orchestrator/machine stay unchanged. SplashIntro fires onComplete when
 * the coach finishes the opener; we then hand off to the chat (which starts at
 * the auth beat).
 *
 * First-visit only: a returning/mid-flow user (past the auth beat) resumes
 * straight into chat, and a seen-flag survives refresh so the splash never
 * replays on reload.
 */
import { useState } from 'react';
import { SplashIntro } from '@/components/welcome/SplashIntro';
import { useOnboarding } from '@/hooks/useOnboarding';

const INTRO_SEEN_KEY = 'gg_onboarding_intro_seen';

function readSeen(): boolean {
  try {
    return localStorage.getItem(INTRO_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function IntroGate({ children }: { children: React.ReactNode }) {
  const { state } = useOnboarding();
  // current_step >= 1 means past the auth beat — resume into chat, no intro.
  const hasProgress = (state?.current_step ?? 0) >= 1;
  const [done, setDone] = useState(readSeen);

  if (done || hasProgress) return <>{children}</>;

  return (
    <SplashIntro
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
