import { useEffect, useRef, useState } from 'react';
import { IconChatVoice, IconMicMuted } from '@/components/icons';
import { isQaMuted, subscribe as subscribeQaSound } from '@/onboarding-flow/qaSound';
import { DualButton } from '@/components/ui/DualButton';
import { CoachIntroBubble } from '@/components/welcome/CoachIntroBubble';
import { SPLASH_CAPTIONS } from '@/components/welcome/splashCaptions';
import { VoiceCone } from '@/components/welcome/VoiceCone';

// Phase durations (ms)
const PHASE_SPLASH_HOLD = 1200;
const PHASE_SPLASH_FADE = 400;
const PHASE_ORB_ENTER = 500;
const PHASE_ORB_SETTLE = 700;
const PHASE_READY_HOLD = 500;
const LOOP_PAUSE = 1800;

const FALLBACK_SPEAK_MS = 2600;
const MAX_SPEAK_MS = 16000;
const REDUCED_HOLD_MS = 280;

const ORB_SIZE = 150;
// How hard the orb itself swells with the voice (Siri-style breathing).
const ORB_PULSE = 0.12;
// DualButton's center gap, and the right edge / center of the left (voice) half
// as % of the dial, so the voice group anchors at the seam and the icon sits
// centered in it.
const ORB_GAP = Math.max(5, Math.round(ORB_SIZE * 0.06));
const VOICE_ICON_PCT = ((ORB_SIZE / 2 - ORB_GAP / 2) / 2 / ORB_SIZE) * 100;

// Speaking pose: orb sits high (upper third) so the coach bubble reads below it.
const SPEAK_TOP_RATIO = 0.34;
const SPEAK_TOP = '34%';
const BUBBLE_TOP = '50%';

// Resting pose: where the orb travels to when it settles. Kept in sync with
// SignInScreen's resting orb so the orb reads as one continuous element.
export const ORB_REST_TOP = '87%';
export const ORB_REST_SCALE = 0.46;

// Phases: 'splash' -> 'orb' (coach speaks) -> 'orb-settle' -> 'ready' -> 'done'
type Phase = 'splash' | 'splash-out' | 'orb' | 'orb-settle' | 'ready' | 'done';

interface SplashIntroProps {
  onComplete?: () => void;
  loop?: boolean;
  autoPlay?: boolean;
  audioSrc?: string;
  // Mute the clip (the silent builder thumbnail): it still plays so the words
  // fill and the orb rides the envelope, just without sound.
  muted?: boolean;
  // Skip the wordmark splash and start straight at the coach speaking (used when
  // an earlier beat already showed the wordmark).
  skipSplash?: boolean;
}

let stylesInjected = false;
function ensureStyles() {
  if (stylesInjected || typeof document === 'undefined') return;
  stylesInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    @keyframes splash-intro-orb-glow {
      0%, 100% { opacity: 0.5; }
      50%       { opacity: 0.85; }
    }
    @keyframes splash-intro-orb-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @keyframes splash-orb-ring {
      0%, 100% { transform: scale(1); opacity: 0.22; }
      50%      { transform: scale(1.045); opacity: 0.42; }
    }
  `;
  document.head.appendChild(style);
}

export function SplashIntro({
  onComplete,
  loop = false,
  autoPlay = true,
  audioSrc,
  muted = false,
  skipSplash = false,
}: SplashIntroProps) {
  ensureStyles();
  const [phase, setPhase] = useState<Phase>(
    autoPlay ? (skipSplash ? 'orb' : 'splash') : 'done',
  );
  const [intensity, setIntensity] = useState(0);
  // Shows a tap affordance when the browser blocks audio until a gesture.
  const [needsTap, setNeedsTap] = useState(false);

  const prefersReducedMotion =
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;

  const seqTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speakTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const capTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speakingRef = useRef(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const envRef = useRef<number[] | null>(null);
  const envBucketMsRef = useRef(50);
  const rafRef = useRef<number | null>(null);
  const awaitingGestureRef = useRef(false);
  const onPlayingRef = useRef<(() => void) | null>(null);

  const seqSchedule = (fn: () => void, delay: number) => {
    if (seqTimerRef.current) clearTimeout(seqTimerRef.current);
    seqTimerRef.current = setTimeout(fn, prefersReducedMotion ? 120 : delay);
  };

  const stopRaf = () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  };

  const clearSpeakTimers = () => {
    if (speakTimerRef.current) clearTimeout(speakTimerRef.current);
    if (capTimerRef.current) clearTimeout(capTimerRef.current);
    speakTimerRef.current = null;
    capTimerRef.current = null;
  };

  // Decode the clip once into a normalized RMS envelope (one value per 50ms) so
  // the orb and horn can ride the real loudness in sync with playback.
  const loadEnvelope = async () => {
    if (!audioSrc || envRef.current) return;
    try {
      const res = await fetch(audioSrc);
      const arr = await res.arrayBuffer();
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const audioBuf = await ctx.decodeAudioData(arr);
      void ctx.close();
      const data = audioBuf.getChannelData(0);
      const sr = audioBuf.sampleRate;
      const bucketSize = Math.max(1, Math.floor((sr * 50) / 1000));
      const env: number[] = [];
      let max = 0.0001;
      for (let i = 0; i < data.length; i += bucketSize) {
        let sum = 0;
        const end = Math.min(i + bucketSize, data.length);
        for (let j = i; j < end; j++) sum += data[j] * data[j];
        const rms = Math.sqrt(sum / Math.max(1, end - i));
        env.push(rms);
        if (rms > max) max = rms;
      }
      for (let i = 0; i < env.length; i++) env[i] = Math.min(1, env[i] / max);
      envRef.current = env;
      envBucketMsRef.current = 50;
      console.log('[splash-audio] envelope ready, buckets:', env.length);
    } catch (e) {
      console.warn('[splash-audio] envelope decode failed', e);
    }
  };

  const sampleEnv = (t: number): number => {
    const env = envRef.current;
    if (!env || env.length === 0) return 0;
    const idx = Math.floor((t * 1000) / envBucketMsRef.current);
    if (idx < 0) return 0;
    if (idx >= env.length) return env[env.length - 1];
    return env[idx];
  };

  const startEnvLoop = () => {
    stopRaf();
    const tick = () => {
      const el = audioRef.current;
      const t = el ? el.currentTime : 0;
      const bucket = Math.round(Math.min(1, sampleEnv(t) * 1.25) / 0.05) * 0.05;
      setIntensity((prev) => (prev === bucket ? prev : bucket));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const simulatePulse = () => {
    stopRaf();
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
    awaitingGestureRef.current = false;
    setNeedsTap(false);
    clearSpeakTimers();
    stopRaf();
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

  // Called once the clip is actually playing: start the amplitude loop + cap.
  const onPlaying = () => {
    awaitingGestureRef.current = false;
    setNeedsTap(false);
    startEnvLoop();
    if (capTimerRef.current) clearTimeout(capTimerRef.current);
    capTimerRef.current = setTimeout(finishSpeaking, MAX_SPEAK_MS);
    console.log('[splash-audio] playing');
  };

  // Play after a user gesture (tap button or any pointerdown while holding).
  const unlockAndPlay = () => {
    const el = audioRef.current;
    if (!el) return;
    el.play()
      .then(onPlaying)
      .catch((e) => console.warn('[splash-audio] play after gesture failed', e?.name, e?.message));
  };

  const startSpeaking = () => {
    speakingRef.current = true;
    setPhase('orb');

    if (prefersReducedMotion) {
      speakTimerRef.current = setTimeout(finishSpeaking, REDUCED_HOLD_MS);
      return;
    }

    const el = audioRef.current;
    if (!el || !audioSrc) {
      simulatePulse();
      speakTimerRef.current = setTimeout(finishSpeaking, FALLBACK_SPEAK_MS);
      return;
    }

    el.onended = () => finishSpeaking();
    el.onerror = () =>
      console.warn('[splash-audio] element error', el.error?.code, el.error?.message);
    try {
      el.currentTime = 0;
    } catch {
      // ignore
    }
    onPlayingRef.current = onPlaying;

    console.log('[splash-audio] play() attempt; readyState', el.readyState);
    const p = el.play();
    if (p && typeof p.then === 'function') {
      p.then(onPlaying).catch((e) => {
        console.warn('[splash-audio] autoplay blocked, waiting for tap:', e?.name, e?.message);
        awaitingGestureRef.current = true;
        setNeedsTap(true);
      });
    } else {
      onPlaying();
    }
  };

  const runSequence = () => {
    if (skipSplash) {
      startSpeaking();
      return;
    }
    setPhase('splash');
    seqSchedule(() => {
      setPhase('splash-out');
      seqSchedule(() => {
        startSpeaking();
      }, PHASE_SPLASH_FADE + PHASE_ORB_ENTER);
    }, PHASE_SPLASH_HOLD);
  };

  // Any pointer gesture also unlocks audio when we are holding for one.
  useEffect(() => {
    const onGesture = () => {
      if (awaitingGestureRef.current) unlockAndPlay();
    };
    window.addEventListener('pointerdown', onGesture);
    return () => window.removeEventListener('pointerdown', onGesture);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!autoPlay) return;
    void loadEnvelope();
    runSequence();
    return () => {
      if (seqTimerRef.current) clearTimeout(seqTimerRef.current);
      clearSpeakTimers();
      stopRaf();
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

  // Mirror QA mute-toggle onto the audio element live so toggling mid-clip works.
  // The `muted` prop from the caller (e.g. flow-designer preview) takes precedence
  // when it's explicitly true; the QA store is an additional overlay on top.
  useEffect(() => {
    const sync = () => {
      const el = audioRef.current;
      if (el) el.muted = muted || isQaMuted();
    };
    // Apply immediately in case the element already exists.
    sync();
    return subscribeQaSound(sync);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [muted]);

  const showSplash = phase === 'splash' || phase === 'splash-out';
  const splashVisible = phase === 'splash';
  const showOrb =
    phase === 'orb' || phase === 'orb-settle' || phase === 'ready' || phase === 'done';
  const orbSpeaking = phase === 'orb';
  const orbSettled = phase === 'orb-settle' || phase === 'ready' || phase === 'done';
  const orbPulse = orbSpeaking ? 1 + intensity * ORB_PULSE : 1;

  return (
    <div
      className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden"
      aria-label="Guided Growth introduction"
    >
      <audio ref={audioRef} src={audioSrc} preload="auto" playsInline muted={muted || isQaMuted()} className="hidden" />

      {/* Soft blue glow around the screen edge, breathing with the voice
          (a calm take on the new Siri look). */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          boxShadow: 'inset 0 0 55px 8px rgba(19,91,236,0.22)',
          opacity: orbSpeaking ? 0.3 + intensity * 0.55 : 0,
          transition: `opacity ${orbSpeaking ? 120 : PHASE_ORB_SETTLE}ms ease-out`,
          pointerEvents: 'none',
        }}
      />

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
          <div
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}
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
                transform: splashVisible
                  ? 'scale(1) translateY(0)'
                  : 'scale(0.96) translateY(-4px)',
                willChange: 'opacity, transform',
              }}
            >
              Guided Growth
            </h1>
            <div
              style={{
                fontFamily: 'Urbanist, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                fontSize: 'clamp(15px, 4.2vw, 20px)',
                fontWeight: 600,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'rgb(19, 91, 236)',
                lineHeight: 1.1,
                transition: prefersReducedMotion
                  ? 'none'
                  : `opacity ${PHASE_SPLASH_FADE * 0.6}ms ease-out, transform ${PHASE_SPLASH_FADE * 0.6}ms ease-out`,
                opacity: splashVisible ? 1 : 0,
                transform: splashVisible ? 'translateY(0)' : 'translateY(-3px)',
                willChange: 'opacity, transform',
              }}
            >
              Behavioral OS
            </div>
          </div>
        </div>
      )}

      {/* Phase 2 + 3: Orb sits high, speaks (pulsing with the voice), then
          travels down + shrinks to its resting pose at the bottom. */}
      {showOrb && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <VoiceCone
            active={orbSpeaking}
            intensity={intensity}
            orbRadius={ORB_SIZE / 2}
            originYRatio={SPEAK_TOP_RATIO}
          />

          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: orbSettled ? ORB_REST_TOP : SPEAK_TOP,
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
            {/* Orb group: only the left (voice) half breathes with the speech. */}
            <div
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {/* Soft ambient glow (gentle and symmetric, not the pulse). */}
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  width: ORB_SIZE * 1.7,
                  height: ORB_SIZE * 1.7,
                  borderRadius: '50%',
                  background:
                    'radial-gradient(circle, rgba(19,91,235,0.16) 0%, rgba(19,91,235,0) 68%)',
                  opacity: orbSpeaking ? 0.5 : 0,
                  animation:
                    orbSpeaking && !prefersReducedMotion
                      ? 'splash-intro-orb-glow 2.4s ease-in-out infinite'
                      : 'none',
                  transition: `opacity ${PHASE_ORB_SETTLE}ms ease-out`,
                  pointerEvents: 'none',
                }}
              />

              {/* Tiny breathing ring around the orb, just to feel alive. */}
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  width: ORB_SIZE + 18,
                  height: ORB_SIZE + 18,
                  borderRadius: '50%',
                  border: '1.5px solid rgba(19,91,236,0.32)',
                  opacity: orbSpeaking ? 1 : 0,
                  animation:
                    orbSpeaking && !prefersReducedMotion
                      ? 'splash-orb-ring 3s ease-in-out infinite'
                      : 'none',
                  transition: `opacity ${PHASE_ORB_SETTLE}ms ease-out`,
                  pointerEvents: 'none',
                }}
              />

              {/* Left (voice) half breathing out from the seam BEHIND the dial,
                  so only the growth rim shows (the look you liked). */}
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  width: ORB_SIZE,
                  height: ORB_SIZE,
                  marginLeft: -ORB_SIZE / 2,
                  marginTop: -ORB_SIZE / 2,
                  background: '#135BEC',
                  clipPath: `inset(0 50% 0 0 round ${ORB_SIZE / 2}px 0 0 ${ORB_SIZE / 2}px)`,
                  transformOrigin: '50% 50%',
                  transform: `scale(${orbPulse})`,
                  transition: 'transform 90ms ease-out',
                  willChange: 'transform',
                  pointerEvents: 'none',
                }}
              />

              <DualButton
                size={ORB_SIZE}
                leftActive
                rightActive={false}
                leftIcon={null}
                rightIcon={<IconMicMuted size={36} />}
                leftAriaLabel="Coach voice"
                rightAriaLabel="Microphone off"
              />

              {/* Voice icon in a full-dial container scaled on the SAME center as
                  the half, so it tracks the half exactly with no drift. */}
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  width: ORB_SIZE,
                  height: ORB_SIZE,
                  marginLeft: -ORB_SIZE / 2,
                  marginTop: -ORB_SIZE / 2,
                  transformOrigin: '50% 50%',
                  transform: `scale(${orbPulse})`,
                  transition: 'transform 90ms ease-out',
                  willChange: 'transform',
                  pointerEvents: 'none',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    left: `${VOICE_ICON_PCT}%`,
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    color: '#fff',
                    display: 'flex',
                  }}
                >
                  <IconChatVoice size={38} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Coach words fill into the chat bubble below the orb as the clip plays */}
      <CoachIntroBubble
        audioRef={audioRef}
        lines={SPLASH_CAPTIONS}
        active={orbSpeaking}
        top={BUBBLE_TOP}
      />

    </div>
  );
}
