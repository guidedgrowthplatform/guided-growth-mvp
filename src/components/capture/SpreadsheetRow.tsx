import type { Metric, EntriesMap } from '@shared/types';
import { SpreadsheetCell } from './SpreadsheetCell';

interface SpreadsheetRowProps {
  metric: Metric;
  metricIndex: number;
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
  // Drag reorder
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  isDragOver: boolean;
  // Habit name editing
  editingHabitName: { metricId: string; name: string } | null;
  onHabitNameDoubleClick: (metric: Metric) => void;
  onHabitNameSave: (metricId: string, newName: string) => void;
  onHabitNameCancel: () => void;
  isCellSelected: (date: string, metricId: string) => boolean;
}

export function SpreadsheetRow({
  metric, metricIndex, days, dateStrings, entries,
  selectedCell, editingCell, editValue, onEditChange,
  onCellClick, onCellMouseDown, onCellDoubleClick,
  onEditSave, onEditCancel, onFillHandleStart, onQuickToggle,
  onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop, isDragOver,
  editingHabitName, onHabitNameDoubleClick, onHabitNameSave, onHabitNameCancel,
  isCellSelected,
}: SpreadsheetRowProps) {
  const isEditingName = editingHabitName?.metricId === metric.id;

  return (
    <tr
      className={`border-b border-cyan-200/30 ${metricIndex % 2 === 0 ? 'bg-white/30' : 'bg-cyan-50/20'} ${isDragOver ? 'purple-row-border relative' : ''}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Habit name cell */}
      <td className="sticky left-0 z-10 px-1 py-1 text-xs font-semibold text-slate-800 border-r-2 border-cyan-300/50 bg-inherit">
        <div className="flex items-center gap-0.5">
          <span
            draggable
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            className="cursor-grab text-slate-400 hover:text-slate-600 flex-shrink-0 hidden sm:inline"
          >
            &#x2630;
          </span>
          {isEditingName ? (
            <input
              autoFocus
              defaultValue={editingHabitName.name}
              onBlur={(e) => onHabitNameSave(metric.id, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { onHabitNameSave(metric.id, (e.target as HTMLInputElement).value); }
                if (e.key === 'Escape') { onHabitNameCancel(); }
                e.stopPropagation();
              }}
              className="w-full text-xs px-1 py-0.5 border border-cyan-300/50 rounded bg-white"
            />
          ) : (
            <span
              className="truncate cursor-pointer"
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
