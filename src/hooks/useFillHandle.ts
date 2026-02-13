import { useCallback } from 'react';
import type { EntriesMap } from '@shared/types';

export function useFillHandle(
  entries: EntriesMap,
  onCellChange: (date: string, metricId: string, value: string) => void,
  onPushHistory: () => void,
) {
  const startFill = useCallback((e: React.MouseEvent, sourceDate: string, sourceMetricId: string) => {
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

  return { startFill };
}
