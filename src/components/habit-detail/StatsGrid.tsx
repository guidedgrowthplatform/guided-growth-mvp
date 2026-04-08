interface StatsGridProps {
  completionRate: number;
  currentStreak: number;
  longestStreak: number;
  failedDays: number;
}

export function StatsGrid({
  completionRate,
  currentStreak,
  longestStreak,
  failedDays,
}: StatsGridProps) {
  const stats = [
    { label: 'Completion Rate', value: `${completionRate}%` },
    { label: 'Current Streak', value: `${currentStreak} Days` },
    { label: 'Longest Streak', value: `${longestStreak} Days` },
    { label: 'Failed Days', value: `${failedDays} Days` },
  ];

  return (
    <div className="grid grid-cols-2 gap-[10px]">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-2xl border border-border-light bg-surface-secondary p-[17px] shadow-[0px_1px_2px_rgba(0,0,0,0.05)]"
        >
          <p className="text-sm font-medium leading-[22px] text-content-secondary">{stat.label}</p>
          <p className="mt-1 text-xl font-bold leading-7 text-content">{stat.value}</p>
        </div>
      ))}
    </div>
  );
}
