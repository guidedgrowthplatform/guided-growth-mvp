import { Icon } from '@iconify/react';
import type { LevelConfig } from './calendarConfig';

interface CalendarDayCellProps {
  day: number | null;
  value: number | null;
  levelConfig: LevelConfig | null;
  isSelected: boolean;
  onClick: () => void;
}

export function CalendarDayCell({
  day,
  value,
  levelConfig,
  isSelected,
  onClick,
}: CalendarDayCellProps) {
  if (day === null) {
    return <div className="h-[56px]" />;
  }

  const ringClass = isSelected ? 'shadow-[0px_0px_0px_2px_white,0px_0px_0px_4px_#135bec]' : '';

  if (value !== null && levelConfig) {
    return (
      <button onClick={onClick} className="flex flex-col items-center gap-1">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-full ${ringClass}`}
          style={{ backgroundColor: levelConfig.color }}
        >
          <Icon icon={levelConfig.icon} width={20} height={20} className="text-white" />
        </div>
        <span className="text-[10px] text-[#64748b]">{day}</span>
      </button>
    );
  }

  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1">
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-full border border-[#e2e8f0] ${ringClass}`}
      >
        <span className="text-[14px] text-[#94a3b8]">{day}</span>
      </div>
      <span className="h-[10px]" />
    </button>
  );
}
