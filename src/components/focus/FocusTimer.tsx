import { Icon } from '@iconify/react';
import type { TimerStatus } from '@/hooks/useFocusTimer';

interface FocusTimerProps {
  remainingSeconds: number;
  progress: number;
  status: TimerStatus;
  onEditPress: () => void;
}

const RADIUS = 140;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function FocusTimer({ remainingSeconds, progress, status, onEditPress }: FocusTimerProps) {
  const offset = CIRCUMFERENCE * (1 - progress);
  const isCompleted = status === 'completed';

  return (
    <div className="relative w-full max-w-[320px]">
      <svg viewBox="0 0 320 320" className="w-full">
        {/* Track */}
        <circle
          cx={160}
          cy={160}
          r={RADIUS}
          fill="none"
          stroke="rgb(var(--color-border))"
          strokeWidth={12}
        />
        {/* Progress */}
        <circle
          cx={160}
          cy={160}
          r={RADIUS}
          fill="none"
          stroke="rgb(var(--color-primary))"
          strokeWidth={12}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          transform="rotate(-90 160 160)"
          className="transition-[stroke-dashoffset] duration-1000 ease-linear"
        />
      </svg>
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="text-[72px] font-bold leading-none text-content"
          style={{ letterSpacing: '-3.6px' }}
        >
          {isCompleted ? 'Done!' : formatTime(remainingSeconds)}
        </span>
        {!isCompleted && (
          <button
            onClick={onEditPress}
            className="mt-3 flex items-center gap-1 text-content-secondary"
          >
            <Icon icon="lets-icons:edit" width={22} />
          </button>
        )}
      </div>
    </div>
  );
}
