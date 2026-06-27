import { Flame } from 'lucide-react';

// Streak indicator. Zero reads as a quiet gray outline flame. An active streak
// is a solid orange (--color-streak) flame that flickers, with the count.
export function StreakFlame({ streak }: { streak: number }) {
  if (streak <= 0) {
    return (
      <span className="flex items-center justify-end gap-[2px] text-xs font-bold text-content-tertiary">
        <Flame size={13} className="text-content-tertiary" />0
      </span>
    );
  }

  return (
    <span className="flex items-center justify-end gap-[2px] text-xs font-bold text-streak">
      <Flame
        size={13}
        fill="currentColor"
        className="animate-[flame-flicker_1.4s_ease-in-out_infinite] text-streak"
      />
      {streak}
    </span>
  );
}
