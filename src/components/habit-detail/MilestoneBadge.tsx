import { Flame } from 'lucide-react';

interface MilestoneBadgeProps {
  target: number;
  earned: boolean;
}

export function MilestoneBadge({ target, earned }: MilestoneBadgeProps) {
  return (
    <div className="flex shrink-0 flex-col items-center">
      <div
        className={`flex h-16 w-16 flex-col items-center justify-center rounded-full border-2 ${
          earned ? 'border-[#f38601] bg-[#fffbeb]' : 'border-border bg-border-light opacity-40'
        }`}
      >
        {earned && <Flame size={12} className="text-[#f38601]" />}
        <span
          className={`text-2xl font-bold ${earned ? 'text-[#f38601]' : 'text-content-tertiary'}`}
        >
          {target}
        </span>
      </div>
      <span
        className={`mt-[7px] text-[10px] ${earned ? 'text-content-subtle' : 'text-content-tertiary'}`}
      >
        {target} days streak
      </span>
    </div>
  );
}
