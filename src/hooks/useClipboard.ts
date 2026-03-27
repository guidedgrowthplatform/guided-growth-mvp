import { useCallback, useRef } from 'react';
import type { EntriesMap } from '@shared/types';

export function useClipboard(
  entries: EntriesMap,
  onCellChange: (date: string, metricId: string, value: string) => void,
  onPushHistory: () => void,
) {
  const bufferRef = useRef<string>('');

  const copy = useCallback(
    (date: string, metricId: string) => {
      const value = entries[date]?.[metricId] || '';
      bufferRef.current = value;
      navigator.clipboard?.writeText(value).catch(() => {});
    },
    [entries],
  );

  const paste = useCallback(
    async (date: string, metricId: string) => {
      onPushHistory();
      let value = bufferRef.current;
      try {
        const text = await navigator.clipboard.readText();
        if (text) value = text;
      } catch {
        // Use internal buffer
      }
      onCellChange(date, metricId, value);
    },
    [onCellChange, onPushHistory],
  );

  return { copy, paste };
}
