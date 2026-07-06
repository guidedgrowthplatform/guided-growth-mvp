// The title block for the weekly summary: This week, the percent done, and the
// day-label row. Kept as its own component so the summary composes it above the
// habit rows, and the label columns line up with each row's week strip (today's
// label sits in blue over the empty today cell).

interface WeeklyHabitsHeaderProps {
  overallPercent: number;
  overallDone: number;
  overallScheduled: number;
  // Labels for the reported day columns. Today's label is passed separately so
  // it can render in the primary color over the empty today cell.
  dayLabels: string[];
  todayLabel: string;
  // Number of reported day columns, so the label grid matches the row strips.
  columns: number;
  // Whether to render the trailing today label. Default true; the onboarding
  // projection passes false (its week starts on the start day, no today column).
  showToday?: boolean;
}

export function WeeklyHabitsHeader({
  overallPercent,
  overallDone,
  overallScheduled,
  dayLabels,
  todayLabel,
  columns,
  showToday = true,
}: WeeklyHabitsHeaderProps) {
  const labels = dayLabels.slice(0, columns);

  return (
    <div>
      <h2 className="text-lg font-bold text-content">This week</h2>

      <div className="mt-2 flex items-end gap-2">
        <span className="text-4xl font-bold leading-none text-content">{overallPercent}%</span>
        <span className="pb-1 text-xs font-medium text-content-tertiary">
          of scheduled done &middot; {overallDone} of {overallScheduled}
        </span>
      </div>

      <div className="mt-4 flex justify-end gap-[3px]">
        {labels.map((label, index) => (
          <div
            key={`${label}-${index}`}
            className="w-4 text-center text-[10px] font-bold text-content-tertiary"
          >
            {label}
          </div>
        ))}
        {showToday && (
          <div className="w-4 text-center text-[10px] font-bold text-primary">{todayLabel}</div>
        )}
      </div>
    </div>
  );
}
