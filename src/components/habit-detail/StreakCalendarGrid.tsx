import { Check, X } from 'lucide-react';
import { Fragment } from 'react';

interface StreakCalendarGridProps {
  data: ('done' | 'missed' | 'empty')[][];
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
                cell === 'done'
                  ? 'bg-primary'
                  : cell === 'missed'
                    ? 'border-2 border-[#e5484d] bg-white'
                    : 'bg-border-light'
              }`}
            >
              {cell === 'done' && <Check size={14} className="text-white" />}
              {cell === 'missed' && <X size={14} className="text-[#e5484d]" />}
            </div>
          ))}
        </Fragment>
      ))}
    </div>
  );
}
