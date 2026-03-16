import { useState, useCallback } from 'react';

export interface CellPosition {
  date: string;
  metricId: string;
}

export function useCellSelection() {
  const [selectedCell, setSelectedCell] = useState<CellPosition | null>(null);

  const selectCell = useCallback((date: string, metricId: string) => {
    setSelectedCell({ date, metricId });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedCell(null);
  }, []);

  const isCellSelected = useCallback(
    (date: string, metricId: string) => {
      return selectedCell?.date === date && selectedCell?.metricId === metricId;
    },
    [selectedCell],
  );

  return { selectedCell, selectCell, clearSelection, isCellSelected };
}
