import { format, subDays, addDays, eachDayOfInterval, isSameDay } from 'date-fns';
import { useRef, useEffect, useMemo } from 'react';
import type { EntriesMap } from '@shared/types';

interface DateStripProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  entries?: EntriesMap;
}

const CELL_WIDTH = 64;
const CELL_GAP = 8; // gap-2
const CELL_STEP = CELL_WIDTH + CELL_GAP;

export function DateStrip({ selectedDate, onSelectDate, entries }: DateStripProps) {
  const selectedRef = useRef<HTMLButtonElement>(null);

  const dates = useMemo(() => {
    const today = new Date();
    return eachDayOfInterval({
      start: subDays(today, 3),
      end: addDays(today, 5),
    });
  }, []);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ inline: 'center', behavior: 'smooth' });
  }, [selectedDate]);

  const selectedDateObj = new Date(selectedDate + 'T00:00:00');
  const selectedIndex = dates.findIndex((d) => isSameDay(d, selectedDateObj));

  return (
    <div className="scrollbar-hidden -mx-4 overflow-x-auto px-4">
      <div className="flex gap-2">
        {dates.map((date) => {
          const dateStr = format(date, 'yyyy-MM-dd');
          const isSelected = isSameDay(date, selectedDateObj);
          const hasEntries = entries?.[dateStr] && Object.keys(entries[dateStr]).length > 0;

          return (
            <button
              key={dateStr}
              ref={isSelected ? selectedRef : undefined}
              onClick={() => onSelectDate(dateStr)}
              className={`flex h-[68px] w-[64px] flex-shrink-0 flex-col items-center justify-center gap-1 rounded-xl transition-colors ${
                isSelected ? 'bg-primary text-white' : 'text-content'
              }`}
            >
              <span className="text-[10px] font-normal">{format(date, 'EEE')}</span>
              <span className="text-base font-semibold">{format(date, 'd')}</span>
              <span
                className={`h-1 w-1 rounded-full ${
                  isSelected
                    ? hasEntries
                      ? 'bg-white'
                      : 'bg-transparent'
                    : hasEntries
                      ? 'bg-primary'
                      : 'bg-transparent'
                }`}
              />
            </button>
          );
        })}
      </div>
      <div className="relative mt-2 h-[3px] rounded-full bg-surface-secondary">
        {selectedIndex >= 0 && (
          <div
            className="absolute h-[3px] w-[35px] rounded-full bg-streak transition-all"
            style={{ left: `${selectedIndex * CELL_STEP}px` }}
          />
        )}
      </div>
    </div>
  );
}
