import { useState } from 'react';
import type { BarDataPoint } from './insightsMockData';

interface BarChartProps {
  data: BarDataPoint[];
}

export function BarChart({ data }: BarChartProps) {
  const maxValue = Math.max(...data.map((d) => d.value));
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  return (
    <div
      className="relative flex h-[192px] items-end justify-between px-1"
      role="img"
      aria-label="Habit completion bar chart"
    >
      {data.map((item, i) => {
        const barHeight = (item.value / maxValue) * 160;
        const isActive = activeIndex === i;
        const pct = Math.round((item.value / maxValue) * 100);

        return (
          <button
            key={item.label}
            aria-label={`${item.label}: ${pct}%`}
            className="relative flex flex-1 cursor-pointer flex-col items-center gap-1 border-none bg-transparent pt-2"
            onClick={() => setActiveIndex(isActive ? null : i)}
          >
            {isActive && (
              <div
                role="tooltip"
                className="absolute -top-1 z-10 animate-fade-in whitespace-nowrap rounded-md bg-content px-2 py-1 text-[10px] font-bold text-white"
              >
                {pct}%
                <div className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-l-4 border-r-4 border-t-4 border-transparent border-t-content" />
              </div>
            )}
            <div
              className={`w-[12px] rounded-t-[5px] transition-all duration-300 ${
                isActive
                  ? 'scale-x-150 bg-content'
                  : activeIndex !== null
                    ? 'bg-primary/40'
                    : 'bg-primary'
              }`}
              style={{ height: `${barHeight}px` }}
            />
            <span
              className={`text-[10px] font-bold uppercase leading-[15px] transition-colors duration-200 ${
                isActive ? 'text-content' : 'text-content-tertiary'
              }`}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
