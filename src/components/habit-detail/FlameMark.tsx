import { useEffect, useRef, useState } from 'react';

// The reusable flame graphic, no count. Drop it into any component that needs a
// streak flame (the week grid, StreakCard, MilestoneBadge, a home habit row).
//
// Resting looks, from Yair's reference (streak-flame-animation.html):
//   lit   = orange outer (#FF8A1E) + gold core (#FFC83D), flickering gently.
//   unlit = a quiet solid gray (#D1D5DB) flame.
//
// Celebration (Stage 2): pass a changing `burstNonce` to fire the "just marked"
// moment once: the flame pops (streak-burst), a glow pulses, embers rise, and
// sparks fly, then it eases back to the gentle flicker. Opt-in on purpose, so a
// grid of many flames stays calm and only a single home-row flame celebrates.
// Colors are the exact reference values so it matches the HTML regardless of the
// --color-streak token.

export type FlameSize = 'sm' | 'md' | 'lg';

const SIZE_PX: Record<FlameSize, number> = { sm: 16, md: 22, lg: 32 };

const OUTER_PATH =
  'M12 12c2 -2.96 0 -7 -1 -8c0 3.038 -1.773 4.741 -3 6c-1.226 1.26 -2 3.24 -2 5a6 6 0 1 0 12 0c0 -1.532 -1.056 -3.94 -2 -5c-1.786 3 -2.791 3 -4 2z';
const CORE_PATH =
  'M12 15c1 -1.5 .5 -3.5 -.5 -4.5c-.3 1.4 -1.1 2.2 -1.8 2.9c-.6 .6 -1 1.5 -1 2.4a2.8 2.8 0 1 0 5.6 0c0 -.8 -.5 -1.9 -1 -2.4c-.7 1.3 -1.1 1.4 -1.3 1.6z';

const EMBERS: { ex: string; delay: string }[] = [
  { ex: '-5px', delay: '0.05s' },
  { ex: '5px', delay: '0.35s' },
  { ex: '0px', delay: '0.6s' },
];
const SPARKS: { dx: string; dy: string }[] = [
  { dx: '-16px', dy: '-16px' },
  { dx: '14px', dy: '-18px' },
  { dx: '0px', dy: '-22px' },
];

export function FlameMark({
  lit,
  size = 'sm',
  burstNonce,
}: {
  lit: boolean;
  size?: FlameSize;
  burstNonce?: number;
}) {
  const px = SIZE_PX[size];
  const [bursting, setBursting] = useState(false);
  const prevNonce = useRef(burstNonce);

  useEffect(() => {
    if (burstNonce === undefined || burstNonce === prevNonce.current) return;
    prevNonce.current = burstNonce;
    setBursting(true);
    const t = window.setTimeout(() => setBursting(false), 700);
    return () => window.clearTimeout(t);
  }, [burstNonce]);

  // Gray zero-state, unless a 0 -> 1 burst is lighting it up right now.
  if (!lit && !bursting) {
    return (
      <svg viewBox="0 0 24 24" style={{ width: px, height: px }} fill="#D1D5DB" aria-hidden="true">
        <path d={OUTER_PATH} />
      </svg>
    );
  }

  const outerAnim = bursting
    ? 'animate-[streak-burst_0.65s_ease-out]'
    : 'animate-[flame-flicker_1.4s_ease-in-out_infinite]';
  const coreAnim = bursting
    ? 'animate-[streak-burst_0.65s_ease-out]'
    : 'animate-[streak-core-flicker_1.1s_ease-in-out_infinite]';

  return (
    <span className="relative inline-block" style={{ width: px, height: px }}>
      {bursting && (
        <span
          className="pointer-events-none absolute animate-[streak-glow_1.1s_ease-in-out] motion-reduce:hidden"
          style={
            {
              left: '50%',
              top: '50%',
              width: px * 2,
              height: px * 2,
              marginLeft: -px,
              marginTop: -px,
              borderRadius: '50%',
              background: 'radial-gradient(circle, #FF8A1E 0%, rgba(255,138,30,0) 70%)',
            } as React.CSSProperties
          }
        />
      )}

      <svg
        viewBox="0 0 24 24"
        className={`absolute inset-0 h-full w-full ${outerAnim} motion-reduce:animate-none`}
        style={{ transformOrigin: '50% 80%' }}
        fill="#FF8A1E"
        aria-hidden="true"
      >
        <path d={OUTER_PATH} />
      </svg>
      <svg
        viewBox="0 0 24 24"
        className={`absolute inset-0 h-full w-full ${coreAnim} motion-reduce:animate-none`}
        style={{ transformOrigin: '50% 80%' }}
        fill="#FFC83D"
        aria-hidden="true"
      >
        <path d={CORE_PATH} />
      </svg>

      {bursting && (
        <span className="pointer-events-none absolute inset-0 motion-reduce:hidden" aria-hidden="true">
          {EMBERS.map((e, i) => (
            <span
              key={`ember-${i}`}
              className="absolute left-1/2 animate-[streak-ember_1.2s_ease-out] rounded-full"
              style={
                {
                  bottom: '12%',
                  width: 4,
                  height: 4,
                  background: '#FFB23E',
                  animationDelay: e.delay,
                  ['--ex']: e.ex,
                } as React.CSSProperties
              }
            />
          ))}
          {SPARKS.map((s, i) => (
            <span
              key={`spark-${i}`}
              className="absolute left-1/2 top-1/2 animate-[streak-spark_0.6s_ease-out] rounded-full"
              style={
                {
                  width: 5,
                  height: 5,
                  background: '#FF8A1E',
                  ['--dx']: s.dx,
                  ['--dy']: s.dy,
                } as React.CSSProperties
              }
            />
          ))}
        </span>
      )}
    </span>
  );
}
