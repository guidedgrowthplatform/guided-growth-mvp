import { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, parseISO } from 'date-fns';
import { useMetrics } from '@/hooks/useMetrics';
import { useEntries } from '@/hooks/useEntries';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { getCellColor, getCellDisplayValue } from '@/utils/cellColors';
import { DAYS_OF_WEEK } from '@/utils/dates';

export function ReportPage() {
  const { activeMetrics, loading: metricsLoading } = useMetrics();
  const { entries, loading: entriesLoading, load: loadEntries } = useEntries();
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    const start = format(startOfMonth(selectedDate), 'yyyy-MM-dd');
    const end = format(endOfMonth(selectedDate), 'yyyy-MM-dd');
    loadEntries(start, end);
  }, [selectedDate, loadEntries]);

  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const firstDayOfWeek = getDay(monthStart);
  const emptyCells = Array(firstDayOfWeek).fill(null);
  const allDays = [...emptyCells, ...daysInMonth];

  if (metricsLoading || entriesLoading) return <LoadingSpinner className="h-64" />;

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
          Habit Tracker
        </h1>
        <input
          type="month"
          value={format(selectedDate, 'yyyy-MM')}
          onChange={(e) => setSelectedDate(parseISO(e.target.value + '-01'))}
          className="px-4 py-2 border border-cyan-300/50 rounded-xl focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 bg-white/80 backdrop-blur-sm transition-all glass"
        />
      </div>

      {activeMetrics.length === 0 ? (
        <div className="glass rounded-2xl shadow-xl border border-cyan-200/50 p-8 text-center text-slate-500">
          No metrics configured. Configure metrics first to view reports.
        </div>
      ) : (
        <div className="glass rounded-2xl shadow-xl border border-cyan-200/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[800px] lg:min-w-0">
              <thead>
                <tr className="bg-cyan-100/50 border-b-2 border-cyan-300/50">
                  <th className="sticky left-0 z-10 bg-cyan-100/50 px-4 py-3 text-left font-semibold text-slate-800 border-r-2 border-cyan-300/50 min-w-[200px]">
                    HABITS
                  </th>
                  {allDays.map((day, idx) => {
                    if (!day) return <th key={`empty-${idx}`} className="px-2 py-2 text-xs bg-slate-100/30" />;
                    return (
                      <th key={day.toString()} className="px-2 py-2 text-center border-l border-cyan-200/30">
                        <div className="text-xs font-medium text-slate-600">{DAYS_OF_WEEK[getDay(day)]}</div>
                        <div className="text-sm font-semibold text-slate-800">{format(day, 'd')}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {activeMetrics.map((metric, metricIdx) => (
                  <tr
                    key={metric.id}
                    className={`border-b border-cyan-200/30 ${metricIdx % 2 === 0 ? 'bg-white/30' : 'bg-cyan-50/20'}`}
                  >
                    <td className="sticky left-0 z-10 px-4 py-3 text-sm font-medium text-slate-800 border-r-2 border-cyan-300/50 bg-inherit">
                      <div className="font-semibold">{metric.name}</div>
                      {metric.question && <div className="text-xs text-slate-600 mt-1">{metric.question}</div>}
                    </td>
                    {allDays.map((day, dayIdx) => {
                      if (!day) return <td key={`empty-${dayIdx}`} className="px-2 py-2 bg-slate-100/30" />;
                      const dateStr = format(day, 'yyyy-MM-dd');
                      const value = entries[dateStr]?.[metric.id];
                      const display = getCellDisplayValue(value, metric);
                      const color = getCellColor(value, metric);
                      return (
                        <td
                          key={dateStr}
                          className={`px-2 py-2 text-center text-xs border-l border-cyan-200/30 ${color} min-w-[40px]`}
                        >
                          {display || '-'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="p-4 bg-cyan-50/30 border-t border-cyan-200/30 flex flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-emerald-400/80" />
              <span className="text-slate-700">Completed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-red-400/80" />
              <span className="text-slate-700">Not Completed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-emerald-200/60" />
              <span className="text-slate-700">Has Value</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-slate-100/30" />
              <span className="text-slate-700">No Entry</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
