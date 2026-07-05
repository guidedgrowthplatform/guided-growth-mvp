import { Check, Minus, X } from 'lucide-react';
import { StreakFlame } from './StreakFlame';

// One habit line in the weekly summary: the streak flame and the name on top,
// then the week strip below (the reported days, then today as an empty outlined
// cell, since the day is not over yet). Self contained and reusable, so the
// summary can reveal one row at a time.
//
// Four reported cell states, plus today:
//   done   -> green check    (reported, done)
//   missed -> red X          (reported, not done)
//   off    -> gray dash      (not scheduled that day, fine, not a problem)
//   gap    -> dashed blank    (scheduled but never reported, breaks the streak)
//   today  -> empty, blue outline (the current day, nothing logged yet)
export type HabitWeekCell = 'done' | 'missed' | 'gap' | 'off';

function WeekCell({ status, today = false }: { status: HabitWeekCell; today?: boolean }) {
  const base =
    'flex aspect-square w-full max-w-[30px] items-center justify-center rounded-md';

  if (today) {
    // Today is always empty: the day is not over. Just the blue outline.
    return (
      <div
        className={`${base} border border-dashed border-border ring-2 ring-primary/60 ring-offset-1 ring-offset-surface`}
      />
    );
  }
  if (status === 'done') {
    return (
      <div className={`${base} bg-success`}>
        <Check size={15} strokeWidth={3} className="text-white" />
      </div>
    );
  }
  if (status === 'missed') {
    return (
      <div className={`${base} border-[1.5px] border-danger bg-surface`}>
        <X size={12} strokeWidth={3} className="text-danger" />
      </div>
    );
  }
  if (status === 'off') {
    return (
      <div className={`${base} bg-border-light`}>
        <Minus size={12} strokeWidth={3} className="text-content-tertiary" />
      </div>
    );
  }
  // gap: scheduled but never reported. Empty with a dashed edge. Breaks the streak.
  return <div className={`${base} border border-dashed border-border`} />;
}

interface WeeklyHabitRowProps {
  name: string;
  cells: HabitWeekCell[];
  streak: number;
  // How many reported day columns to render (not counting today). The summary
  // passes this so every row and the header line up on the same grid.
  columns: number;
}

export function WeeklyHabitRow({ name, cells, streak, columns }: WeeklyHabitRowProps) {
  const shown = cells.slice(0, columns);
  const total = columns + 1; // reported days plus today

  return (
    <div className="border-t border-border-light py-3">
      <div className="mb-2 flex items-center gap-1.5">
        <StreakFlame streak={streak} />
        <span className="text-sm font-medium leading-snug text-content">{name}</span>
      </div>
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}
      >
        {shown.map((cell, index) => (
          <div key={`${name}-${index}`} className="flex justify-center">
            <WeekCell status={cell} />
          </div>
        ))}
        <div className="flex justify-center">
          <WeekCell status="gap" today />
        </div>
      </div>
    </div>
  );
}
