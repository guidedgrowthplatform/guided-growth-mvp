import { type MetricType, metricConfigs } from './calendarConfig';
import { CalendarDayCell } from './CalendarDayCell';
import type { DayMetrics } from './calendarTypes';

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

interface CalendarGridProps {
  month: Date;
  data: Record<string, DayMetrics>;
  activeMetric: MetricType;
  selectedDay: number | null;
  onSelectDay: (day: number) => void;
}

export function CalendarGrid({
  month,
  data,
  activeMetric,
  selectedDay,
  onSelectDay,
}: CalendarGridProps) {
  const year = month.getFullYear();
  const mo = month.getMonth();
  const firstDayOfWeek = new Date(year, mo, 1).getDay();
  const daysInMonth = new Date(year, mo + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const config = metricConfigs[activeMetric];

  return (
    <div>
      <div className="mb-4 grid grid-cols-7">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-center text-[12px] font-semibold uppercase text-[#94a3b8]">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-4">
        {cells.map((day, i) => {
          const dateStr = day
            ? `${year}-${String(mo + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            : null;
          const dayData = dateStr ? data[dateStr] : undefined;
          const value = dayData ? (dayData[activeMetric] ?? null) : null;
          const levelConfig = value !== null ? config.levels[value as 1 | 2 | 3 | 4 | 5] : null;

          return (
            <div key={i} className="flex justify-center">
              <CalendarDayCell
                day={day}
                value={value}
                levelConfig={levelConfig}
                isSelected={day === selectedDay}
                onClick={() => day && onSelectDay(day)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
