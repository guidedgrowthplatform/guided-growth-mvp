import type { Metric, EntriesMap } from '@shared/types';
import { SpreadsheetCell } from './SpreadsheetCell';

interface SpreadsheetRowProps {
  metric: Metric;
  metricIndex: number;
  metricCount: number;
  days: Date[];
  dateStrings: string[];
  entries: EntriesMap;
  selectedCell: { date: string; metricId: string } | null;
  editingCell: { date: string; metricId: string } | null;
  editValue: string;
  onEditChange: (value: string) => void;
  onCellClick: (date: string, metricId: string, e: React.MouseEvent) => void;
  onCellMouseDown: (date: string, metricId: string, e: React.MouseEvent) => void;
  onCellDoubleClick: (date: string, metricId: string, cellEl: HTMLElement) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
  onFillHandleStart: (e: React.MouseEvent, date: string, metricId: string) => void;
  onQuickToggle?: (date: string, metricId: string, value: string) => void;
  // Move reorder
  onMoveUp: () => void;
  onMoveDown: () => void;
  // Habit name editing
  editingHabitName: { metricId: string; name: string } | null;
  onHabitNameDoubleClick: (metric: Metric) => void;
  onHabitNameSave: (metricId: string, newName: string) => void;
  onHabitNameCancel: () => void;
  isCellSelected: (date: string, metricId: string) => boolean;
}

export function SpreadsheetRow({
  metric,
  metricIndex,
  metricCount,
  days,
  dateStrings,
  entries,
  // selectedCell,
  editingCell,
  editValue,
  onEditChange,
  onCellClick,
  onCellMouseDown,
  onCellDoubleClick,
  onEditSave,
  onEditCancel,
  onFillHandleStart,
  onQuickToggle,
  onMoveUp,
  onMoveDown,
  editingHabitName,
  onHabitNameDoubleClick,
  onHabitNameSave,
  onHabitNameCancel,
  isCellSelected,
}: SpreadsheetRowProps) {
  const isEditingName = editingHabitName?.metricId === metric.id;
  const isFirst = metricIndex === 0;
  const isLast = metricIndex === metricCount - 1;

  return (
    <tr
      className={`border-b border-border ${metricIndex % 2 === 0 ? 'bg-surface/30' : 'bg-surface-secondary/20'}`}
    >
      {/* Habit name cell */}
      <td className="sticky left-0 z-10 border-r-2 border-border bg-inherit px-1 py-1 text-xs font-semibold text-content">
        <div className="flex items-center gap-0.5">
          {/* Up/Down reorder buttons */}
          <div className="flex flex-shrink-0 flex-col" style={{ lineHeight: 0 }}>
            <button
              type="button"
              disabled={isFirst}
              onClick={(e) => {
                e.stopPropagation();
                onMoveUp();
              }}
              className={`px-0.5 text-[9px] leading-none ${isFirst ? 'cursor-default text-content-tertiary' : 'cursor-pointer text-content-tertiary hover:text-primary'}`}
              title="Move up"
            >
              ▲
            </button>
            <button
              type="button"
              disabled={isLast}
              onClick={(e) => {
                e.stopPropagation();
                onMoveDown();
              }}
              className={`px-0.5 text-[9px] leading-none ${isLast ? 'cursor-default text-content-tertiary' : 'cursor-pointer text-content-tertiary hover:text-primary'}`}
              title="Move down"
            >
              ▼
            </button>
          </div>
          {isEditingName ? (
            <input
              autoFocus
              defaultValue={editingHabitName.name}
              onBlur={(e) => onHabitNameSave(metric.id, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onHabitNameSave(metric.id, (e.target as HTMLInputElement).value);
                }
                if (e.key === 'Escape') {
                  onHabitNameCancel();
                }
                e.stopPropagation();
              }}
              className="w-full rounded border border-border bg-surface px-1 py-0.5 text-xs"
            />
          ) : (
            <span
              className="cursor-pointer truncate"
              onDoubleClick={() => onHabitNameDoubleClick(metric)}
              title={metric.name}
            >
              {metric.name}
            </span>
          )}
        </div>
      </td>

      {/* Day cells */}
      {days.map((day, dayIdx) => {
        const dateStr = dateStrings[dayIdx];
        const cellValue = entries[dateStr]?.[metric.id];
        const isThisSelected = isCellSelected(dateStr, metric.id);
        const isThisEditing = editingCell?.date === dateStr && editingCell?.metricId === metric.id;

        return (
          <SpreadsheetCell
            key={dateStr}
            date={dateStr}
            metric={metric}
            value={cellValue}
            isSelected={isThisSelected}
            isEditing={isThisEditing}
            editValue={editValue}
            onEditChange={onEditChange}
            onClick={(e) => onCellClick(dateStr, metric.id, e)}
            onMouseDown={(e) => onCellMouseDown(dateStr, metric.id, e)}
            onDoubleClick={(el) => onCellDoubleClick(dateStr, metric.id, el)}
            onEditSave={onEditSave}
            onEditCancel={onEditCancel}
            onFillHandleStart={(e) => onFillHandleStart(e, dateStr, metric.id)}
            onQuickToggle={onQuickToggle}
          />
        );
      })}
    </tr>
  );
}
