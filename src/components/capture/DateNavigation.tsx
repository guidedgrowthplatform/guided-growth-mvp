import { useState, useRef, useEffect } from 'react';
import { format, addMonths, subMonths, addDays, subDays, parseISO, setMonth, setYear } from 'date-fns';
import type { ViewMode, SpreadsheetRange } from '@shared/types';
import { getWeekRange } from '@/utils/dates';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface DateNavigationProps {
  date: string;
  viewMode: ViewMode;
  spreadsheetRange: SpreadsheetRange;
  onChange: (date: string) => void;
}

export function DateNavigation({ date, viewMode, spreadsheetRange, onChange }: DateNavigationProps) {
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
    <div className="flex items-center gap-2 relative">
      <button onClick={prev} className="px-2 py-1 text-content-secondary hover:bg-surface-secondary rounded-lg transition-all">
        &larr;
      </button>
      <button
        onClick={handleLabelClick}
        className="text-sm font-medium text-content min-w-[120px] text-center hover:bg-surface-secondary rounded-lg px-2 py-1 transition-all cursor-pointer"
      >
        {getLabel()}
      </button>
      <button onClick={next} className="px-2 py-1 text-content-secondary hover:bg-surface-secondary rounded-lg transition-all">
        &rarr;
      </button>
      <button onClick={today} className="px-3 py-1 text-xs text-primary hover:bg-surface-secondary rounded-lg transition-all border border-border">
        Today
      </button>

      {showPicker && (
        <div
          ref={pickerRef}
          className="absolute top-full left-0 mt-1 z-50 bg-surface shadow-elevated border border-border rounded-xl p-3 w-[240px]"
        >
          {/* Year navigation */}
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => setPickerYear((y) => y - 1)}
              className="px-2 py-1 text-content-secondary hover:bg-surface-secondary rounded transition-all text-sm"
            >
              &larr;
            </button>
            <span className="text-sm font-semibold text-content">{pickerYear}</span>
            <button
              onClick={() => setPickerYear((y) => y + 1)}
              className="px-2 py-1 text-content-secondary hover:bg-surface-secondary rounded transition-all text-sm"
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
                  className={`px-2 py-1.5 text-xs rounded-lg transition-all ${
                    isCurrentMonth
                      ? 'bg-surface-secondary text-primary font-semibold'
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
            onClick={() => { today(); setShowPicker(false); }}
            className="w-full mt-2 px-3 py-1.5 text-xs text-primary hover:bg-surface-secondary rounded-lg transition-all border border-border"
          >
            Today
          </button>
        </div>
      )}
    </div>
  );
}
