import { Skeleton } from './Skeleton';

export function SpreadsheetSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface p-4 shadow-card">
      {/* Header row */}
      <div className="mb-3 flex gap-2">
        <Skeleton className="h-8 w-28" />
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-8 flex-1" />
        ))}
      </div>
      {/* Data rows */}
      {Array.from({ length: 5 }).map((_, row) => (
        <div key={row} className="mb-2 flex gap-2">
          <Skeleton className="h-7 w-28" />
          {Array.from({ length: 7 }).map((_, col) => (
            <Skeleton key={col} className="h-7 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
