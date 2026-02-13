import { useState, useCallback, useRef, useEffect } from 'react';
import type { EntriesMap, DayEntries } from '@shared/types';
import * as entriesApi from '@/api/entries';
import { useToast } from '@/contexts/ToastContext';
import { offlineQueue } from '@/cache/offlineQueue';

export function useEntries() {
  const { addToast } = useToast();
  const [entries, setEntries] = useState<EntriesMap>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const load = useCallback(async (start: string, end: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await entriesApi.fetchEntries(start, end);
      setEntries(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
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
      setError(err.message);
      // Queue for offline retry
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
    // Try flushing on mount
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
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  return { entries, loading, error, load, updateLocal, updateCell, saveDay, saveDayDebounced, saveBulk, setEntries };
}
