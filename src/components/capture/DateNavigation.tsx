import { useState, useRef, useEffect } from 'react';
import {
  format,
  addMonths,
  subMonths,
  addDays,
  subDays,
  parseISO,
  setMonth,
  setYear,
} from 'date-fns';
import type { ViewMode, SpreadsheetRange } from '@shared/types';
import { getWeekRange } from '@/utils/dates';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface DateNavigationProps {
  date: string;
  viewMode: ViewMode;
  spreadsheetRange: SpreadsheetRange;
  onChange: (date: string) => void;
}

export function DateNavigation({
  date,
  viewMode,
  spreadsheetRange,
  onChange,
}: DateNavigationProps) {
  const d = parseISO(date);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(d.getFullYear());
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close picker on outside click
  useEffect(() => {
    if (!showPicker) return;
    const handleClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showPicker]);

  const prev = () => {
    let newDate: Date;
    if (viewMode === 'form') {
      newDate = subDays(d, 1);
    } else if (spreadsheetRange === 'week') {
      newDate = subDays(d, 7);
    } else {
      newDate = subMonths(d, 1);
    }
    onChange(format(newDate, 'yyyy-MM-dd'));
  };

  const next = () => {
    let newDate: Date;
    if (viewMode === 'form') {
      newDate = addDays(d, 1);
    } else if (spreadsheetRange === 'week') {
      newDate = addDays(d, 7);
    } else {
      newDate = addMonths(d, 1);
    }
    onChange(format(newDate, 'yyyy-MM-dd'));
  };

  const today = () => onChange(format(new Date(), 'yyyy-MM-dd'));

  const handleMonthSelect = (monthIdx: number) => {
    const newDate = setYear(setMonth(d, monthIdx), pickerYear);
    onChange(format(newDate, 'yyyy-MM-dd'));
    setShowPicker(false);
  };

  const handleLabelClick = () => {
    setPickerYear(d.getFullYear());
    setShowPicker(!showPicker);
  };

  const getLabel = () => {
    if (viewMode === 'form') return format(d, 'MMM d, yyyy');
    if (spreadsheetRange === 'week') {
      const { start, end } = getWeekRange(d);
      const sameMonth = start.getMonth() === end.getMonth();
      if (sameMonth) {
        return `${format(start, 'MMM d')}-${format(end, 'd, yyyy')}`;
      }
      return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
    }
    return format(d, 'MMMM yyyy');
  };

  return (
    <div className="relative flex items-center gap-2">
      <button
        onClick={prev}
        className="rounded-lg px-2 py-1 text-content-secondary transition-all hover:bg-surface-secondary"
      >
        &larr;
      </button>
      <button
        onClick={handleLabelClick}
        className="min-w-[120px] cursor-pointer rounded-lg px-2 py-1 text-center text-sm font-medium text-content transition-all hover:bg-surface-secondary"
      >
        {getLabel()}
      </button>
      <button
        onClick={next}
        className="rounded-lg px-2 py-1 text-content-secondary transition-all hover:bg-surface-secondary"
      >
        &rarr;
      </button>
      <button
        onClick={today}
        className="rounded-lg border border-border px-3 py-1 text-xs text-primary transition-all hover:bg-surface-secondary"
      >
        Today
      </button>

      {showPicker && (
        <div
          ref={pickerRef}
          className="absolute left-0 top-full z-50 mt-1 w-[240px] rounded-xl border border-border bg-surface p-3 shadow-elevated"
        >
          {/* Year navigation */}
          <div className="mb-2 flex items-center justify-between">
            <button
              onClick={() => setPickerYear((y) => y - 1)}
              className="rounded px-2 py-1 text-sm text-content-secondary transition-all hover:bg-surface-secondary"
            >
              &larr;
            </button>
            <span className="text-sm font-semibold text-content">{pickerYear}</span>
            <button
              onClick={() => setPickerYear((y) => y + 1)}
              className="rounded px-2 py-1 text-sm text-content-secondary transition-all hover:bg-surface-secondary"
            >
              &rarr;
            </button>
          </div>
          {/* Month grid 3x4 */}
          <div className="grid grid-cols-3 gap-1">
            {MONTHS.map((month, idx) => {
              const isCurrentMonth = d.getMonth() === idx && d.getFullYear() === pickerYear;
              return (
                <button
                  key={month}
                  onClick={() => handleMonthSelect(idx)}
                  className={`rounded-lg px-2 py-1.5 text-xs transition-all ${
                    isCurrentMonth
                      ? 'bg-surface-secondary font-semibold text-primary'
                      : 'text-content-secondary hover:bg-surface-secondary'
                  }`}
                >
                  {month}
                </button>
              );
            })}
          </div>
          {/* Today button */}
          <button
            onClick={() => {
              today();
              setShowPicker(false);
            }}
            className="mt-2 w-full rounded-lg border border-border px-3 py-1.5 text-xs text-primary transition-all hover:bg-surface-secondary"
          >
            Today
          </button>
        </div>
      )}
    </div>
  );
}
