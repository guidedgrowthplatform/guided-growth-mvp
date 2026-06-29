import { useEffect, useRef, useState } from 'react';

// The reusable flame graphic, no count. Drop it into any component that needs a
// streak flame (the week grid, StreakCard, MilestoneBadge, a home habit row).
//
// Exact Figma flame (icon-park fire). One path, two-tone via fill + stroke:
//   lit   = red fill #EF4444 with a gold edge #FDD017
//   zero  = gray fill #94A3B8 with a darker gray edge #61656F
//
// Lit flickers gently. Celebration (Stage 2): pass a changing `burstNonce` to fire
// the "just marked" moment once (streak-burst pop, glow, ember rise, sparks), then
// it eases back to the flicker. Opt-in, so a grid of many flames stays calm and
// only a single home-row flame celebrates on tap.

export type FlameSize = 'sm' | 'md' | 'lg';

const SIZE_PX: Record<FlameSize, number> = { sm: 16, md: 22, lg: 32 };

const FIRE_PATH =
  'M9.5218 17.4576C12.7891 17.4576 15.4732 14.8684 15.4732 11.5451C15.4732 10.7292 15.4318 9.85459 14.9795 8.49531C14.5273 7.13607 14.4362 6.96062 13.958 6.12118C13.7537 7.83422 12.6606 8.54816 12.3829 8.76154C12.3829 8.53955 11.7217 6.08468 10.7191 4.61585C9.73487 3.17404 8.39634 2.22812 7.6115 1.58698C7.6115 2.80496 7.26893 4.61585 6.77833 5.53853C6.28772 6.46121 6.1956 6.49481 5.58279 7.18146C4.97002 7.8681 4.68876 8.08017 4.17633 8.9133C3.66393 9.74647 3.57031 10.8561 3.57031 11.672C3.57031 14.9954 6.25455 17.4576 9.5218 17.4576Z';
const STROKE_W = 1.587;
const LIT_FILL = '#EF4444';
const LIT_STROKE = '#FDD017';
const ZERO_FILL = '#94A3B8';
const ZERO_STROKE = '#61656F';

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
      <svg
        viewBox="0 0 20 20"
        style={{ width: px, height: px, overflow: 'visible' }}
        fill="none"
        aria-hidden="true"
      >
        <path
          d={FIRE_PATH}
          fill={ZERO_FILL}
          stroke={ZERO_STROKE}
          strokeWidth={STROKE_W}
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <span className="relative inline-block" style={{ width: px, height: px }}>
      {bursting && (
        <span
          className="pointer-events-none absolute animate-[streak-glow_0.9s_ease-in-out] motion-reduce:hidden"
          style={
            {
              left: '50%',
              top: '50%',
              width: px * 1.5,
              height: px * 1.5,
              marginLeft: -px * 0.75,
              marginTop: -px * 0.75,
              borderRadius: '50%',
              background: 'radial-gradient(circle, #FF8A1E 0%, rgba(255,138,30,0) 66%)',
            } as React.CSSProperties
          }
        />
      )}

      <svg
        viewBox="0 0 20 20"
        className={`absolute inset-0 h-full w-full ${
          bursting
            ? 'animate-[streak-burst_0.65s_ease-out]'
            : 'animate-[flame-flicker_1.4s_ease-in-out_infinite]'
        } motion-reduce:animate-none`}
        style={{ transformOrigin: '50% 80%', overflow: 'visible' }}
        fill="none"
        aria-hidden="true"
      >
        <path
          d={FIRE_PATH}
          fill={LIT_FILL}
          stroke={LIT_STROKE}
          strokeWidth={STROKE_W}
          strokeLinejoin="round"
        />
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
                  background: '#FFC04D',
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
                  background: '#FDD017',
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
