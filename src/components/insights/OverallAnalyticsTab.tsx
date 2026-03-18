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
  return (
    <div className="flex flex-col gap-6">
      <SegmentedControl
        items={timeRangeItems}
        value={timeRange}
        onChange={onTimeRangeChange}
        size="sm"
      />
      <HabitCompletionCard timeRange={timeRange} />
      <HabitPerformanceList />
      <MoodCorrelationCard />
    </div>
  );
}
