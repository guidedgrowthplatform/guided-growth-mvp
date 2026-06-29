// The reusable flame graphic, no count. Drop it into any component that needs a
// streak flame (the week grid, StreakCard, MilestoneBadge, a home habit row).
//
// Two resting looks, from Yair's reference (streak-flame-animation.html):
//   lit   = orange outer (#FF8A1E) + gold core (#FFC83D), flickering gently.
//   unlit = a quiet solid gray (#D1D5DB) flame.
// Colors are the exact reference values on purpose so it matches the HTML
// regardless of the --color-streak token.
//
// Stage 2 will add the "just marked" celebration here (the +1, the burst, the
// ember rise, the glow), triggered on increment and opt-in, so the grid stays
// calm with many flames while a single home-row flame can celebrate on tap.

export type FlameSize = 'sm' | 'md' | 'lg';

const SIZE_PX: Record<FlameSize, number> = { sm: 16, md: 22, lg: 32 };

const OUTER_PATH =
  'M12 12c2 -2.96 0 -7 -1 -8c0 3.038 -1.773 4.741 -3 6c-1.226 1.26 -2 3.24 -2 5a6 6 0 1 0 12 0c0 -1.532 -1.056 -3.94 -2 -5c-1.786 3 -2.791 3 -4 2z';
const CORE_PATH =
  'M12 15c1 -1.5 .5 -3.5 -.5 -4.5c-.3 1.4 -1.1 2.2 -1.8 2.9c-.6 .6 -1 1.5 -1 2.4a2.8 2.8 0 1 0 5.6 0c0 -.8 -.5 -1.9 -1 -2.4c-.7 1.3 -1.1 1.4 -1.3 1.6z';

export function FlameMark({ lit, size = 'sm' }: { lit: boolean; size?: FlameSize }) {
  const px = SIZE_PX[size];

  if (!lit) {
    return (
      <svg
        viewBox="0 0 24 24"
        style={{ width: px, height: px }}
        fill="#D1D5DB"
        aria-hidden="true"
      >
        <path d={OUTER_PATH} />
      </svg>
    );
  }

  return (
    <span className="relative inline-block" style={{ width: px, height: px }}>
      <svg
        viewBox="0 0 24 24"
        className="absolute inset-0 h-full w-full animate-[flame-flicker_1.4s_ease-in-out_infinite] motion-reduce:animate-none"
        style={{ transformOrigin: '50% 80%' }}
        fill="#FF8A1E"
        aria-hidden="true"
      >
        <path d={OUTER_PATH} />
      </svg>
      <svg
        viewBox="0 0 24 24"
        className="absolute inset-0 h-full w-full animate-[flame-flicker_1.1s_ease-in-out_infinite] motion-reduce:animate-none"
        style={{ transformOrigin: '50% 80%' }}
        fill="#FFC83D"
        aria-hidden="true"
      >
        <path d={CORE_PATH} />
      </svg>
    </span>
  );
}
