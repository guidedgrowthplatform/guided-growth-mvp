import { Skeleton } from './Skeleton';

export function SpreadsheetSkeleton() {
  return (
    <div className="bg-surface rounded-lg shadow-card border border-border overflow-hidden p-4">
      {/* Header row */}
      <div className="flex gap-2 mb-3">
        <Skeleton className="h-8 w-28" />
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-8 flex-1" />
        ))}
      </div>
      {/* Data rows */}
      {Array.from({ length: 5 }).map((_, row) => (
        <div key={row} className="flex gap-2 mb-2">
          <Skeleton className="h-7 w-28" />
          {Array.from({ length: 7 }).map((_, col) => (
            <Skeleton key={col} className="h-7 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
