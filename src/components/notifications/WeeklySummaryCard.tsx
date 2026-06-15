interface WeeklySummaryCardProps {
  onViewReport: () => void;
}

export function WeeklySummaryCard({ onViewReport }: WeeklySummaryCardProps) {
  return (
    <div className="rounded-3xl bg-primary p-5">
      <h2 className="text-xl font-bold text-white">Weekly Summary</h2>
      <p className="mt-2 text-sm leading-relaxed text-white/80">
        You have completed 92% of your planned rituals this week. You're performing better than 84%
        of similar users.
      </p>
      <button
        type="button"
        onClick={onViewReport}
        className="mt-4 rounded-full bg-white px-5 py-2 text-sm font-semibold text-primary"
      >
        View Report
      </button>
    </div>
  );
}
