import { useState, useEffect, useCallback, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, parseISO, subDays } from 'date-fns';
import { useMetrics } from '@/hooks/useMetrics';
import { useEntries } from '@/hooks/useEntries';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Button } from '@/components/ui/Button';
import { getCellColor, getCellDisplayValue } from '@/utils/cellColors';
import { DAYS_OF_WEEK } from '@/utils/dates';
import { computeStreak } from '@/utils/streaks';

export function ReportPage() {
  const { activeMetrics, loading: metricsLoading } = useMetrics();
  const { entries, loading: entriesLoading, load: loadEntries } = useEntries();
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    // Load entries for the month display + 365 days back for streak computation
    const start = format(subDays(new Date(), 365), 'yyyy-MM-dd');
    const end = format(endOfMonth(selectedDate), 'yyyy-MM-dd');
    loadEntries(start, end);
  }, [selectedDate, loadEntries]);

  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const firstDayOfWeek = getDay(monthStart);
  const emptyCells = Array(firstDayOfWeek).fill(null);
  const allDays = [...emptyCells, ...daysInMonth];

  const handleExportCSV = useCallback(() => {
    const start = format(startOfMonth(selectedDate), 'yyyy-MM-dd');
    const end = format(endOfMonth(selectedDate), 'yyyy-MM-dd');
    window.open(`/api/entries/export?start=${start}&end=${end}`, '_blank');
  }, [selectedDate]);

  const streaks = useMemo(() => {
    return activeMetrics.map((metric) => ({
      metric,
      ...computeStreak(entries, metric.id, metric),
    }));
  }, [activeMetrics, entries]);

  if (metricsLoading || entriesLoading) return <LoadingSpinner className="h-64" />;

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-primary">
          Habit Tracker
        </h1>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={format(selectedDate, 'yyyy-MM')}
            onChange={(e) => setSelectedDate(parseISO(e.target.value + '-01'))}
            className="px-4 py-2 border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-primary bg-surface transition-all"
          />
          <Button size="sm" variant="secondary" onClick={handleExportCSV}>
            Download CSV
          </Button>
        </div>
      </div>

      {activeMetrics.length === 0 ? (
        <div className="bg-surface shadow-elevated border border-border rounded-2xl p-8 text-center text-content-secondary">
          No metrics configured. Configure metrics first to view reports.
        </div>
      ) : (
        <div className="bg-surface shadow-elevated border border-border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[800px] lg:min-w-0">
              <thead>
                <tr className="bg-surface-secondary border-b-2 border-border">
                  <th className="sticky left-0 z-10 bg-surface-secondary px-4 py-3 text-left font-semibold text-content border-r-2 border-border min-w-[200px]">
                    HABITS
                  </th>
                  {allDays.map((day, idx) => {
                    if (!day) return <th key={`empty-${idx}`} className="px-2 py-2 text-xs bg-surface-secondary" />;
                    return (
                      <th key={day.toString()} className="px-2 py-2 text-center border-l border-border">
                        <div className="text-xs font-medium text-content-secondary">{DAYS_OF_WEEK[getDay(day)]}</div>
                        <div className="text-sm font-semibold text-content">{format(day, 'd')}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {activeMetrics.map((metric, metricIdx) => (
                  <tr
                    key={metric.id}
                    className={`border-b border-border ${metricIdx % 2 === 0 ? 'bg-surface' : 'bg-surface-secondary'}`}
                  >
                    <td className="sticky left-0 z-10 px-4 py-3 text-sm font-medium text-content border-r-2 border-border bg-inherit">
                      <div className="font-semibold">{metric.name}</div>
                      {metric.question && <div className="text-xs text-content-secondary mt-1">{metric.question}</div>}
                    </td>
                    {allDays.map((day, dayIdx) => {
                      if (!day) return <td key={`empty-${dayIdx}`} className="px-2 py-2 bg-surface-secondary" />;
                      const dateStr = format(day, 'yyyy-MM-dd');
                      const value = entries[dateStr]?.[metric.id];
                      const display = getCellDisplayValue(value, metric);
                      const color = getCellColor(value, metric);
                      return (
                        <td
                          key={dateStr}
                          className={`px-2 py-2 text-center text-xs border-l border-border ${color} min-w-[40px]`}
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
          <div className="p-4 bg-surface-secondary border-t border-border flex flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-emerald-400/80" />
              <span className="text-content">Completed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-red-400/80" />
              <span className="text-content">Not Completed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-emerald-200/60" />
              <span className="text-content">Has Value</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-surface-secondary" />
              <span className="text-content">No Entry</span>
            </div>
          </div>
        </div>
      )}

      {/* Streaks */}
      {activeMetrics.length > 0 && streaks.some((s) => s.current > 0 || s.longest > 0) && (
        <div className="bg-surface shadow-elevated border border-border rounded-2xl mt-6 p-6">
          <h2 className="text-xl font-semibold text-content mb-4">Streaks</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {streaks.filter((s) => s.current > 0 || s.longest > 0).map(({ metric, current, longest }) => (
              <div key={metric.id} className="flex items-center gap-3 p-3 rounded-xl bg-surface">
                <div className="text-2xl">{current > 0 ? '\uD83D\uDD25' : '\u2B50'}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-content truncate">{metric.name}</div>
                  <div className="text-xs text-content-secondary">
                    Current: <span className="font-semibold text-primary">{current} day{current !== 1 ? 's' : ''}</span>
                    {longest > current && (
                      <span className="ml-2">Best: <span className="font-semibold text-warning">{longest}</span></span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
