import { format, parseISO, isToday as isTodayFn, startOfWeek, addDays } from 'date-fns';

interface WeeklyStripProps {
  selectedDate: string;
  onDateSelect: (date: string) => void;
  markedDates?: Record<string, 'complete' | 'partial' | 'none'>;
}

export function WeeklyStrip({ selectedDate, onDateSelect, markedDates = {} }: WeeklyStripProps) {
  const selected = parseISO(selectedDate);
  const weekStart = startOfWeek(selected, { weekStartsOn: 0 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="flex items-center justify-between gap-1 py-2">
      {days.map((day) => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const isToday = isTodayFn(day);
        const isSelected = dateStr === selectedDate;
        const mark = markedDates[dateStr];

        return (
          <button
            key={dateStr}
            onClick={() => onDateSelect(dateStr)}
            className={`flex flex-col items-center gap-0.5 p-1.5 rounded-lg transition-colors min-w-[40px] ${
              isToday && isSelected ? 'bg-primary text-white' :
              isToday ? 'bg-primary/10 text-primary' :
              isSelected ? 'ring-2 ring-primary bg-surface' :
              'text-content-secondary hover:bg-surface-secondary'
            }`}
          >
            <span className="text-[10px] font-medium uppercase">
              {format(day, 'EEE')}
            </span>
            <span className={`text-sm font-semibold ${isToday && isSelected ? 'text-white' : ''}`}>
              {format(day, 'd')}
            </span>
            {mark === 'complete' && (
              <span className="w-1.5 h-1.5 rounded-full bg-success" />
            )}
            {mark === 'partial' && (
              <span className="w-1.5 h-1.5 rounded-full bg-warning" />
            )}
          </button>
        );
      })}
    </div>
  );
}
