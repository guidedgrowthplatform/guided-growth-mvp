import { Check, X } from 'lucide-react';
import { Fragment } from 'react';
import type { CalendarCell } from '@/hooks/useHabitDetail';

interface StreakCalendarGridProps {
  data: CalendarCell[][];
}

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function StreakCalendarGrid({ data }: StreakCalendarGridProps) {
  return (
    <div className="grid grid-cols-[auto_repeat(7,1fr)] gap-[6px]">
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
          <div className="flex items-center justify-center pr-1 text-[10px] font-bold text-content-tertiary">
            W{wi + 1}
          </div>
          {row.map((cell, ci) => (
            <div
              key={`${wi}-${ci}`}
              className={`flex aspect-square items-center justify-center rounded-md ${
                cell.status === 'done'
                  ? 'bg-primary'
                  : cell.status === 'missed'
                    ? 'border-2 border-danger bg-surface'
                    : cell.status === 'today' || cell.status === 'today-done'
                      ? 'bg-[#fdd017]'
                      : 'bg-border-light'
              }`}
            >
              {(cell.status === 'done' || cell.status === 'today-done') && (
                <Check size={14} className={cell.status === 'today-done' ? 'text-white/80' : 'text-white'} />
              )}
              {cell.status === 'missed' && <X size={14} className="text-danger" />}
              {(cell.status === 'empty' || cell.status === 'today') && cell.day !== null && (
                <span className={`text-xs font-semibold ${cell.status === 'today' ? 'text-gray-800' : 'text-content-secondary'}`}>
                  {cell.day}
                </span>
              )}
            </div>
          ))}
        </Fragment>
      ))}
    </div>
  );
}
