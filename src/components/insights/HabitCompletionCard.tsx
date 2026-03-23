import type { CompletionStats } from '@/hooks/useHabitAnalytics.types';
import { BarChart } from './BarChart';

interface HabitCompletionCardProps {
  timeRange: string;
  completionByRange: Record<string, CompletionStats>;
}

export function HabitCompletionCard({ timeRange, completionByRange }: HabitCompletionCardProps) {
  const fallback: CompletionStats = {
    percentage: 0,
    trend: '0%',
    trendPositive: false,
    subtitle: 'No data',
    bars: [],
  };
  const stats = completionByRange[timeRange] ?? fallback;

  return (
    <div className="rounded-lg border border-border-light bg-surface p-[25px] shadow-sm">
      <div className="flex flex-col gap-1">
        <span className="text-[14px] font-medium leading-5 text-content-secondary">
          Habit Completion
        </span>
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1">
            <span className="text-[24px] font-bold leading-8 text-content transition-all duration-300">
              {stats.percentage}%
            </span>
            <span className="text-[14px] leading-5 text-content-tertiary">{stats.subtitle}</span>
          </div>
          <span
            className={`rounded-full px-2 py-1 text-[12px] font-bold leading-4 transition-all duration-300 ${
              stats.trendPositive ? 'bg-[#f0fdf4] text-success' : 'bg-[#fef2f2] text-danger'
            }`}
          >
            {stats.trend} {stats.trendPositive ? '↑' : '↓'}
          </span>
        </div>
      </div>
      <div className="mt-8">
        <BarChart data={stats.bars} />
      </div>
    </div>
  );
}
