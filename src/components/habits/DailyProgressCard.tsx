import { computeProgressSegments } from './dailyProgress';

interface DailyProgressCardProps {
  completed: number;
  total: number;
}

export function DailyProgressCard({ completed, total }: DailyProgressCardProps) {
  if (total === 0) return null;

  const { segmentCount, filledSegments, percent } = computeProgressSegments(completed, total);
  const displayCompleted = Math.max(0, Math.min(completed, total));

  return (
    <div className="overflow-hidden rounded-2xl border border-primary bg-surface">
      <div className="h-1.5 bg-primary" aria-hidden="true" />
      <div className="px-5 py-4">
        <h2 className="text-base font-bold text-content">Daily Progress</h2>
        <div className="mt-1 flex items-center justify-between">
          <p className="text-sm text-content-secondary">
            {displayCompleted} of {total} habits completed
          </p>
          <p className="text-sm font-semibold text-content">{percent}%</p>
        </div>
        <div className="mt-3 flex items-center gap-1.5" aria-hidden="true">
          {Array.from({ length: segmentCount }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full ${
                i < filledSegments ? 'bg-primary' : 'bg-border'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
