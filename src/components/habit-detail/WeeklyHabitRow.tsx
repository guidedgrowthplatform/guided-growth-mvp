import { Check, Minus, X } from 'lucide-react';
import { StreakFlame } from './StreakFlame';

// One habit line in the weekly summary: the streak flame and the name on the
// left (wrapping to two lines when long), and the week strip on the right (the
// reported days, then today as an empty outlined cell, since the day is not over
// yet). Self contained and reusable, so the summary can reveal one row at a time.
//
// Four reported cell states, plus today:
//   done   -> green check    (reported, done)
//   missed -> red X          (reported, not done)
//   off    -> gray dash      (not scheduled that day, fine, not a problem)
//   gap    -> dashed blank    (scheduled but never reported, breaks the streak)
//   today  -> empty, blue outline (the current day, nothing logged yet)
export type HabitWeekCell = 'done' | 'missed' | 'gap' | 'off';

function WeekCell({ status, today = false }: { status: HabitWeekCell; today?: boolean }) {
  const base = 'flex h-4 w-4 items-center justify-center rounded-[4px]';

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
        <Check size={10} strokeWidth={3.5} className="text-white" />
      </div>
    );
  }
  if (status === 'missed') {
    return (
      <div className={`${base} border-[1.5px] border-danger bg-surface`}>
        <X size={9} strokeWidth={3} className="text-danger" />
      </div>
    );
  }
  if (status === 'off') {
    return (
      <div className={`${base} bg-border-light`}>
        <Minus size={9} strokeWidth={3} className="text-content-tertiary" />
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
  // Whether to append the trailing "today" cell. Default true (the habit-detail
  // view). The onboarding projection passes false: its grid IS the projected
  // week starting on the user's start day, so there is no separate today cell.
  showToday?: boolean;
}

export function WeeklyHabitRow({ name, cells, streak, columns, showToday = true }: WeeklyHabitRowProps) {
  const shown = cells.slice(0, columns);

  return (
    <div className="flex items-center gap-2.5 border-t border-[#BCC6D4] py-2">
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <StreakFlame streak={streak} />
        <span className="line-clamp-2 text-[11.5px] font-medium leading-[1.14] text-content">
          {name}
        </span>
      </div>
      <div className="flex shrink-0 gap-[3px]">
        {shown.map((cell, index) => (
          <WeekCell key={`${name}-${index}`} status={cell} />
        ))}
        {showToday && <WeekCell status="gap" today />}
      </div>
    </div>
  );
}
