import { useState } from 'react';
import {
  CalendarHeader,
  CalendarGrid,
  CalendarLegend,
  MetricSegmentedControl,
  mockCalendarData,
  metricConfigs,
} from '@/components/calendar';
import type { MetricType } from '@/components/calendar';
import { useToast } from '@/contexts/ToastContext';

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
    const dayData = mockCalendarData[dateStr];
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

      <CalendarGrid
        month={currentMonth}
        data={mockCalendarData}
        activeMetric={activeMetric}
        selectedDay={selectedDay}
        onSelectDay={handleSelectDay}
      />

      <CalendarLegend metricType={activeMetric} />
    </div>
  );
}
