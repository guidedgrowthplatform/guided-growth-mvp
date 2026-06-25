import { useEffect, useRef, useState } from 'react';
import { CoachIntroBubble } from '@/components/welcome/CoachIntroBubble';
import { SPLASH_CAPTIONS } from '@/components/welcome/splashCaptions';
import { BeatPlayer, useIsPlaying, type BeatDef, type BeatStep } from '../beatKit';

const GREETING =
  "Hey, I might have startled you. You're probably not used to an app just talking to you. I'm your AI coach here at your service at Guided Growth, and I'm excited to help you improve things in your life that are important to you. So let's get you in, and we'll get started.";

// The coach greeting beat. In Play (live) it plays the real recording in Yair's
// voice (public/voice/splash_welcome.mp3) and the karaoke fills word by word,
// synced to the audio via SPLASH_CAPTIONS. As a static design tile it shows the
// greeting as a plain karaoke bubble (no audio), so 12 beats do not all autoplay.
function CoachGreetingBeat(props?: Record<string, string>) {
  const playing = useIsPlaying();
  if (playing) return <GreetingAudio />;
  const steps: BeatStep[] = [
    { id: 'greet', speaker: 'coach', say: props?.greeting ?? GREETING },
  ];
  return <BeatPlayer steps={steps} />;
}

// Plays the recording and karaokes it. Tries to autoplay on mount (entering the
// beat in Play is a user gesture); if the browser blocks it, shows Tap to play.
function GreetingAudio() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [needsTap, setNeedsTap] = useState(false);
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    try {
      el.currentTime = 0;
    } catch {
      /* ignore */
    }
    el.play().catch(() => setNeedsTap(true));
  }, []);
  const start = () => {
    setNeedsTap(false);
    audioRef.current?.play().catch(() => {});
  };
  return (
    <div className="relative w-full" style={{ minHeight: 360 }}>
      <audio ref={audioRef} src="/voice/splash_welcome.mp3" preload="auto" playsInline className="hidden" />
      <CoachIntroBubble audioRef={audioRef} lines={SPLASH_CAPTIONS} active top="8px" />
      {needsTap && (
        <button
          type="button"
          onClick={start}
          className="absolute inset-x-0 bottom-2 flex justify-center"
          aria-label="Play the greeting"
        >
          <span className="rounded-full bg-white/90 px-4 py-2 text-[13px] font-semibold text-primary shadow-card">
            Tap to play
          </span>
        </button>
      )}
    </div>
  );
}

const coachGreetingBeat: BeatDef = {
  type: 'splash-intro',
  group: 'Onboarding',
  label: 'Coach greeting',
  Comp: CoachGreetingBeat,
};

export default coachGreetingBeat;
