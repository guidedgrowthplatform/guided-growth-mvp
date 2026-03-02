import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { format, startOfMonth, endOfMonth, addMonths, subMonths, addDays, subDays } from 'date-fns';
import type { ViewMode, SpreadsheetRange, MetricCreate, EntriesMap } from '@shared/types';
import { getWeekRange } from '@/utils/dates';
import { useMetrics } from '@/hooks/useMetrics';
import { useEntries } from '@/hooks/useEntries';
import { useUndoRedo } from '@/hooks/useUndoRedo';
import { usePreferences } from '@/hooks/usePreferences';
import { ViewModeToggle } from './ViewModeToggle';
import { SpreadsheetRangeToggle } from './SpreadsheetRangeToggle';
import { DateNavigation } from './DateNavigation';
import { FormView } from './FormView';
import { SpreadsheetView } from './SpreadsheetView';

export function CaptureView() {
  const { defaultView, spreadsheetRange: savedRange, loaded: prefsLoaded, saveView, saveRange } = usePreferences();

  const [viewMode, setViewMode] = useState<ViewMode>('spreadsheet');
  const [spreadsheetRange, setSpreadsheetRange] = useState<SpreadsheetRange>(
    window.innerWidth < 768 ? 'week' : 'month'
  );
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Initialize from saved preferences once loaded
  useEffect(() => {
    if (prefsLoaded) {
      setViewMode(defaultView);
      setSpreadsheetRange(savedRange);
    }
  }, [prefsLoaded, defaultView, savedRange]);

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    saveView(mode);
  }, [saveView]);

  const handleRangeChange = useCallback((range: SpreadsheetRange) => {
    setSpreadsheetRange(range);
    saveRange(range);
  }, [saveRange]);

  const { activeMetrics: metrics, create: createMetric, reorder: reorderMetrics, update: updateMetric } = useMetrics();
  const { entries, load: loadEntries, updateCell, saveDay, setEntries } = useEntries();

  const { state: undoState, setState: setUndoState, pushHistory, undo, redo, canUndo, canRedo } = useUndoRedo<EntriesMap>({});
  const syncingRef = useRef(false);

  // Sync entries into undo state (from data layer → undo stack)
  useEffect(() => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setUndoState(entries);
    syncingRef.current = false;
  }, [entries, setUndoState]);

  // When undo/redo changes state, push back to entries (from undo stack → data layer)
  useEffect(() => {
    if (syncingRef.current) return;
    if (undoState !== entries) {
      syncingRef.current = true;
      setEntries(undoState);
      syncingRef.current = false;
    }
  }, [undoState]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load entries when date or range changes
  useEffect(() => {
    const d = new Date(date);
    let start: string;
    let end: string;
    if (viewMode === 'spreadsheet' && spreadsheetRange === 'week') {
      const range = getWeekRange(d);
      start = format(range.start, 'yyyy-MM-dd');
      end = format(range.end, 'yyyy-MM-dd');
    } else {
      start = format(startOfMonth(d), 'yyyy-MM-dd');
      end = format(endOfMonth(d), 'yyyy-MM-dd');
    }
    loadEntries(start, end);
  }, [date, spreadsheetRange, viewMode, loadEntries]);

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

  // Keyboard shortcuts: Alt+Left/Right (navigate), Alt+T (today), Alt+W/M (week/month)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      const d = new Date(date);
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          if (viewMode === 'form') setDate(format(subDays(d, 1), 'yyyy-MM-dd'));
          else if (spreadsheetRange === 'week') setDate(format(subDays(d, 7), 'yyyy-MM-dd'));
          else setDate(format(subMonths(d, 1), 'yyyy-MM-dd'));
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (viewMode === 'form') setDate(format(addDays(d, 1), 'yyyy-MM-dd'));
          else if (spreadsheetRange === 'week') setDate(format(addDays(d, 7), 'yyyy-MM-dd'));
          else setDate(format(addMonths(d, 1), 'yyyy-MM-dd'));
          break;
        case 't':
          e.preventDefault();
          setDate(format(new Date(), 'yyyy-MM-dd'));
          break;
        case 'w':
          e.preventDefault();
          if (viewMode === 'spreadsheet') handleRangeChange('week');
          break;
        case 'm':
          e.preventDefault();
          if (viewMode === 'spreadsheet') handleRangeChange('month');
          break;
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [date, viewMode, spreadsheetRange, handleRangeChange]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <DateNavigation date={date} viewMode={viewMode} spreadsheetRange={spreadsheetRange} onChange={setDate} />
        <div className="flex items-center gap-2">
          {viewMode === 'spreadsheet' && (
            <SpreadsheetRangeToggle range={spreadsheetRange} onChange={handleRangeChange} />
          )}
          <ViewModeToggle viewMode={viewMode} onChange={handleViewModeChange} />
        </div>
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
          spreadsheetRange={spreadsheetRange}
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
