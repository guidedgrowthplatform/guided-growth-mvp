import { useState, useEffect, useCallback, useMemo } from 'react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import type { ViewMode, MetricCreate, EntriesMap } from '@shared/types';
import { useMetrics } from '@/hooks/useMetrics';
import { useEntries } from '@/hooks/useEntries';
import { useUndoRedo } from '@/hooks/useUndoRedo';
import { ViewModeToggle } from './ViewModeToggle';
import { DateNavigation } from './DateNavigation';
import { FormView } from './FormView';
import { SpreadsheetView } from './SpreadsheetView';

export function CaptureView() {
  const [viewMode, setViewMode] = useState<ViewMode>('spreadsheet');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const { activeMetrics: metrics, create: createMetric, reorder: reorderMetrics, update: updateMetric } = useMetrics();
  const { entries, load: loadEntries, updateCell, saveDay, setEntries } = useEntries();

  const { state: undoState, setState: setUndoState, pushHistory, undo, redo, canUndo, canRedo } = useUndoRedo<EntriesMap>({});

  // Sync entries into undo state
  useEffect(() => {
    setUndoState(entries);
  }, [entries, setUndoState]);

  // When undo/redo changes state, push back to entries
  useEffect(() => {
    if (undoState !== entries) {
      setEntries(undoState);
    }
  }, [undoState]);

  // Load entries when date changes (month range for spreadsheet)
  useEffect(() => {
    const d = new Date(date);
    const start = format(startOfMonth(d), 'yyyy-MM-dd');
    const end = format(endOfMonth(d), 'yyyy-MM-dd');
    loadEntries(start, end);
  }, [date, loadEntries]);

  const handleCellChange = useCallback((dateStr: string, metricId: string, value: string) => {
    updateCell(dateStr, metricId, value);
  }, [updateCell]);

  const handleSaveDay = useCallback((dateStr: string) => {
    const dayEntries = entries[dateStr] || {};
    saveDay(dateStr, dayEntries);
  }, [entries, saveDay]);

  const handleAddHabit = useCallback(async (data: MetricCreate) => {
    await createMetric(data);
  }, [createMetric]);

  const handleReorderMetrics = useCallback((fromIndex: number, toIndex: number) => {
    const reordered = [...metrics];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    reorderMetrics(reordered.map((m) => m.id));
  }, [metrics, reorderMetrics]);

  const handleRenameMetric = useCallback((metricId: string, newName: string) => {
    updateMetric(metricId, { name: newName });
  }, [updateMetric]);

  const handleFormChange = useCallback((metricId: string, value: string) => {
    handleCellChange(date, metricId, value);
    handleSaveDay(date);
  }, [date, handleCellChange, handleSaveDay]);

  const dayEntries = useMemo(() => entries[date] || {}, [entries, date]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <DateNavigation date={date} viewMode={viewMode} onChange={setDate} />
        <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
      </div>

      {viewMode === 'form' ? (
        <FormView
          date={date}
          metrics={metrics}
          entries={dayEntries}
          onChange={handleFormChange}
        />
      ) : (
        <SpreadsheetView
          date={date}
          metrics={metrics}
          entries={entries}
          onCellChange={handleCellChange}
          onSaveDay={handleSaveDay}
          onAddHabit={handleAddHabit}
          onReorderMetrics={handleReorderMetrics}
          onRenameMetric={handleRenameMetric}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={undo}
          onRedo={redo}
          onPushHistory={pushHistory}
        />
      )}
    </div>
  );
}
