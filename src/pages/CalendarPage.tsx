import { useEffect, useRef, useState } from 'react';
import { track } from '@/analytics';
import {
  CalendarHeader,
  CalendarGrid,
  CalendarLegend,
  MetricSegmentedControl,
  metricConfigs,
} from '@/components/calendar';
import type { MetricType } from '@/components/calendar';
import { useToast } from '@/contexts/ToastContext';
import { useCalendarData } from '@/hooks/useCalendarData';

export function CalendarPage() {
  const { addToast } = useToast();
  const today = new Date();

  const [currentMonth, setCurrentMonth] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [activeMetric, setActiveMetric] = useState<MetricType>('mood');
  const [selectedDay, setSelectedDay] = useState<number | null>(
    currentMonth.getMonth() === today.getMonth() &&
      currentMonth.getFullYear() === today.getFullYear()
      ? today.getDate()
      : null,
  );

  const { calendarData, isLoading, error } = useCalendarData(
    currentMonth.getFullYear(),
    currentMonth.getMonth(),
  );

  // Re-fire view_calendar whenever the user changes the metric or navigates
  // months. The previous useEffect(..., []) + eslint-disable-next-line meant
  // the event only fired once with the initial (stale) activeMetric/month.
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      // Always track on mount.
      isFirstRender.current = false;
    }
    track('view_calendar', {
      view_type: activeMetric,
      month: currentMonth.toISOString().slice(0, 7),
    });
  }, [activeMetric, currentMonth]);

  const handlePrevMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    setSelectedDay(null);
  };

  const handleNextMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    setSelectedDay(null);
  };

  const handleSelectDay = (day: number) => {
    setSelectedDay(day);
    const mo = currentMonth.getMonth();
    const yr = currentMonth.getFullYear();
    const dateStr = `${yr}-${String(mo + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayData = calendarData[dateStr];
    const value = dayData?.[activeMetric];
    if (value) {
      const config = metricConfigs[activeMetric];
      const level = config.levels[value as 1 | 2 | 3 | 4 | 5];
      addToast('info', `${config.label}: ${level.label}`);
    }
  };

  return (
    <div className="flex flex-col gap-5 pb-8">
      <CalendarHeader month={currentMonth} onPrev={handlePrevMonth} onNext={handleNextMonth} />

      <MetricSegmentedControl value={activeMetric} onChange={setActiveMetric} />

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <p className="text-sm text-red-600">Failed to load calendar data.</p>
          <p className="text-xs text-content-secondary">
            Please check your connection and try again.
          </p>
        </div>
      ) : (
        <CalendarGrid
          month={currentMonth}
          data={calendarData}
          activeMetric={activeMetric}
          selectedDay={selectedDay}
          onSelectDay={handleSelectDay}
        />
      )}

      <CalendarLegend metricType={activeMetric} />
    </div>
  );
}
