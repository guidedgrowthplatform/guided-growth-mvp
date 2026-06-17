export function NotificationSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-4 rounded-2xl bg-surface p-3.5 shadow-sm">
          <div className="h-14 w-14 shrink-0 animate-pulse rounded-full bg-content/10" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-1/2 animate-pulse rounded bg-content/10" />
            <div className="h-3 w-3/4 animate-pulse rounded bg-content/10" />
          </div>
        </div>
      ))}
    </div>
  );
}
