import { format, startOfMonth, endOfMonth, addMonths, subMonths, addDays, subDays } from 'date-fns';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useEntries } from '@/hooks/useEntries';
import { useMetrics } from '@/hooks/useMetrics';
import { usePreferences } from '@/hooks/usePreferences';
import { useUndoRedo } from '@/hooks/useUndoRedo';
import { getWeekRange } from '@/utils/dates';
import type { ViewMode, SpreadsheetRange, MetricCreate, EntriesMap } from '@shared/types';
import { DateNavigation } from './DateNavigation';
import { FormView } from './FormView';
import { SpreadsheetRangeToggle } from './SpreadsheetRangeToggle';
import { SpreadsheetView } from './SpreadsheetView';
import { ViewModeToggle } from './ViewModeToggle';

export function CaptureView() {
  const {
    defaultView,
    spreadsheetRange: savedRange,
    loaded: prefsLoaded,
    saveView,
    saveRange,
  } = usePreferences();

  const isMobile = window.innerWidth < 768;
  const viewMode = defaultView;
  const spreadsheetRange = isMobile ? 'week' : savedRange;
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const handleViewModeChange = useCallback(
    (mode: ViewMode) => {
      saveView(mode);
    },
    [saveView],
  );

  const handleRangeChange = useCallback(
    (range: SpreadsheetRange) => {
      saveRange(range);
    },
    [saveRange],
  );

  const {
    activeMetrics: metrics,
    create: createMetric,
    reorder: reorderMetrics,
    update: updateMetric,
  } = useMetrics();
  const { entries, load: loadEntries, updateCell, saveDay, setEntries } = useEntries();

  const {
    state: undoState,
    setState: setUndoState,
    pushHistory,
    undo: undoRaw,
    redo: redoRaw,
    canUndo,
    canRedo,
  } = useUndoRedo<EntriesMap>({});
  const undoAppliedRef = useRef(false);

  // Keep undo state in sync when entries change from data layer (load, voice commands, etc.)
  // Only sync when it's NOT an undo/redo operation pushing back
  useEffect(() => {
    if (undoAppliedRef.current) {
      undoAppliedRef.current = false;
      return;
    }
    setUndoState(entries);
  }, [entries, setUndoState]);

  // When undo/redo changes state, apply it back to entries
  const undo = useCallback(() => {
    undoAppliedRef.current = true;
    undoRaw();
  }, [undoRaw]);

  const redo = useCallback(() => {
    undoAppliedRef.current = true;
    redoRaw();
  }, [redoRaw]);

  // Apply undo/redo result back to entries
  useEffect(() => {
    if (undoAppliedRef.current) {
      setEntries(undoState);
    }
  }, [undoState, setEntries]);

  // Load entries when date or range changes — wait for prefs first to avoid double-fetch
  useEffect(() => {
    if (!prefsLoaded) return;
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
  }, [prefsLoaded, date, spreadsheetRange, viewMode, loadEntries]);

  const handleCellChange = useCallback(
    (dateStr: string, metricId: string, value: string) => {
      updateCell(dateStr, metricId, value);
    },
    [updateCell],
  );

  // Accept optional pending cell change to merge before saving (avoids stale setState race)
  const handleSaveDay = useCallback(
    (dateStr: string, pendingMetricId?: string, pendingValue?: string) => {
      const dayEntries = { ...(entries[dateStr] || {}) };
      // Merge pending change that hasn't flushed to state yet
      if (pendingMetricId !== undefined) {
        if (pendingValue === '' || pendingValue === null || pendingValue === undefined) {
          delete dayEntries[pendingMetricId];
        } else {
          dayEntries[pendingMetricId] = pendingValue;
        }
      }
      saveDay(dateStr, dayEntries);
    },
    [entries, saveDay],
  );

  const handleAddHabit = useCallback(
    async (data: MetricCreate) => {
      await createMetric(data);
    },
    [createMetric],
  );

  const handleReorderMetrics = useCallback(
    (fromIndex: number, toIndex: number) => {
      const reordered = [...metrics];
      const [moved] = reordered.splice(fromIndex, 1);
      reordered.splice(toIndex, 0, moved);
      reorderMetrics(reordered.map((m) => m.id));
    },
    [metrics, reorderMetrics],
  );

  const handleRenameMetric = useCallback(
    (metricId: string, newName: string) => {
      updateMetric(metricId, { name: newName });
    },
    [updateMetric],
  );

  const handleFormChange = useCallback(
    (metricId: string, value: string) => {
      handleCellChange(date, metricId, value);
      handleSaveDay(date);
    },
    [date, handleCellChange, handleSaveDay],
  );

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
      <div className="mb-4 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <DateNavigation
          date={date}
          viewMode={viewMode}
          spreadsheetRange={spreadsheetRange}
          onChange={setDate}
        />
        <div className="flex items-center gap-2">
          {viewMode === 'spreadsheet' && (
            <div className="hidden sm:block">
              <SpreadsheetRangeToggle range={spreadsheetRange} onChange={handleRangeChange} />
            </div>
          )}
          <ViewModeToggle viewMode={viewMode} onChange={handleViewModeChange} />
        </div>
      </div>

      {viewMode === 'form' ? (
        <FormView date={date} metrics={metrics} entries={dayEntries} onChange={handleFormChange} />
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
