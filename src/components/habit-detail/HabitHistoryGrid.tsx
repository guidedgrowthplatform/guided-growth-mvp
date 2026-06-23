import { Check, Minus, X } from 'lucide-react';
import { Fragment } from 'react';

// Compact habit-history matrix: habits down the left, recent days across the top.
// Mirrors the cell visual of StreakCalendarGrid so the two read as one system:
//   done  = blue fill + white check
//   missed = red outline + red X
//   off    = gray fill + dash (not scheduled / no data)
// Built small on purpose so the coach can drop "your last few days" into chat.

export type HabitHistoryStatus = 'done' | 'missed' | 'off';

export interface HabitHistoryRow {
  id: string;
  name: string;
  /** One status per day, oldest to newest. Length must match `days`. */
  cells: HabitHistoryStatus[];
}

interface HabitHistoryGridProps {
  /** Column headers, one per day, oldest to newest. e.g. ['Mon', 'Tue', 'Wed'] */
  days: string[];
  rows: HabitHistoryRow[];
  /** Square cell edge in px. Default 24 reads well inside a chat bubble. */
  cellSize?: number;
  /** Min width of the habit-name column in px. Default 84. */
  labelWidth?: number;
}

function cellClass(status: HabitHistoryStatus): string {
  switch (status) {
    case 'done':
      return 'bg-success';
    case 'missed':
      return 'border-2 border-danger bg-surface';
    case 'off':
    default:
      return 'bg-border-light';
  }
}

export function HabitHistoryGrid({ days, rows, cellSize = 24, labelWidth = 84 }: HabitHistoryGridProps) {
  const iconSize = Math.round(cellSize * 0.6);
  return (
    <div
      className="grid items-center gap-x-[6px] gap-y-[6px]"
      style={{
        gridTemplateColumns: `minmax(${labelWidth}px, auto) repeat(${days.length}, ${cellSize}px)`,
      }}
    >
      <div />
      {days.map((day, i) => (
        <div
          key={`head-${i}`}
          className="flex items-center justify-center text-[10px] font-bold text-content-tertiary"
        >
          {day}
        </div>
      ))}

      {rows.map((row) => (
        <Fragment key={row.id}>
          <div className="truncate pr-2 text-[12px] font-medium text-content">{row.name}</div>
          {row.cells.map((status, ci) => (
            <div
              key={`${row.id}-${ci}`}
              className={`flex items-center justify-center rounded-md ${cellClass(status)}`}
              style={{ width: cellSize, height: cellSize }}
              aria-label={`${row.name} ${days[ci] ?? ''}: ${status}`}
            >
              {status === 'done' && <Check size={iconSize} className="text-white" />}
              {status === 'missed' && <X size={iconSize} className="text-danger" />}
              {status === 'off' && <Minus size={iconSize} className="text-content-tertiary" />}
            </div>
          ))}
        </Fragment>
      ))}
    </div>
  );
}
