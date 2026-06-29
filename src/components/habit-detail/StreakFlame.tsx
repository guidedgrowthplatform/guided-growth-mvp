import { FlameMark, type FlameSize } from './FlameMark';

// Flame graphic plus the streak count. A thin wrapper over FlameMark: it decides
// lit vs zero from the streak, colors the count to match (orange when active,
// gray at zero), and lets callers drop the flame in at any size, with or without
// the number. The flame graphic itself lives in FlameMark so it can be reused
// without a count.
//   streak    the count; 0 renders the gray zero-state.
//   size      sm (grid), md, lg (detail). Default sm.
//   showCount false renders just the flame graphic. Default true.

const COUNT_CLASS: Record<FlameSize, string> = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
};

export function StreakFlame({
  streak,
  size = 'sm',
  showCount = true,
}: {
  streak: number;
  size?: FlameSize;
  showCount?: boolean;
}) {
  const lit = streak > 0;
  return (
    <span
      className={`flex items-center justify-end gap-[3px] font-bold ${COUNT_CLASS[size]}`}
      style={{ color: lit ? '#FF8A1E' : '#6B7280' }}
    >
      <FlameMark lit={lit} size={size} />
      {showCount && (lit ? streak : 0)}
    </span>
  );
}
