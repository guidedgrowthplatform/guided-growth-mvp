import { Check, Minus, X } from 'lucide-react';

// Four cell states:
//   done   -> green check (reported, done)
//   missed -> red X       (reported, not done)
//   off    -> gray cell + dash (NOT scheduled that day; totally fine, not a problem)
//   gap    -> blank, nothing there (scheduled but NEVER reported; the thing to avoid)
export type HabitWeekCell = 'done' | 'missed' | 'gap' | 'off';

interface WeeklyHabitsSummaryProps {
  overallPercent: number;
  overallDone: number;
  overallScheduled: number;
  rows: {
    name: string;
    cells: HabitWeekCell[];
    done: number;
    scheduled: number;
  }[];
  dayLabels?: string[];
}

const DEFAULT_DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function StatusCell({ status }: { status: HabitWeekCell }) {
  if (status === 'done') {
    return (
      <div className="flex aspect-square items-center justify-center rounded-sm bg-success">
        <Check size={15} className="text-white" />
      </div>
    );
  }

  if (status === 'missed') {
    return (
      <div className="flex aspect-square items-center justify-center rounded-sm border-2 border-danger bg-surface">
        <X size={13} className="text-danger" />
      </div>
    );
  }

  if (status === 'off') {
    // Not scheduled that day. A gray dash. Totally fine, not a problem.
    return (
      <div className="flex aspect-square items-center justify-center rounded-sm bg-border-light">
        <Minus size={13} className="text-content-tertiary" />
      </div>
    );
  }

  // gap: scheduled but NEVER reported. Just empty, nothing there. It breaks the streak.
  return <div className="aspect-square" />;
}

export function WeeklyHabitsSummary({
  overallPercent,
  overallDone,
  overallScheduled,
  rows,
  dayLabels = DEFAULT_DAY_LABELS,
}: WeeklyHabitsSummaryProps) {
  return (
    <section className="rounded-2xl border border-border-light bg-surface-secondary p-5 shadow-sm">
      <h2 className="text-lg font-bold text-content">This week</h2>

      <div className="mt-3 flex items-end gap-2">
        <span className="text-4xl font-bold leading-none text-content">{overallPercent}%</span>
        <span className="pb-1 text-sm font-medium text-content-tertiary">
          of scheduled habits done &middot; {overallDone} of {overallScheduled}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-[minmax(0,1fr)_repeat(7,20px)_32px] gap-x-1.5 gap-y-3">
        <div />
        {dayLabels.slice(0, 7).map((label, index) => (
          <div
            key={`${label}-${index}`}
            className="text-center text-[10px] font-bold text-content-tertiary"
          >
            {label}
          </div>
        ))}
        <div />

        {rows.map((row) => (
          <div key={row.name} className="contents">
            <div
              className="min-h-6 min-w-0 truncate pr-1 text-sm font-medium leading-6 text-content"
              title={row.name}
            >
              {row.name}
            </div>
            {row.cells.slice(0, 7).map((cell, index) => (
              <StatusCell key={`${row.name}-${index}`} status={cell} />
            ))}
            <div className="flex items-center justify-end text-xs font-bold text-content-tertiary">
              {row.done}/{row.scheduled}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
