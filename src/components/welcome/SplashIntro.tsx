import { useEffect, useRef, useState } from 'react';
import { IconChatVoice, IconMic } from '@/components/icons';
import { DualButton } from '@/components/ui/DualButton';

// Phase durations (ms)
const PHASE_SPLASH_HOLD = 1200;
const PHASE_SPLASH_FADE = 400;
const PHASE_ORB_ENTER = 500;
const PHASE_ORB_SETTLE = 700;
const PHASE_READY_HOLD = 500;
const LOOP_PAUSE = 1800;

// Speaking phase falls back to a timer when audio is missing or autoplay is
// blocked. MAX is a hard safety cap so the sequence can never hang on the orb.
const FALLBACK_SPEAK_MS = 2600;
const MAX_SPEAK_MS = 12000;
const REDUCED_HOLD_MS = 280;

// The orb itself (the real DualButton dial). Light splash, so a big calm bloom.
const ORB_SIZE = 150;

// Resting pose: where the orb travels to when it settles. Small, near the
// bottom, the spot it lives in once the coach is "ready". Sign-in (beat 2)
// places its orb at the SAME pose, so the orb reads as one continuous element.
// Keep in sync with SignInScreen's resting orb.
export const ORB_REST_TOP = '87%';
export const ORB_REST_SCALE = 0.46;

// Beat 1 (intro animation only). Sign-in is a separate beat, so this ends on
// the settled "ready" orb resting at the bottom and fires onComplete.
// Phases: 'splash' -> 'orb' (coach speaks) -> 'orb-settle' -> 'ready' -> 'done'
type Phase = 'splash' | 'splash-out' | 'orb' | 'orb-settle' | 'ready' | 'done';

interface SplashIntroProps {
  /** Fires when the intro animation lands on the settled "ready" orb. */
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
    @keyframes splash-intro-orb-in {
      from { opacity: 0; }
      to   { opacity: 1; }
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
      setPhase('ready');
      onComplete?.();
      if (loop) {
        seqSchedule(() => runSequence(), LOOP_PAUSE);
      } else {
        seqSchedule(() => setPhase('done'), PHASE_READY_HOLD);
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
      // Free the AudioContext so remounts (e.g. the beat-flow loop) don't pile
      // up contexts and hit the browser's hard limit.
      if (audioCtxRef.current) {
        try {
          void audioCtxRef.current.close();
        } catch {
          // ignore
        }
        audioCtxRef.current = null;
        analyserRef.current = null;
        sourceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay]);

  // Derived visibility flags
  const showSplash = phase === 'splash' || phase === 'splash-out';
  const splashVisible = phase === 'splash';

  const showOrb =
    phase === 'orb' || phase === 'orb-settle' || phase === 'ready' || phase === 'done';
  const orbSpeaking = phase === 'orb';
  const orbSettled = phase === 'orb-settle' || phase === 'ready' || phase === 'done';

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

      {/* Phase 2 + 3: Orb blooms center, speaks, then travels down + shrinks to
          its resting pose at the bottom (where sign-in picks it up). */}
      {showOrb && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: orbSettled ? ORB_REST_TOP : '50%',
              transform: `translate(-50%, -50%) scale(${orbSettled ? ORB_REST_SCALE : 1})`,
              transition: prefersReducedMotion
                ? 'none'
                : `top ${PHASE_ORB_SETTLE}ms cubic-bezier(0.32,0.02,0.18,1), transform ${PHASE_ORB_SETTLE}ms cubic-bezier(0.32,0.02,0.18,1)`,
              animation: prefersReducedMotion ? 'none' : 'splash-intro-orb-in 450ms ease-out both',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              willChange: 'top, transform',
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
              rightActive
              activeRings={orbSpeaking ? 'left' : null}
              ringCount={3}
              ringStep={7}
              intensity={orbSpeaking ? intensity : 0}
              leftIcon={<IconChatVoice size={38} />}
              rightIcon={<IconMic size={36} />}
              leftAriaLabel="Coach voice"
              rightAriaLabel="Microphone"
            />
          </div>
        </div>
      )}
    </div>
  );
}
