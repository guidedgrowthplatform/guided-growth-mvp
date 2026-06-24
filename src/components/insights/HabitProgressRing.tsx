import { useEffect, useRef, useState } from 'react';

interface HabitProgressRingProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  animate?: boolean;
}

export function HabitProgressRing({
  percentage,
  size = 48,
  strokeWidth = 3.5,
  animate = true,
}: HabitProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const targetOffset = circumference * (1 - percentage / 100);
  const [mounted, setMounted] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    timerRef.current = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(timerRef.current);
  }, []);

  const currentOffset = !animate ? targetOffset : mounted ? targetOffset : circumference;

  return (
    <div
      className="relative"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${percentage}% complete`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgb(var(--color-border))"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgb(var(--color-primary))"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={currentOffset}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
          style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
        <span className="text-[10px] font-bold leading-[15px] text-content">{percentage}%</span>
      </div>
    </div>
  );
}
