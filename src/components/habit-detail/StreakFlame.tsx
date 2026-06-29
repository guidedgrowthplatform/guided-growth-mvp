import { useEffect, useRef, useState } from 'react';
import { FlameMark, type FlameSize } from './FlameMark';

// Flame graphic plus the streak count. A thin wrapper over FlameMark: it decides
// lit vs zero from the streak, colors the count to match (orange when active,
// gray at zero), and lets callers drop the flame in at any size, with or without
// the number.
//
//   streak               the count; 0 renders the gray zero-state.
//   size                 sm (grid), md, lg (detail). Default sm.
//   showCount            false renders just the flame graphic. Default true.
//   celebrateOnIncrement when true, a rising streak fires the celebration: the
//                        flame bursts, a +1 floats up, the count bumps. Default
//                        false, so a grid of static flames never animates.

const COUNT_CLASS: Record<FlameSize, string> = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
};

export function StreakFlame({
  streak,
  size = 'sm',
  showCount = true,
  celebrateOnIncrement = false,
}: {
  streak: number;
  size?: FlameSize;
  showCount?: boolean;
  celebrateOnIncrement?: boolean;
}) {
  const lit = streak > 0;
  const [burstNonce, setBurstNonce] = useState(0);
  const [bumping, setBumping] = useState(false);
  const prevStreak = useRef(streak);

  useEffect(() => {
    if (celebrateOnIncrement && streak > prevStreak.current) {
      setBurstNonce((n) => n + 1);
      setBumping(true);
      const t = window.setTimeout(() => setBumping(false), 600);
      prevStreak.current = streak;
      return () => window.clearTimeout(t);
    }
    prevStreak.current = streak;
  }, [streak, celebrateOnIncrement]);

  return (
    <span
      className={`flex items-center justify-end gap-[3px] font-bold ${COUNT_CLASS[size]}`}
      style={{ color: lit ? '#EF4444' : '#94A3B8' }}
    >
      <FlameMark lit={lit} size={size} burstNonce={celebrateOnIncrement ? burstNonce : undefined} />
      {showCount && (
        <span className="relative inline-flex justify-center">
          {bumping && (
            <span
              className="pointer-events-none absolute bottom-full left-1/2 animate-[streak-plus-float_0.9s_ease-out] motion-reduce:hidden"
              style={{ color: '#FF8A1E' }}
            >
              +1
            </span>
          )}
          <span className={bumping ? 'animate-[streak-count-bump_0.5s_ease-out]' : undefined}>
            {lit ? streak : 0}
          </span>
        </span>
      )}
    </span>
  );
}
