import { useEffect, useRef, useState } from 'react';
import { IconChatVoice, IconMicMuted } from '@/components/icons';
import { Button } from '@/components/ui/Button';
import { DualButton } from '@/components/ui/DualButton';

// Phase durations (ms)
const PHASE_SPLASH_HOLD = 1200;
const PHASE_SPLASH_FADE = 400;
const PHASE_ORB_ENTER = 500;
const PHASE_ORB_SETTLE = 600;
const PHASE_AUTH_FADE = 500;
const LOOP_PAUSE = 1800;

// Speaking phase falls back to a timer when audio is missing or autoplay is
// blocked. MAX is a hard safety cap so the sequence can never hang on the orb.
const FALLBACK_SPEAK_MS = 2600;
const MAX_SPEAK_MS = 12000;
const REDUCED_HOLD_MS = 280;

// The orb itself (the real DualButton dial). Light splash, so a big calm bloom.
const ORB_SIZE = 150;

// Phases: 'splash' -> 'orb' (coach speaks) -> 'orb-settle' -> 'auth' -> 'done'
type Phase = 'splash' | 'splash-out' | 'orb' | 'orb-settle' | 'auth' | 'done';

interface SplashIntroProps {
  onComplete?: () => void;
  loop?: boolean;
  autoPlay?: boolean;
  /** Coach voice clip played during the speaking phase. MP3 for now, TTS later. */
  audioSrc?: string;
}

// Injected once per document lifecycle, not per mount.
let stylesInjected = false;
function ensureStyles() {
  if (stylesInjected || typeof document === 'undefined') return;
  stylesInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    @keyframes splash-intro-orb-glow {
      0%, 100% { opacity: 0.5; transform: scale(1); }
      50%       { opacity: 0.85; transform: scale(1.06); }
    }
  `;
  document.head.appendChild(style);
}

export function SplashIntro({
  onComplete,
  loop = false,
  autoPlay = true,
  audioSrc,
}: SplashIntroProps) {
  ensureStyles();
  const [phase, setPhase] = useState<Phase>(autoPlay ? 'splash' : 'done');
  // 0..1 live amplitude of the coach voice, drives the orb ring pulse.
  const [intensity, setIntensity] = useState(0);

  const prefersReducedMotion =
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;

  // Sequential phase timer (splash, settle, loop pause).
  const seqTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Speaking-phase timers: a fallback end + a hard safety cap.
  const speakTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const capTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards a double finish (audio 'ended' racing the fallback timer).
  const speakingRef = useRef(false);

  // Web Audio graph, created once and reused across loops.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const bufRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const rafRef = useRef<number | null>(null);

  const seqSchedule = (fn: () => void, delay: number) => {
    if (seqTimerRef.current) clearTimeout(seqTimerRef.current);
    seqTimerRef.current = setTimeout(fn, prefersReducedMotion ? 120 : delay);
  };

  const stopAudioLoop = () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  };

  const clearSpeakTimers = () => {
    if (speakTimerRef.current) clearTimeout(speakTimerRef.current);
    if (capTimerRef.current) clearTimeout(capTimerRef.current);
    speakTimerRef.current = null;
    capTimerRef.current = null;
  };

  // Build the analyser graph lazily, once per audio element. Returns false if
  // Web Audio is unavailable so the caller can fall back to a simulated pulse.
  const ensureAudioGraph = (): boolean => {
    if (analyserRef.current) return true;
    const el = audioRef.current;
    if (!el) return false;
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const src = ctx.createMediaElementSource(el);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      analyser.connect(ctx.destination);
      audioCtxRef.current = ctx;
      sourceRef.current = src;
      analyserRef.current = analyser;
      bufRef.current = new Uint8Array(new ArrayBuffer(analyser.fftSize));
      return true;
    } catch {
      return false;
    }
  };

  // Live amplitude from the playing clip: RMS of the time-domain signal,
  // smoothed and bucketed so the orb pulse rides the voice without thrash.
  const runAnalyser = () => {
    const analyser = analyserRef.current;
    const buf = bufRef.current;
    if (!analyser || !buf) return;
    let smoothed = 0;
    const tick = () => {
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / buf.length);
      const target = Math.min(1, rms * 3.4);
      smoothed = smoothed * 0.7 + target * 0.3;
      const bucket = Math.round(smoothed / 0.05) * 0.05;
      setIntensity((prev) => (prev === bucket ? prev : bucket));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  // No audio (missing file or autoplay blocked): a gentle speech-like envelope
  // so the orb still feels alive in the preview.
  const simulatePulse = () => {
    const start = performance.now();
    const tick = () => {
      const t = (performance.now() - start) / 1000;
      const v = 0.4 + 0.3 * Math.sin(t * 6.1) + 0.18 * Math.sin(t * 11.7 + 1);
      const bucket = Math.round(Math.max(0.05, Math.min(1, v)) / 0.05) * 0.05;
      setIntensity(bucket);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const finishSpeaking = () => {
    if (!speakingRef.current) return;
    speakingRef.current = false;
    clearSpeakTimers();
    stopAudioLoop();
    const el = audioRef.current;
    if (el) {
      el.onended = null;
      el.onerror = null;
      try {
        el.pause();
      } catch {
        // ignore
      }
    }
    setIntensity(0);
    setPhase('orb-settle');
    seqSchedule(() => {
      setPhase('auth');
      onComplete?.();
      if (loop) {
        seqSchedule(() => runSequence(), LOOP_PAUSE);
      } else {
        setPhase('done');
      }
    }, PHASE_ORB_SETTLE + 120);
  };

  const startSpeaking = () => {
    speakingRef.current = true;
    setPhase('orb');

    if (prefersReducedMotion) {
      speakTimerRef.current = setTimeout(finishSpeaking, REDUCED_HOLD_MS);
      return;
    }

    const el = audioRef.current;
    if (!el) {
      simulatePulse();
      speakTimerRef.current = setTimeout(finishSpeaking, FALLBACK_SPEAK_MS);
      return;
    }

    // Hard cap so a missing 'ended' event can never strand the sequence.
    capTimerRef.current = setTimeout(finishSpeaking, MAX_SPEAK_MS);

    const graphOk = ensureAudioGraph();
    if (audioCtxRef.current?.state === 'suspended') {
      void audioCtxRef.current.resume().catch(() => {});
    }
    el.onended = () => finishSpeaking();
    el.onerror = () => {
      simulatePulse();
      speakTimerRef.current = setTimeout(finishSpeaking, FALLBACK_SPEAK_MS);
    };

    try {
      el.currentTime = 0;
    } catch {
      // ignore
    }
    const playPromise = el.play();
    if (playPromise && typeof playPromise.then === 'function') {
      playPromise
        .then(() => {
          if (graphOk) runAnalyser();
          else simulatePulse();
        })
        .catch(() => {
          // Autoplay blocked (no user gesture). Show the pulse, time the phase
          // off the clip length if we know it, else a sensible default.
          simulatePulse();
          const durMs =
            el.duration && Number.isFinite(el.duration) ? el.duration * 1000 : FALLBACK_SPEAK_MS;
          speakTimerRef.current = setTimeout(finishSpeaking, durMs);
        });
    } else if (graphOk) {
      runAnalyser();
    } else {
      simulatePulse();
    }
  };

  const runSequence = () => {
    setPhase('splash');
    seqSchedule(() => {
      setPhase('splash-out');
      seqSchedule(() => {
        startSpeaking();
      }, PHASE_SPLASH_FADE + PHASE_ORB_ENTER);
    }, PHASE_SPLASH_HOLD);
  };

  useEffect(() => {
    if (!autoPlay) return;
    runSequence();
    return () => {
      if (seqTimerRef.current) clearTimeout(seqTimerRef.current);
      clearSpeakTimers();
      stopAudioLoop();
      const el = audioRef.current;
      if (el) {
        el.onended = null;
        el.onerror = null;
        try {
          el.pause();
        } catch {
          // ignore
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay]);

  // Derived visibility flags
  const showSplash = phase === 'splash' || phase === 'splash-out';
  const splashVisible = phase === 'splash';

  const showOrb = phase === 'orb' || phase === 'orb-settle' || phase === 'auth' || phase === 'done';
  const orbSpeaking = phase === 'orb';
  const orbSettled = phase === 'orb-settle' || phase === 'auth' || phase === 'done';

  const showAuth = phase === 'auth' || phase === 'done';

  return (
    <div
      className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-white"
      aria-label="Guided Growth introduction"
    >
      {/* Coach voice, played during the speaking phase. */}
      <audio ref={audioRef} src={audioSrc} preload="auto" playsInline className="hidden" />

      {/* Phase 1: Wordmark splash */}
      {showSplash && (
        <div
          aria-hidden={!splashVisible}
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: prefersReducedMotion
              ? 'none'
              : `opacity ${PHASE_SPLASH_FADE}ms ease-out, transform ${PHASE_SPLASH_FADE}ms ease-out`,
            opacity: splashVisible ? 1 : 0,
            transform: splashVisible ? 'scale(1)' : 'scale(0.97)',
            willChange: 'opacity, transform',
            pointerEvents: 'none',
          }}
        >
          <h1
            style={{
              fontFamily: 'Urbanist, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              fontSize: 'clamp(26px, 7vw, 36px)',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: 'rgb(19, 91, 235)',
              margin: 0,
              lineHeight: 1.1,
              transition: prefersReducedMotion
                ? 'none'
                : `opacity ${PHASE_SPLASH_FADE * 0.6}ms ease-out, transform ${PHASE_SPLASH_FADE * 0.6}ms ease-out`,
              opacity: splashVisible ? 1 : 0,
              transform: splashVisible ? 'scale(1) translateY(0)' : 'scale(0.96) translateY(-4px)',
              willChange: 'opacity, transform',
            }}
          >
            Guided Growth
          </h1>
        </div>
      )}

      {/* Phase 2 + 3: Orb (the real dual-button dial) and auth block */}
      {showOrb && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            transition: prefersReducedMotion ? 'none' : `opacity ${PHASE_ORB_ENTER}ms ease-out`,
            opacity: 1,
            willChange: 'opacity',
          }}
        >
          {/* Orb area: blooms in, then lifts and shrinks toward the top. */}
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: prefersReducedMotion
                ? 'none'
                : `transform ${PHASE_ORB_SETTLE}ms cubic-bezier(0.4,0,0.2,1)`,
              transform: orbSettled ? 'translateY(-150px) scale(0.62)' : 'translateY(0) scale(1)',
              willChange: 'transform',
            }}
          >
            {/* Soft ambient glow behind the orb, breathing while it speaks. */}
            <div
              aria-hidden
              style={{
                position: 'absolute',
                width: ORB_SIZE * 1.7,
                height: ORB_SIZE * 1.7,
                borderRadius: '50%',
                background:
                  'radial-gradient(circle, rgba(19,91,235,0.16) 0%, rgba(19,91,235,0) 68%)',
                animation:
                  orbSpeaking && !prefersReducedMotion
                    ? 'splash-intro-orb-glow 2.4s ease-in-out infinite'
                    : 'none',
                opacity: orbSpeaking ? 1 : 0,
                transition: `opacity ${PHASE_ORB_SETTLE}ms ease-out`,
                pointerEvents: 'none',
              }}
            />

            <DualButton
              size={ORB_SIZE}
              leftActive
              rightActive={false}
              activeRings={orbSpeaking ? 'left' : null}
              ringCount={3}
              ringStep={7}
              intensity={orbSpeaking ? intensity : 0}
              leftIcon={<IconChatVoice size={30} />}
              rightIcon={<IconMicMuted size={26} />}
              leftAriaLabel="Coach voice"
              rightAriaLabel="Microphone off"
            />
          </div>

          {/* Auth block, fades in after the orb settles */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              padding: '0 28px 52px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              transition: prefersReducedMotion
                ? 'none'
                : `opacity ${PHASE_AUTH_FADE}ms ease-out, transform ${PHASE_AUTH_FADE}ms ease-out`,
              opacity: showAuth ? 1 : 0,
              transform: showAuth ? 'translateY(0)' : 'translateY(14px)',
              willChange: 'opacity, transform',
              pointerEvents: showAuth ? 'auto' : 'none',
            }}
            aria-hidden={!showAuth}
          >
            {/* Apple button */}
            <Button variant="social-dark" size="auth" fullWidth>
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
              </svg>
              Continue with Apple
            </Button>

            {/* Google button */}
            <Button variant="social-light" size="auth" fullWidth>
              <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continue with Google
            </Button>

            {/* Sign-up text affordance */}
            <p
              style={{
                fontFamily: 'Urbanist, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                fontSize: '14px',
                fontWeight: 500,
                color: 'rgb(100,116,139)',
                textAlign: 'center',
                margin: '4px 0 0',
                letterSpacing: '0.01em',
                userSelect: 'none',
              }}
            >
              No account yet?{' '}
              <span
                style={{
                  color: 'rgb(19,91,235)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Sign up free
              </span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
