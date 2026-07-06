import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Orb } from '@/components/orb/Orb';
import { orbIdle } from '@/components/orb/orbView';
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
// the screen to ask for the microphone, its mic (right) half solid grey with the
// mic-off icon. The Allow button sits right under it. On allow, the mic half
// turns gold (mic on) at the top, then the orb settles back down into its dock
// with the mic half on and gold, handing off to the next beat. It borrows the
// orb, it does not own it.
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
  // Separate from granted so the mic can turn yellow at the top first, then descend.
  const [settling, setSettling] = useState(false);
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
        setExpanded(true); // grow up + ask (grey mic)
        if (loop) {
          // Demo the happy path so the dock shows the real outcome, not a retract to
          // grey: after the ask, "allow" (mic turns gold at the top), settle down into
          // the dock with the mic ON and gold, hold, then reset and loop.
          const t1 = EXPAND_MS + HOLD_MS; // allow
          const t2 = t1 + 560; // start descending, gold
          const t3 = t2 + SETTLE_MS + 600; // reset for the next loop
          push(() => setGranted(true), t1);
          push(() => setSettling(true), t2);
          push(() => {
            setExpanded(false);
            setGranted(false);
            setSettling(false);
          }, t3);
          push(run, t3 + RETRACT_HOLD_MS);
        }
      }, 280);
    };
    run();
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay, loop]);

  // Grant: mic half turns gold (mic on) and the orb slides down into its dock, then
  // we signal the flow to advance.
  const handleAllow = () => {
    if (granted) return;
    // 1) mic turns yellow immediately, still up at the top. 2) after a short hold it
    // descends into the dock, yellow. 3) then the flow advances.
    setGranted(true);
    const hold = prefersReducedMotion ? 100 : 480;
    const settle = prefersReducedMotion ? 120 : SETTLE_MS;
    timers.current.push(setTimeout(() => setSettling(true), hold));
    timers.current.push(setTimeout(() => onAllow?.(), hold + settle));
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
          top: settling ? ORB_REST_TOP : asking || granted ? ASK_TOP : ORB_REST_TOP,
          transform: `translate(-50%, -50%) scale(${settling ? ORB_REST_SCALE : asking || granted ? 1 : ORB_REST_SCALE})`,
          transition: orbTransition,
          willChange: 'top, transform',
          cursor: asking ? 'pointer' : 'default',
          pointerEvents: asking ? 'auto' : 'none',
        }}
      >
        <Orb {...orbIdle(ORB_SIZE, true, granted)} onToggleRight={asking ? handleAllow : undefined} />
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
