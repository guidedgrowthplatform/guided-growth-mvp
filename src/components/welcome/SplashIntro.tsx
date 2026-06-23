import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';

// Phase durations (ms)
const PHASE_SPLASH_HOLD = 1200;
const PHASE_SPLASH_FADE = 400;
const PHASE_ORB_ENTER = 500;
const PHASE_ORB_HOLD = 1700;
const PHASE_ORB_SETTLE = 600;
const PHASE_AUTH_FADE = 500;
const LOOP_PAUSE = 1800;

// Phases: 'splash' -> 'orb' -> 'auth' -> ('done' | loop back)
type Phase = 'splash' | 'splash-out' | 'orb' | 'orb-settle' | 'auth' | 'done';

interface SplashIntroProps {
  onComplete?: () => void;
  loop?: boolean;
  autoPlay?: boolean;
}

// Injected once per document lifecycle, not per mount.
let stylesInjected = false;
function ensureStyles() {
  if (stylesInjected || typeof document === 'undefined') return;
  stylesInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    @keyframes splash-intro-ripple-expand {
      0%   { transform: scale(0.85); opacity: 0.55; }
      60%  { transform: scale(1.12); opacity: 0.22; }
      100% { transform: scale(1.35); opacity: 0; }
    }
    @keyframes splash-intro-waveform {
      0%, 100% { transform: scaleY(0.35); }
      15%       { transform: scaleY(1); }
      30%       { transform: scaleY(0.55); }
      45%       { transform: scaleY(0.85); }
      60%       { transform: scaleY(0.4); }
      75%       { transform: scaleY(0.95); }
      90%       { transform: scaleY(0.6); }
    }
    @keyframes splash-intro-orb-glow {
      0%, 100% { box-shadow: 0 0 0 0 rgba(19,91,235,0.22), 0 0 0 16px rgba(19,91,235,0.08), 0 24px 48px -4px rgba(19,91,235,0.28); }
      50%       { box-shadow: 0 0 0 8px rgba(19,91,235,0.14), 0 0 0 28px rgba(19,91,235,0.05), 0 32px 64px -4px rgba(19,91,235,0.38); }
    }
    @keyframes splash-intro-caption-in {
      0%   { opacity: 0; transform: translateY(6px); }
      100% { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(style);
}

export function SplashIntro({ onComplete, loop = false, autoPlay = true }: SplashIntroProps) {
  ensureStyles();
  const [phase, setPhase] = useState<Phase>(autoPlay ? 'splash' : 'done');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefersReducedMotion =
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;

  const schedule = (fn: () => void, delay: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(fn, prefersReducedMotion ? 120 : delay);
  };

  const runSequence = () => {
    setPhase('splash');
    schedule(() => {
      setPhase('splash-out');
      schedule(() => {
        setPhase('orb');
        schedule(() => {
          setPhase('orb-settle');
          schedule(
            () => {
              setPhase('auth');
              onComplete?.();
              if (loop) {
                schedule(() => runSequence(), LOOP_PAUSE);
              } else {
                setPhase('done');
              }
            },
            PHASE_AUTH_FADE + (prefersReducedMotion ? 0 : 200),
          );
        }, PHASE_ORB_HOLD);
      }, PHASE_SPLASH_FADE + PHASE_ORB_ENTER);
    }, PHASE_SPLASH_HOLD);
  };

  useEffect(() => {
    if (!autoPlay) return;
    runSequence();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
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

  const captionText = 'Your coach is ready.';

  return (
    <div
      className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-white"
      aria-label="Guided Growth introduction"
    >
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

      {/* Phase 2 + 3: Orb and auth block */}
      {showOrb && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0px',
            transition: prefersReducedMotion ? 'none' : `opacity ${PHASE_ORB_ENTER}ms ease-out`,
            opacity: showOrb ? 1 : 0,
            willChange: 'opacity',
          }}
        >
          {/* Orb area */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '20px',
              transition: prefersReducedMotion
                ? 'none'
                : `transform ${PHASE_ORB_SETTLE}ms cubic-bezier(0.4,0,0.2,1), opacity ${PHASE_ORB_SETTLE}ms ease-out`,
              transform: orbSettled ? 'translateY(-120px) scale(0.72)' : 'translateY(0) scale(1)',
              opacity: 1,
              willChange: 'transform',
            }}
          >
            {/* Ripple rings container */}
            <div
              style={{
                position: 'relative',
                width: orbSpeaking ? '220px' : '180px',
                height: orbSpeaking ? '220px' : '180px',
                transition: prefersReducedMotion
                  ? 'none'
                  : `width ${PHASE_ORB_SETTLE}ms ease-out, height ${PHASE_ORB_SETTLE}ms ease-out`,
                willChange: 'width, height',
              }}
            >
              {/* Expanding ripple rings, only during speaking phase */}
              {!prefersReducedMotion &&
                [0, 1, 2].map((i) => (
                  <div
                    key={i}
                    aria-hidden
                    style={{
                      position: 'absolute',
                      inset: `-${i * 18}px`,
                      borderRadius: '50%',
                      border: '1.5px solid rgba(19,91,235,0.18)',
                      animation: orbSpeaking
                        ? `splash-intro-ripple-expand 2.4s ease-out ${i * 0.55}s infinite`
                        : 'none',
                      opacity: orbSpeaking ? 1 : 0,
                      transition: `opacity ${PHASE_ORB_SETTLE * 0.5}ms ease-out`,
                      willChange: 'transform, opacity',
                      pointerEvents: 'none',
                    }}
                  />
                ))}

              {/* Soft ambient glow behind the orb */}
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  inset: '-12%',
                  borderRadius: '50%',
                  background:
                    'radial-gradient(circle, rgba(19,91,235,0.12) 0%, rgba(19,91,235,0) 70%)',
                  animation:
                    orbSpeaking && !prefersReducedMotion
                      ? 'splash-intro-orb-glow 2s ease-in-out infinite'
                      : 'none',
                  pointerEvents: 'none',
                }}
              />

              {/* The orb itself */}
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  background: `radial-gradient(circle at 38% 36%, rgba(255,255,255,0.92) 0%, rgb(19,91,235) 65%, rgb(14,68,177) 100%)`,
                  boxShadow:
                    '0 24px 48px -4px rgba(19,91,235,0.32), 0 8px 16px rgba(19,91,235,0.18)',
                  animation:
                    orbSpeaking && !prefersReducedMotion
                      ? 'splash-intro-orb-glow 2s ease-in-out infinite'
                      : 'none',
                  willChange: 'box-shadow',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {/* Waveform bars, visible during speaking */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    opacity: orbSpeaking ? 1 : 0,
                    transition: prefersReducedMotion ? 'none' : `opacity 300ms ease-out`,
                  }}
                  aria-hidden
                >
                  {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                    <div
                      key={i}
                      style={{
                        width: '3px',
                        height: `${[14, 26, 20, 34, 18, 28, 12][i]}px`,
                        borderRadius: '2px',
                        background: 'rgba(255,255,255,0.92)',
                        transformOrigin: 'center',
                        animation:
                          orbSpeaking && !prefersReducedMotion
                            ? `splash-intro-waveform 1.3s ease-in-out ${i * 0.11}s infinite`
                            : 'none',
                        willChange: 'transform',
                      }}
                    />
                  ))}
                </div>

                {/* Settled state: small inner highlight dot */}
                <div
                  style={{
                    position: 'absolute',
                    width: '28%',
                    height: '28%',
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.45)',
                    top: '18%',
                    left: '20%',
                    opacity: orbSettled ? 1 : 0,
                    transition: prefersReducedMotion ? 'none' : `opacity 400ms ease-out`,
                    pointerEvents: 'none',
                  }}
                  aria-hidden
                />
              </div>
            </div>

            {/* Caption line under orb, fades in during speaking phase */}
            <p
              style={{
                fontFamily: 'Urbanist, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                fontSize: '15px',
                fontWeight: 500,
                color: 'rgb(100,116,139)',
                letterSpacing: '0.01em',
                margin: 0,
                opacity: orbSpeaking ? 1 : 0,
                transition: prefersReducedMotion ? 'none' : `opacity 400ms ease-out 0.5s`,
                animation:
                  orbSpeaking && !prefersReducedMotion
                    ? 'splash-intro-caption-in 0.5s ease-out 0.55s both'
                    : 'none',
                willChange: 'opacity',
                userSelect: 'none',
                textAlign: 'center',
              }}
              aria-live="polite"
            >
              {captionText}
            </p>
          </div>

          {/* Auth block, fades in after orb settles */}
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
