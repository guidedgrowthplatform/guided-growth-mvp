/**
 * IntroGate — plays the opening animation (orb bloom + coach MP3) before the
 * chat begins, then reveals it. The intro is a phase before the flow, not a beat,
 * so the orchestrator/machine stay unchanged. SplashIntro fires onComplete when
 * the coach finishes the opener; we then hand off to the chat (which starts at
 * the auth beat).
 */
import { useState } from 'react';
import { SplashIntro } from '@/components/welcome/SplashIntro';

export function IntroGate({ children }: { children: React.ReactNode }) {
  const [done, setDone] = useState(false);
  if (!done) {
    return <SplashIntro audioSrc="/voice/splash_welcome.mp3" onComplete={() => setDone(true)} />;
  }
  return <>{children}</>;
}
