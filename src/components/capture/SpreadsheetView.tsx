import { useState, useCallback, useMemo } from 'react';
import { format, getDay, parseISO } from 'date-fns';
import type { Metric, EntriesMap, MetricCreate } from '@shared/types';
import { DAYS_OF_WEEK, getMonthDays } from '@/utils/dates';
import { SpreadsheetRow } from './SpreadsheetRow';
import { CellEditPopup } from './CellEditPopup';
import { AddHabitModal } from './AddHabitModal';
import { UndoRedoControls } from './UndoRedoControls';
import { Button } from '@/components/ui/Button';

interface SpreadsheetViewProps {
  date: string;
  metrics: Metric[];
  entries: EntriesMap;
  onCellChange: (date: string, metricId: string, value: string) => void;
  onSaveDay: (date: string) => void;
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
  date, metrics, entries, onCellChange, onSaveDay, onAddHabit,
  onReorderMetrics, onRenameMetric,
  canUndo, canRedo, onUndo, onRedo, onPushHistory,
}: SpreadsheetViewProps) {
  const [selectedCell, setSelectedCell] = useState<{ date: string; metricId: string } | null>(null);
  const [editingCell, setEditingCell] = useState<{ date: string; metricId: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [popupPosition, setPopupPosition] = useState<{ x: number; y: number } | null>(null);
  const [editingHabitName, setEditingHabitName] = useState<{ metricId: string; name: string } | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const days = useMemo(() => getMonthDays(date), [date]);
  const dateStrings = useMemo(() => days.map((d) => format(d, 'yyyy-MM-dd')), [days]);

  const isCellSelected = useCallback((dateStr: string, metricId: string) => {
    return selectedCell?.date === dateStr && selectedCell?.metricId === metricId;
  }, [selectedCell]);

  const handleCellClick = useCallback((dateStr: string, metricId: string, e: React.MouseEvent) => {
    if (editingCell) {
      handleEditSave();
    }
    setSelectedCell({ date: dateStr, metricId });
    setEditingCell(null);
    setPopupPosition(null);
  }, [editingCell]);

  const handleCellMouseDown = useCallback((dateStr: string, metricId: string, e: React.MouseEvent) => {
    if (editingCell) handleEditSave();
    setSelectedCell({ date: dateStr, metricId });
  }, [editingCell]);

  const handleCellDoubleClick = useCallback((dateStr: string, metricId: string, cellEl: HTMLElement) => {
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
  }, [metrics, entries]);

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
    onSaveDay(editingCell.date);
    setEditingCell(null);
    setEditValue('');
    setPopupPosition(null);
  }, [editingCell, editValue, metrics, onCellChange, onSaveDay, onPushHistory]);

  const handleEditCancel = useCallback(() => {
    setEditingCell(null);
    setEditValue('');
    setPopupPosition(null);
  }, []);

  const handleFillHandleStart = useCallback((e: React.MouseEvent, sourceDate: string, sourceMetricId: string) => {
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
      if (targetDate && targetMetricId && !(targetDate === sourceDate && targetMetricId === sourceMetricId)) {
        onCellChange(targetDate, targetMetricId, sourceValue);
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp, { once: true });
  }, [entries, onCellChange, onPushHistory]);

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    if (editingHabitName) { e.preventDefault(); return; }
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    const row = (e.target as HTMLElement).closest('tr');
    if (row) row.style.opacity = '0.5';
  }, [editingHabitName]);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    const row = (e.target as HTMLElement).closest('tr');
    if (row) row.style.opacity = '';
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== dropIndex) {
      onReorderMetrics(draggedIndex, dropIndex);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, [draggedIndex, onReorderMetrics]);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <UndoRedoControls canUndo={canUndo} canRedo={canRedo} onUndo={onUndo} onRedo={onRedo} />
        <Button size="sm" variant="secondary" onClick={() => setShowAddModal(true)}>+ Add Habit</Button>
      </div>

      <div className="glass rounded-2xl shadow-xl border border-cyan-200/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[800px] lg:min-w-0">
            <thead>
              <tr className="bg-cyan-100/50 border-b-2 border-cyan-300/50">
                <th className="sticky left-0 z-20 bg-cyan-100/50 px-2 py-2 text-left text-xs font-semibold text-slate-800 border-r-2 border-cyan-300/50 min-w-[120px]">
                  HABITS
                </th>
                {days.map((day, idx) => {
                  const dayOfWeek = DAYS_OF_WEEK[getDay(day)];
                  return (
                    <th key={dateStrings[idx]} className="px-1 py-2 text-center border-l border-cyan-200/30 min-w-[32px]">
                      <div className="text-[10px] font-medium text-slate-600">{dayOfWeek}</div>
                      <div className="text-xs font-semibold text-slate-800">{format(day, 'd')}</div>
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
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => { e.preventDefault(); setDragOverIndex(idx); }}
                  onDragLeave={() => setDragOverIndex(null)}
                  onDrop={(e) => handleDrop(e, idx)}
                  isDragOver={dragOverIndex === idx}
                  editingHabitName={editingHabitName}
                  onHabitNameDoubleClick={(m) => setEditingHabitName({ metricId: m.id, name: m.name })}
                  onHabitNameSave={(id, name) => { onRenameMetric(id, name); setEditingHabitName(null); }}
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

      <AddHabitModal open={showAddModal} onClose={() => setShowAddModal(false)} onAdd={onAddHabit} />
    </div>
  );
}
