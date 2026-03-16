import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { EntriesMap, DayEntries } from '@shared/types';
import * as entriesApi from '@/api/entries';
import { useToast } from '@/contexts/ToastContext';
import { offlineQueue } from '@/cache/offlineQueue';
import { queryKeys } from '@/lib/query';

export function useEntries() {
  const { addToast } = useToast();
  const [entries, setEntries] = useState<EntriesMap>({});
  const [range, setRange] = useState<{ start: string; end: string } | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const query = useQuery({
    queryKey: queryKeys.entries.range(range?.start ?? '', range?.end ?? ''),
    queryFn: () => entriesApi.fetchEntries(range!.start, range!.end),
    enabled: !!range,
  });

  // Sync query data into local state reactively via query.data
  useEffect(() => {
    if (query.data) setEntries(query.data);
  }, [query.data]);

  const loading = query.isLoading;
  const error = query.error ? (query.error as Error).message : null;

  const load = useCallback((start: string, end: string) => {
    setRange({ start, end });
  }, []);

  const updateLocal = useCallback((date: string, dayEntries: DayEntries) => {
    setEntries((prev) => ({ ...prev, [date]: dayEntries }));
  }, []);

  const updateCell = useCallback((date: string, metricId: string, value: string) => {
    setEntries((prev) => {
      const dayEntries = { ...prev[date] };
      if (value === '' || value === null || value === undefined) {
        delete dayEntries[metricId];
      } else {
        dayEntries[metricId] = value;
      }
      return { ...prev, [date]: dayEntries };
    });
  }, []);

  const saveDay = useCallback(async (date: string, dayEntries: DayEntries) => {
    try {
      await entriesApi.saveEntries(date, dayEntries);
    } catch (err: any) {
      offlineQueue.enqueue(`/api/entries/${date}`, 'PUT', dayEntries);
      addToast('error', 'Saved offline — will sync when back online');
    }
  }, [addToast]);

  // Flush offline queue when online
  useEffect(() => {
    const handleOnline = () => {
      if (offlineQueue.length > 0) {
        offlineQueue.flush().then(() => {
          if (offlineQueue.length === 0) addToast('success', 'Offline entries synced');
        });
      }
    };
    window.addEventListener('online', handleOnline);
    handleOnline();
    return () => window.removeEventListener('online', handleOnline);
  }, [addToast]);

  const saveDayDebounced = useCallback((date: string, dayEntries: DayEntries) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveDay(date, dayEntries), 500);
  }, [saveDay]);

  const saveBulk = useCallback(async (entriesMap: EntriesMap) => {
    try {
      await entriesApi.saveBulkEntries(entriesMap);
    } catch {
      // ignore
    }
  }, []);

  return { entries, loading, error, load, updateLocal, updateCell, saveDay, saveDayDebounced, saveBulk, setEntries };
}
