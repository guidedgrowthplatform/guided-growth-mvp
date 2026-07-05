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
}

export function WeeklyHabitsHeader({
  overallPercent,
  overallDone,
  overallScheduled,
  dayLabels,
  todayLabel,
  columns,
}: WeeklyHabitsHeaderProps) {
  const labels = dayLabels.slice(0, columns);
  const total = columns + 1; // reported days plus today

  return (
    <div>
      <h2 className="text-lg font-bold text-content">This week</h2>

      <div className="mt-2 flex items-end gap-2">
        <span className="text-4xl font-bold leading-none text-content">{overallPercent}%</span>
        <span className="pb-1 text-xs font-medium text-content-tertiary">
          of scheduled done &middot; {overallDone} of {overallScheduled}
        </span>
      </div>

      <div
        className="mt-4 grid gap-1"
        style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}
      >
        {labels.map((label, index) => (
          <div
            key={`${label}-${index}`}
            className="text-center text-[10px] font-bold text-content-tertiary"
          >
            {label}
          </div>
        ))}
        <div className="text-center text-[10px] font-bold text-primary">{todayLabel}</div>
      </div>
    </div>
  );
}
