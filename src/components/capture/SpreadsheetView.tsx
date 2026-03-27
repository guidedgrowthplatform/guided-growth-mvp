import { format, getDay } from 'date-fns';
import { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/Button';
import { useClipboard } from '@/hooks/useClipboard';
import { useKeyboardNavigation } from '@/hooks/useKeyboardNavigation';
import { DAYS_OF_WEEK, getMonthDays, getWeekDays } from '@/utils/dates';
import type { Metric, EntriesMap, MetricCreate, SpreadsheetRange } from '@shared/types';
import { AddHabitModal } from './AddHabitModal';
import { CellEditPopup } from './CellEditPopup';
import { SpreadsheetRow } from './SpreadsheetRow';
import { UndoRedoControls } from './UndoRedoControls';

interface SpreadsheetViewProps {
  date: string;
  spreadsheetRange: SpreadsheetRange;
  metrics: Metric[];
  entries: EntriesMap;
  onCellChange: (date: string, metricId: string, value: string) => void;
  onSaveDay: (date: string, pendingMetricId?: string, pendingValue?: string) => void;
  onAddHabit: (data: MetricCreate) => void;
  onReorderMetrics: (fromIndex: number, toIndex: number) => void;
  onRenameMetric: (metricId: string, newName: string) => void;
  // Undo/redo
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onPushHistory: () => void;
}

export function SpreadsheetView({
  date,
  spreadsheetRange,
  metrics,
  entries,
  onCellChange,
  onSaveDay,
  onAddHabit,
  onReorderMetrics,
  onRenameMetric,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onPushHistory,
}: SpreadsheetViewProps) {
  const [selectedCell, setSelectedCell] = useState<{ date: string; metricId: string } | null>(null);
  const [editingCell, setEditingCell] = useState<{ date: string; metricId: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [popupPosition, setPopupPosition] = useState<{ x: number; y: number } | null>(null);
  const [editingHabitName, setEditingHabitName] = useState<{
    metricId: string;
    name: string;
  } | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const days = useMemo(
    () => (spreadsheetRange === 'week' ? getWeekDays(date) : getMonthDays(date)),
    [date, spreadsheetRange],
  );
  const dateStrings = useMemo(() => days.map((d) => format(d, 'yyyy-MM-dd')), [days]);

  const isCellSelected = useCallback(
    (dateStr: string, metricId: string) => {
      return selectedCell?.date === dateStr && selectedCell?.metricId === metricId;
    },
    [selectedCell],
  );

  const handleEditSave = useCallback(() => {
    if (!editingCell) return;
    const metric = metrics.find((m) => m.id === editingCell.metricId);
    if (!metric) return;

    onPushHistory();
    let valueToSave = editValue.trim();
    if (valueToSave !== '-') {
      if (metric.input_type === 'binary') {
        valueToSave = valueToSave === '1' ? 'yes' : valueToSave === '0' ? 'no' : '';
      } else if (metric.input_type === 'numeric') {
        valueToSave = valueToSave === '' ? '' : String(parseFloat(valueToSave) || valueToSave);
      }
    }

    onCellChange(editingCell.date, editingCell.metricId, valueToSave);
    onSaveDay(editingCell.date, editingCell.metricId, valueToSave);
    setEditingCell(null);
    setEditValue('');
    setPopupPosition(null);
  }, [editingCell, editValue, metrics, onCellChange, onSaveDay, onPushHistory]);

  const handleEditCancel = useCallback(() => {
    setEditingCell(null);
    setEditValue('');
    setPopupPosition(null);
  }, []);

  const handleCellClick = useCallback(
    (dateStr: string, metricId: string, _e: React.MouseEvent) => {
      if (editingCell) {
        handleEditSave();
      }
      setSelectedCell({ date: dateStr, metricId });
      setEditingCell(null);
      setPopupPosition(null);
    },
    [editingCell, handleEditSave],
  );

  const handleCellMouseDown = useCallback(
    (dateStr: string, metricId: string, _e: React.MouseEvent) => {
      if (editingCell) handleEditSave();
      setSelectedCell({ date: dateStr, metricId });
    },
    [editingCell, handleEditSave],
  );

  const handleCellDoubleClick = useCallback(
    (dateStr: string, metricId: string, cellEl: HTMLElement) => {
      const metric = metrics.find((m) => m.id === metricId);
      if (!metric) return;

      const currentValue = entries[dateStr]?.[metricId] || '';
      let displayValue = currentValue;
      if (metric.input_type === 'binary') {
        displayValue = currentValue === 'yes' ? '1' : currentValue === 'no' ? '0' : '';
      }

      setSelectedCell({ date: dateStr, metricId });
      setEditingCell({ date: dateStr, metricId });
      setEditValue(displayValue);

      const rect = cellEl.getBoundingClientRect();
      setPopupPosition({ x: rect.right, y: rect.top });
    },
    [metrics, entries],
  );

  const handleFillHandleStart = useCallback(
    (e: React.MouseEvent, sourceDate: string, sourceMetricId: string) => {
      e.preventDefault();
      e.stopPropagation();
      const sourceValue = entries[sourceDate]?.[sourceMetricId];
      if (!sourceValue && sourceValue !== '0') return;

      onPushHistory();

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const el = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
        if (!el) return;
        const td = el.closest('td[data-date]') as HTMLElement | null;
        if (!td) return;
        const targetDate = td.getAttribute('data-date');
        const targetMetricId = td.getAttribute('data-metric-id');
        if (
          targetDate &&
          targetMetricId &&
          !(targetDate === sourceDate && targetMetricId === sourceMetricId)
        ) {
          onCellChange(targetDate, targetMetricId, sourceValue);
        }
      };

      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp, { once: true });
    },
    [entries, onCellChange, onPushHistory],
  );

  const handleQuickToggle = useCallback(
    (dateStr: string, metricId: string, value: string) => {
      onPushHistory();
      onCellChange(dateStr, metricId, value);
      onSaveDay(dateStr, metricId, value);
    },
    [onPushHistory, onCellChange, onSaveDay],
  );

  const handleSelectCell = useCallback((dateStr: string, metricId: string) => {
    if (!dateStr && !metricId) {
      setSelectedCell(null);
    } else {
      setSelectedCell({ date: dateStr, metricId });
    }
  }, []);

  const handleStartEdit = useCallback(
    (dateStr: string, metricId: string) => {
      const cellEl = document.querySelector(
        `td[data-date="${dateStr}"][data-metric-id="${metricId}"]`,
      ) as HTMLElement | null;
      if (cellEl) handleCellDoubleClick(dateStr, metricId, cellEl);
    },
    [handleCellDoubleClick],
  );

  const handleDelete = useCallback(
    (dateStr: string, metricId: string) => {
      onPushHistory();
      onCellChange(dateStr, metricId, '');
      onSaveDay(dateStr, metricId, '');
    },
    [onPushHistory, onCellChange, onSaveDay],
  );

  const { copy, paste } = useClipboard(entries, onCellChange, onPushHistory);

  useKeyboardNavigation({
    selectedCell,
    editingCell,
    dateStrings,
    metrics,
    onSelectCell: handleSelectCell,
    onStartEdit: handleStartEdit,
    onDelete: handleDelete,
    onCopy: copy,
    onPaste: paste,
    onUndo,
    onRedo,
  });

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <UndoRedoControls canUndo={canUndo} canRedo={canRedo} onUndo={onUndo} onRedo={onRedo} />
        <Button size="sm" variant="secondary" onClick={() => setShowAddModal(true)}>
          + Add Habit
        </Button>
      </div>

      <div className="-mx-4 overflow-hidden rounded-none border border-border bg-surface shadow-card sm:mx-0 sm:rounded-2xl">
        <div className="-webkit-overflow-scrolling-touch overflow-x-auto">
          <table
            className={`w-full border-collapse ${spreadsheetRange === 'week' ? 'min-w-[400px]' : 'min-w-[800px]'} lg:min-w-0`}
          >
            <thead>
              <tr className="border-b-2 border-border bg-surface-secondary">
                <th className="sticky left-0 z-20 w-[80px] max-w-[80px] border-r-2 border-border bg-surface-secondary px-2 py-2 text-left text-xs font-semibold text-content sm:w-[120px] sm:max-w-[120px]">
                  HABITS
                </th>
                {days.map((day, idx) => {
                  const dayOfWeek = DAYS_OF_WEEK[getDay(day)];
                  const cellMinW = spreadsheetRange === 'week' ? 'min-w-[44px]' : 'min-w-[32px]';
                  return (
                    <th
                      key={dateStrings[idx]}
                      className={`border-l border-border px-1 py-2 text-center ${cellMinW}`}
                    >
                      <div className="text-[10px] font-medium text-content-secondary">
                        {dayOfWeek}
                      </div>
                      <div className="text-xs font-semibold text-content">{format(day, 'd')}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {metrics.map((metric, idx) => (
                <SpreadsheetRow
                  key={metric.id}
                  metric={metric}
                  metricIndex={idx}
                  metricCount={metrics.length}
                  days={days}
                  dateStrings={dateStrings}
                  entries={entries}
                  selectedCell={selectedCell}
                  editingCell={editingCell}
                  editValue={editValue}
                  onEditChange={setEditValue}
                  onCellClick={handleCellClick}
                  onCellMouseDown={handleCellMouseDown}
                  onCellDoubleClick={handleCellDoubleClick}
                  onEditSave={handleEditSave}
                  onEditCancel={handleEditCancel}
                  onFillHandleStart={handleFillHandleStart}
                  onQuickToggle={handleQuickToggle}
                  onMoveUp={() => {
                    if (idx > 0) onReorderMetrics(idx, idx - 1);
                  }}
                  onMoveDown={() => {
                    if (idx < metrics.length - 1) onReorderMetrics(idx, idx + 1);
                  }}
                  editingHabitName={editingHabitName}
                  onHabitNameDoubleClick={(m) =>
                    setEditingHabitName({ metricId: m.id, name: m.name })
                  }
                  onHabitNameSave={(id, name) => {
                    onRenameMetric(id, name);
                    setEditingHabitName(null);
                  }}
                  onHabitNameCancel={() => setEditingHabitName(null)}
                  isCellSelected={isCellSelected}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <CellEditPopup
        position={popupPosition}
        metric={editingCell ? metrics.find((m) => m.id === editingCell.metricId) || null : null}
        value={editValue}
        onChange={setEditValue}
        onSave={handleEditSave}
        onCancel={handleEditCancel}
      />

      <AddHabitModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={onAddHabit}
      />
    </div>
  );
}
