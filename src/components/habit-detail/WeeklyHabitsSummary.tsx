import { Check, Minus, X } from 'lucide-react';
import { WeeklyHabitsHeader } from './WeeklyHabitsHeader';
import { WeeklyHabitRow, type HabitWeekCell } from './WeeklyHabitRow';

// The weekly habit summary card, composed from three pieces:
//   WeeklyHabitsHeader  the title, the percent, the day labels
//   WeeklyHabitRow      one per habit (flame, name, week strip), reusable
//   the legend          what each cell state means
// They render together but stay separate, so a caller (or the onboarding
// projection reveal) can bloom the header and each row on its own.
//
// The props API is unchanged from the old grid version, so existing callers
// keep working. `todayLabel` is new and optional (defaults below).
export type { HabitWeekCell };

interface WeeklyHabitsSummaryProps {
  overallPercent: number;
  overallDone: number;
  overallScheduled: number;
  rows: {
    name: string;
    cells: HabitWeekCell[];
    streak: number;
  }[];
  dayLabels?: string[];
  todayLabel?: string;
}

// Sunday first, matching the approved projection mock. The real week start is
// locale driven (Sunday in Israel, Monday elsewhere); a caller passes its own
// labels and today's letter for real data.
const DEFAULT_DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DEFAULT_TODAY_LABEL = 'S';

function Legend() {
  const box = 'flex h-[18px] w-[18px] items-center justify-center rounded';
  const item = (swatch: React.ReactNode, label: string) => (
    <div className="flex items-center gap-2 text-xs text-content-secondary">
      {swatch}
      <span>{label}</span>
    </div>
  );
  return (
    <div className="mt-4 flex flex-col gap-1.5 border-t border-border-light pt-3">
      {item(
        <span className={`${box} bg-success`}>
          <Check size={12} strokeWidth={3} className="text-white" />
        </span>,
        'Done',
      )}
      {item(
        <span className={`${box} border-[1.5px] border-danger bg-surface`}>
          <X size={10} strokeWidth={3} className="text-danger" />
        </span>,
        'Missed',
      )}
      {item(
        <span className={`${box} bg-border-light`}>
          <Minus size={10} strokeWidth={3} className="text-content-tertiary" />
        </span>,
        'Not scheduled',
      )}
      {item(<span className={`${box} border border-dashed border-border`} />, 'Not done yet')}
    </div>
  );
}

export function WeeklyHabitsSummary({
  overallPercent,
  overallDone,
  overallScheduled,
  rows,
  dayLabels = DEFAULT_DAY_LABELS,
  todayLabel = DEFAULT_TODAY_LABEL,
}: WeeklyHabitsSummaryProps) {
  // Every row and the header share this column count so their grids line up.
  const columns = rows[0]?.cells.length ?? DEFAULT_DAY_LABELS.length;

  return (
    <section className="rounded-2xl border border-border-light bg-surface-secondary p-5 shadow-sm">
      <WeeklyHabitsHeader
        overallPercent={overallPercent}
        overallDone={overallDone}
        overallScheduled={overallScheduled}
        dayLabels={dayLabels}
        todayLabel={todayLabel}
        columns={columns}
      />

      <div>
        {rows.map((row) => (
          <WeeklyHabitRow
            key={row.name}
            name={row.name}
            cells={row.cells}
            streak={row.streak}
            columns={columns}
          />
        ))}
      </div>

      <Legend />
    </section>
  );
}
