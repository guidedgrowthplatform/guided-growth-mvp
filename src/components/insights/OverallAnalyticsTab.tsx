import { useHabitAnalytics } from '@/hooks/useHabitAnalytics';
import { HabitCompletionCard } from './HabitCompletionCard';
import { HabitPerformanceList } from './HabitPerformanceList';
import { MoodCorrelationCard } from './MoodCorrelationCard';
import { SegmentedControl } from './SegmentedControl';

const timeRangeItems = [
  { label: 'Week', value: 'week' },
  { label: 'Month', value: 'month' },
  { label: 'Year', value: 'year' },
];

interface OverallAnalyticsTabProps {
  timeRange: string;
  onTimeRangeChange: (value: string) => void;
}

export function OverallAnalyticsTab({ timeRange, onTimeRangeChange }: OverallAnalyticsTabProps) {
  const { habitStats, completionByRange, isLoading, error } = useHabitAnalytics();

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <SegmentedControl
          items={timeRangeItems}
          value={timeRange}
          onChange={onTimeRangeChange}
          size="sm"
        />
        <div className="rounded-lg bg-danger/10 p-4 text-[14px] text-danger">
          Failed to load analytics: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <SegmentedControl
        items={timeRangeItems}
        value={timeRange}
        onChange={onTimeRangeChange}
        size="sm"
      />
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        <>
          <HabitCompletionCard timeRange={timeRange} completionByRange={completionByRange} />
          <HabitPerformanceList habits={habitStats} />
          <MoodCorrelationCard />
        </>
      )}
    </div>
  );
}
