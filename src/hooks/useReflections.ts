import { useState, useCallback, useEffect } from 'react';
import type { ReflectionConfig, DayReflections } from '@shared/types';
import * as reflApi from '@/api/reflections';

export function useReflections() {
  const [config, setConfig] = useState<ReflectionConfig | null>(null);
  const [reflections, setReflections] = useState<Record<string, DayReflections>>({});
  const [affirmation, setAffirmation] = useState('');
  const [loading, setLoading] = useState(true);

  const loadConfig = useCallback(async () => {
    try {
      const c = await reflApi.fetchReflectionConfig();
      setConfig(c);
    } catch {
      // Use default
    }
  }, []);

  const loadReflections = useCallback(async (start: string, end: string) => {
    try {
      const data = await reflApi.fetchReflections(start, end);
      setReflections(data);
    } catch {
      // Ignore
    }
  }, []);

  const loadAffirmation = useCallback(async () => {
    try {
      const value = await reflApi.fetchAffirmation();
      setAffirmation(value);
    } catch {
      // Ignore
    }
  }, []);

  const initialize = useCallback(async (start: string, end: string) => {
    setLoading(true);
    await Promise.all([loadConfig(), loadReflections(start, end), loadAffirmation()]);
    setLoading(false);
  }, [loadConfig, loadReflections, loadAffirmation]);

  const saveConfig = useCallback(async (newConfig: ReflectionConfig) => {
    setConfig(newConfig);
    await reflApi.saveReflectionConfig(newConfig);
  }, []);

  const saveDay = useCallback(async (date: string, data: DayReflections) => {
    setReflections((prev) => ({ ...prev, [date]: data }));
    await reflApi.saveReflections(date, data);
  }, []);

  const saveAffirmationValue = useCallback(async (value: string) => {
    setAffirmation(value);
    await reflApi.saveAffirmation(value);
  }, []);

  return {
    config, reflections, affirmation, loading,
    initialize, loadConfig, loadReflections, loadAffirmation,
    saveConfig, saveDay, saveAffirmationValue,
  };
}
