import { Flame } from 'lucide-react';
import { StreakCalendarGrid } from './StreakCalendarGrid';

interface StreakCardProps {
  currentStreak: number;
  calendarMonth: string;
  totalRepetitions: number;
  sinceDate: string;
  calendarData: ('done' | 'missed' | 'empty')[][];
}

export function StreakCard({
  currentStreak,
  calendarMonth,
  totalRepetitions,
  sinceDate,
  calendarData,
}: StreakCardProps) {
  return (
    <div className="rounded-2xl border border-border-light bg-surface-secondary p-[21px] shadow-[0px_1px_2px_rgba(0,0,0,0.05)]">
      <div className="flex items-center gap-1">
        <Flame size={16} className="text-content-secondary" />
        <span className="text-sm font-medium text-content-secondary">Streak</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-4xl font-bold text-content">{currentStreak}</span>
        <span className="text-[28px] font-semibold text-content">{calendarMonth}</span>
      </div>
      <p className="text-xs text-content-tertiary">
        Total Repetitions: {totalRepetitions} — Since {sinceDate}
      </p>
      <div className="mt-6">
        <StreakCalendarGrid data={calendarData} />
      </div>
    </div>
  );
}
