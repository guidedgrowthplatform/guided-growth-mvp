// Streak indicator. Zero reads as a quiet solid gray flame with a 0. An active
// streak is the layered flame from Yair's reference (streak-flame-animation.html):
// an orange outer flame with a gold core, flickering gently. The burst, glow, and
// embers from the reference are reserved for the live "just marked" moment, so the
// week grid stays calm with many flames on screen at once. API stays: streak only.
//
// Colors are the exact reference values on purpose, so the flame matches the HTML
// regardless of the --color-streak token:
//   outer orange #FF8A1E, gold core #FFC83D, zero gray flame #D1D5DB, zero count #6B7280.

const OUTER_PATH =
  'M12 12c2 -2.96 0 -7 -1 -8c0 3.038 -1.773 4.741 -3 6c-1.226 1.26 -2 3.24 -2 5a6 6 0 1 0 12 0c0 -1.532 -1.056 -3.94 -2 -5c-1.786 3 -2.791 3 -4 2z';
const CORE_PATH =
  'M12 15c1 -1.5 .5 -3.5 -.5 -4.5c-.3 1.4 -1.1 2.2 -1.8 2.9c-.6 .6 -1 1.5 -1 2.4a2.8 2.8 0 1 0 5.6 0c0 -.8 -.5 -1.9 -1 -2.4c-.7 1.3 -1.1 1.4 -1.3 1.6z';

export function StreakFlame({ streak }: { streak: number }) {
  if (streak <= 0) {
    return (
      <span
        className="flex items-center justify-end gap-[3px] text-xs font-bold"
        style={{ color: '#6B7280' }}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="#D1D5DB" aria-hidden="true">
          <path d={OUTER_PATH} />
        </svg>
        0
      </span>
    );
  }

  return (
    <span
      className="flex items-center justify-end gap-[3px] text-xs font-bold"
      style={{ color: '#FF8A1E' }}
    >
      <span className="relative inline-block h-4 w-4">
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
      {streak}
    </span>
  );
}
