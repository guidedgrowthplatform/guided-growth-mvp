import { format, addMonths, subMonths, addDays, subDays, parseISO } from 'date-fns';
import type { ViewMode } from '@shared/types';

interface DateNavigationProps {
  date: string;
  viewMode: ViewMode;
  onChange: (date: string) => void;
}

export function DateNavigation({ date, viewMode, onChange }: DateNavigationProps) {
  const d = parseISO(date);

  const prev = () => {
    const newDate = viewMode === 'form' ? subDays(d, 1) : subMonths(d, 1);
    onChange(format(newDate, 'yyyy-MM-dd'));
  };

  const next = () => {
    const newDate = viewMode === 'form' ? addDays(d, 1) : addMonths(d, 1);
    onChange(format(newDate, 'yyyy-MM-dd'));
  };

  const today = () => onChange(format(new Date(), 'yyyy-MM-dd'));

  return (
    <div className="flex items-center gap-2">
      <button onClick={prev} className="px-2 py-1 text-slate-600 hover:bg-slate-100/50 rounded-lg transition-all">
        &larr;
      </button>
      <span className="text-sm font-medium text-slate-700 min-w-[120px] text-center">
        {viewMode === 'form' ? format(d, 'MMM d, yyyy') : format(d, 'MMMM yyyy')}
      </span>
      <button onClick={next} className="px-2 py-1 text-slate-600 hover:bg-slate-100/50 rounded-lg transition-all">
        &rarr;
      </button>
      <button onClick={today} className="px-3 py-1 text-xs text-cyan-600 hover:bg-cyan-50/50 rounded-lg transition-all border border-cyan-200/50">
        Today
      </button>
    </div>
  );
}
