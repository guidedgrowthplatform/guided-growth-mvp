import { Icon } from '@iconify/react';
import { useState } from 'react';
import type { HabitPerformance } from '@/hooks/useHabitAnalytics.types';
import { HabitProgressRing } from './HabitProgressRing';

function MiniSparkline({ data }: { data: number[] }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 120;
  const h = 32;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  });

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="overflow-visible"
      aria-hidden="true"
    >
      <path
        d={`M${points.join(' L')}`}
        fill="none"
        stroke="rgb(var(--color-primary))"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {data.map((v, i) => {
        const x = (i / (data.length - 1)) * w;
        const y = h - ((v - min) / range) * (h - 4) - 2;
        return <circle key={i} cx={x} cy={y} r="2" fill="rgb(var(--color-primary))" />;
      })}
    </svg>
  );
}

function HabitDetailPanel({ habit }: { habit: HabitPerformance }) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="mt-3 flex animate-slide-down flex-col gap-3 border-t border-border-light pt-3">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-[10px] font-medium uppercase tracking-wider text-content-tertiary">
            Best Day
          </span>
          <span className="text-[13px] font-bold text-content">{habit.bestDay}</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] font-medium uppercase tracking-wider text-content-tertiary">
            Total
          </span>
          <span className="text-[13px] font-bold text-content">
            {habit.totalCompletions} check-ins
          </span>
        </div>
      </div>
      <div>
        <span className="text-[10px] font-medium uppercase tracking-wider text-content-tertiary">
          Weekly Trend
        </span>
        <div className="mt-1">
          <MiniSparkline data={habit.weeklyData} />
        </div>
        <div className="mt-1 flex justify-between">
          {days.map((d) => (
            <span
              key={d}
              className="w-[17px] text-center text-[8px] font-medium text-content-tertiary"
            >
              {d}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

interface HabitPerformanceListProps {
  habits: HabitPerformance[];
}

export function HabitPerformanceList({ habits }: HabitPerformanceListProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  if (habits.length === 0) {
    return (
      <div>
        <h2 className="text-[18px] font-bold leading-7 text-content">Habit Performance</h2>
        <p className="mt-4 text-[14px] text-content-tertiary">
          No habit data yet. Start tracking habits to see performance insights.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-[18px] font-bold leading-7 text-content">Habit Performance</h2>
      <div className="mt-4 flex flex-col gap-3">
        {habits.map((habit, i) => {
          const expanded = expandedIndex === i;
          return (
            <button
              key={habit.name}
              aria-expanded={expanded}
              onClick={() => setExpandedIndex(expanded ? null : i)}
              className="w-full rounded-lg bg-surface p-4 text-left shadow-[0px_4px_20px_rgba(0,0,0,0.04)] transition-transform duration-150 active:scale-[0.98]"
            >
              <div className="flex items-center gap-4">
                <HabitProgressRing percentage={habit.percentage} />
                <div className="flex flex-1 flex-col">
                  <span className="text-[14px] font-bold leading-5 text-content">{habit.name}</span>
                  <span className="text-[12px] leading-4 text-content-muted">{habit.streak}</span>
                </div>
                <Icon
                  icon="mdi:chevron-right"
                  width={20}
                  height={20}
                  className={`text-content-tertiary transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
                />
              </div>
              {expanded && <HabitDetailPanel habit={habit} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
