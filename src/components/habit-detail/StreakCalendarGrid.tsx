import { Check, Minus, X } from 'lucide-react';
import { Fragment } from 'react';
import type { CalendarCell } from '@/hooks/useHabitDetail';

interface StreakCalendarGridProps {
  data: CalendarCell[][];
}

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function cellClass(status: CalendarCell['status']): string {
  switch (status) {
    case 'done':
      return 'bg-primary';
    case 'missed':
      return 'border-2 border-danger bg-surface';
    case 'today':
    case 'today-done':
      return 'bg-[#fdd017]';
    case 'scheduled-future':
      return 'bg-surface';
    case 'unscheduled-past':
    case 'unscheduled-future':
      return 'bg-border-light';
    default:
      return '';
  }
}

export function StreakCalendarGrid({ data }: StreakCalendarGridProps) {
  return (
    <div className="grid grid-cols-[auto_repeat(7,1fr)] gap-x-[6px]">
      <div className="h-[15px]" />
      {DAY_LABELS.map((dayLabel, i) => (
        <div
          key={i}
          className="flex h-[15px] items-center justify-center text-[10px] font-bold text-content-tertiary"
        >
          {dayLabel}
        </div>
      ))}

      {data.map((row, wi) => (
        <Fragment key={wi}>
          <div className="h-[20px]" />
          {row.map((cell, ci) => (
            <div
              key={`d-${wi}-${ci}`}
              className="flex h-[20px] items-end justify-center pb-[2px] text-[13px] font-semibold text-content-tertiary"
            >
              {cell.day ?? ''}
            </div>
          ))}

          <div className="flex items-center justify-center pr-1 text-[10px] font-bold text-content-tertiary">
            W{wi + 1}
          </div>
          {row.map((cell, ci) => (
            <div
              key={`c-${wi}-${ci}`}
              className={`flex aspect-square items-center justify-center rounded-md ${cellClass(cell.status)}`}
            >
              {(cell.status === 'done' || cell.status === 'today-done') && (
                <Check
                  size={14}
                  className={cell.status === 'today-done' ? 'text-white/80' : 'text-white'}
                />
              )}
              {cell.status === 'missed' && <X size={14} className="text-danger" />}
              {cell.status === 'unscheduled-past' && (
                <Minus size={14} className="text-content-tertiary" />
              )}
            </div>
          ))}
        </Fragment>
      ))}
    </div>
  );
}
