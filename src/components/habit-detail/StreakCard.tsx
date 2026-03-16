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
    <div className="rounded-2xl border border-[#f1f5f9] bg-white p-[21px] shadow-[0px_1px_2px_rgba(0,0,0,0.05)]">
      <div className="flex items-center gap-1">
        <Flame size={16} className="text-[#64748b]" />
        <span className="text-sm font-medium text-[#64748b]">Streak</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-4xl font-bold text-[#0f172a]">{currentStreak}</span>
        <span className="text-[28px] font-semibold text-[#0f172a]">{calendarMonth}</span>
      </div>
      <p className="text-xs text-[#94a3b8]">
        Total Repetitions: {totalRepetitions} — Since {sinceDate}
      </p>
      <div className="mt-6">
        <StreakCalendarGrid data={calendarData} />
      </div>
    </div>
  );
}
