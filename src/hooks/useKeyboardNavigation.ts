import { useEffect, useCallback } from 'react';
import type { Metric } from '@shared/types';

interface UseKeyboardNavigationOptions {
  selectedCell: { date: string; metricId: string } | null;
  editingCell: { date: string; metricId: string } | null;
  dateStrings: string[];
  metrics: Metric[];
  onSelectCell: (date: string, metricId: string) => void;
  onStartEdit: (date: string, metricId: string) => void;
  onDelete: (date: string, metricId: string) => void;
  onCopy: (date: string, metricId: string) => void;
  onPaste: (date: string, metricId: string) => void;
  onUndo: () => void;
  onRedo: () => void;
}

export function useKeyboardNavigation({
  selectedCell, editingCell, dateStrings, metrics,
  onSelectCell, onStartEdit, onDelete, onCopy, onPaste,
  onUndo, onRedo,
}: UseKeyboardNavigationOptions) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (editingCell) return;
    if (!selectedCell) return;

    const { date, metricId } = selectedCell;
    const dateIdx = dateStrings.indexOf(date);
    const metricIdx = metrics.findIndex((m) => m.id === metricId);
    if (dateIdx === -1 || metricIdx === -1) return;

    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); onUndo(); return; }
      if (e.key === 'z' && e.shiftKey) { e.preventDefault(); onRedo(); return; }
      if (e.key === 'y') { e.preventDefault(); onRedo(); return; }
      if (e.key === 'c') { e.preventDefault(); onCopy(date, metricId); return; }
      if (e.key === 'v') { e.preventDefault(); onPaste(date, metricId); return; }
      return;
    }

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        if (metricIdx > 0) onSelectCell(date, metrics[metricIdx - 1].id);
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (metricIdx < metrics.length - 1) onSelectCell(date, metrics[metricIdx + 1].id);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (dateIdx > 0) onSelectCell(dateStrings[dateIdx - 1], metricId);
        break;
      case 'ArrowRight':
      case 'Tab':
        e.preventDefault();
        if (dateIdx < dateStrings.length - 1) onSelectCell(dateStrings[dateIdx + 1], metricId);
        break;
      case 'Enter':
      case 'F2':
        e.preventDefault();
        onStartEdit(date, metricId);
        break;
      case 'Delete':
      case 'Backspace':
        e.preventDefault();
        onDelete(date, metricId);
        break;
      case 'Escape':
        e.preventDefault();
        onSelectCell('', '');
        break;
    }
  }, [selectedCell, editingCell, dateStrings, metrics, onSelectCell, onStartEdit, onDelete, onCopy, onPaste, onUndo, onRedo]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
