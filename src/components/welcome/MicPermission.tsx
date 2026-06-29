import { useEffect, useRef, useState } from 'react';
import { IconChatVoice, IconMic, IconMicMuted } from '@/components/icons';
import { Button } from '@/components/ui/Button';
import { DualButton } from '@/components/ui/DualButton';
import { ORB_REST_SCALE, ORB_REST_TOP } from '@/components/welcome/SplashIntro';

const ORB_SIZE = 150;
// Orb rises all the way to the top so the centred iOS/Android permission
// dialog (which we cannot draw over) never covers it.
const ASK_TOP = '20%';
const EXPAND_MS = 650;
const SETTLE_MS = 700;
// Demo loop timings (only used when loop is set).
const HOLD_MS = 3200;
const RETRACT_HOLD_MS = 1200;

interface MicPermissionProps {
  /** Fires after the grant animation finishes (orb has settled into its dock). */
  onAllow?: () => void;
  /** Fires when the user defers. */
  onSkip?: () => void;
  /** Heading + sub copy (placeholders, easy to change). */
  heading?: string;
  subheading?: string;
  /** Expand on mount. */
  autoPlay?: boolean;
  /** Loop the expand/retract for previewing. */
  loop?: boolean;
}

// Animation beat: the shared orb grows up from its resting dock to the TOP of
// the screen to ask for the microphone, its mic (right) half grey and pulsing
// for attention. The Allow button sits right under it. On allow, the mic half
// turns blue and the orb settles back down into its dock, handing off to the
// next beat. It borrows the orb, it does not own it.
export function MicPermission({
  onAllow,
  onSkip,
  heading = 'Allow your microphone',
  subheading = 'So you can talk with your coach out loud.',
  autoPlay = true,
  loop = false,
}: MicPermissionProps) {
  const [expanded, setExpanded] = useState(false);
  const [granted, setGranted] = useState(false);
  const prefersReducedMotion =
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  useEffect(() => {
    if (!autoPlay) return;
    const push = (fn: () => void, ms: number) => {
      timers.current.push(setTimeout(fn, prefersReducedMotion ? Math.min(ms, 120) : ms));
    };
    const run = () => {
      push(() => {
        setExpanded(true);
        if (loop) {
          push(() => {
            setExpanded(false);
            push(run, RETRACT_HOLD_MS);
          }, EXPAND_MS + HOLD_MS);
        }
      }, 280);
    };
    run();
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay, loop]);

  // Grant: mic half turns blue and the orb slides down into its dock, then we
  // signal the flow to advance.
  const handleAllow = () => {
    if (granted) return;
    setGranted(true);
    timers.current.push(setTimeout(() => onAllow?.(), prefersReducedMotion ? 120 : SETTLE_MS));
  };

  const asking = expanded && !granted;

  const orbTransition = prefersReducedMotion
    ? 'none'
    : `top ${EXPAND_MS}ms cubic-bezier(0.34,1.2,0.4,1), transform ${EXPAND_MS}ms cubic-bezier(0.34,1.2,0.4,1)`;

  return (
    <div
      className="relative flex h-full w-full flex-col items-center overflow-hidden"
      aria-label="Microphone permission"
    >
      {/* The shared orb. Rests at the dock, grows to the top to ask, settles
          back to the dock once granted. Tappable while asking. */}
      <div
        onClick={asking ? handleAllow : undefined}
        style={{
          position: 'absolute',
          left: '50%',
          top: granted ? ORB_REST_TOP : asking ? ASK_TOP : ORB_REST_TOP,
          transform: `translate(-50%, -50%) scale(${granted ? ORB_REST_SCALE : asking ? 1 : ORB_REST_SCALE})`,
          transition: orbTransition,
          willChange: 'top, transform',
          cursor: asking ? 'pointer' : 'default',
          pointerEvents: asking ? 'auto' : 'none',
        }}
      >
        <DualButton
          size={ORB_SIZE}
          leftActive
          // Mic half stays blue (active) while the user speaks/asks, not just
          // after granting — it's the user's active turn (gold waves on the right).
          rightActive={asking || granted}
          activeRings={asking ? 'right' : null}
          ringCount={3}
          ringStep={7}
          intensity={0.5}
          leftIcon={<IconChatVoice size={38} />}
          rightIcon={asking || granted ? <IconMic size={38} /> : <IconMicMuted size={38} />}
          leftAriaLabel="Coach voice"
          rightAriaLabel="Microphone"
        />
      </div>

      {/* Prompt + Allow button, directly under the orb. Fades in once the orb
          has grown, fades out the moment it is granted. */}
      <div
        style={{
          position: 'absolute',
          top: '33%',
          left: 0,
          right: 0,
          padding: '0 28px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '14px',
          textAlign: 'center',
          opacity: asking ? 1 : 0,
          transform: asking ? 'translateY(0)' : 'translateY(10px)',
          transition: prefersReducedMotion
            ? 'none'
            : 'opacity 400ms ease-out 180ms, transform 400ms ease-out 180ms',
          pointerEvents: asking ? 'auto' : 'none',
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: 'Urbanist, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              fontSize: 'clamp(22px, 6vw, 28px)',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: 'rgb(19, 91, 235)',
              margin: 0,
              lineHeight: 1.15,
            }}
          >
            {heading}
          </h1>
          <p
            style={{
              fontFamily: 'Urbanist, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              fontSize: '15px',
              fontWeight: 500,
              color: 'rgb(100,116,139)',
              margin: '10px auto 0',
              maxWidth: 300,
              lineHeight: 1.4,
            }}
          >
            {subheading}
          </p>
        </div>

        <Button variant="primary" size="auth" fullWidth onClick={handleAllow}>
          Allow microphone
        </Button>

        <span
          onClick={onSkip}
          style={{
            fontFamily: 'Urbanist, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            fontSize: '14px',
            fontWeight: 600,
            color: 'rgb(100,116,139)',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          Not now
        </span>
      </div>
    </div>
  );
}
