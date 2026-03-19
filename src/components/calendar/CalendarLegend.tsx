import { Icon } from '@iconify/react';
import { type MetricType, metricConfigs } from './calendarConfig';

interface CalendarLegendProps {
  metricType: MetricType;
}

export function CalendarLegend({ metricType }: CalendarLegendProps) {
  const config = metricConfigs[metricType];
  const levels = [5, 4, 3, 2, 1] as const;

  return (
    <div className="flex flex-col items-center gap-3">
      <span className="text-[10px] font-bold uppercase tracking-wider text-[#94a3b8]">
        {config.legendTitle}
      </span>
      <div className="flex justify-center gap-4">
        {levels.map((level) => {
          const lc = config.levels[level];
          return (
            <div key={level} className="flex flex-col items-center gap-1">
              <div
                className="flex h-6 w-6 items-center justify-center rounded-full"
                style={{ backgroundColor: lc.color }}
              >
                <Icon icon={lc.icon} width={14} height={14} className="text-white" />
              </div>
              <span className="text-[10px] text-[#64748b]">{lc.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
