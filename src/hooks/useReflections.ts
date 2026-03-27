import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import * as reflApi from '@/api/reflections';
import { queryKeys } from '@/lib/query';
import type { ReflectionConfig, DayReflections } from '@shared/types';

export function useReflections(start?: string, end?: string) {
  const qc = useQueryClient();
  const hasRange = !!start && !!end;

  const configQuery = useQuery({
    queryKey: queryKeys.reflections.config,
    queryFn: reflApi.fetchReflectionConfig,
  });

  const rangeKey = hasRange
    ? queryKeys.reflections.range(start, end)
    : queryKeys.reflections.range('', '');

  const reflectionsQuery = useQuery({
    queryKey: rangeKey,
    queryFn: () => reflApi.fetchReflections(start!, end!),
    enabled: hasRange,
  });

  const affirmationQuery = useQuery({
    queryKey: queryKeys.reflections.affirmation,
    queryFn: reflApi.fetchAffirmation,
  });

  const loading = configQuery.isLoading || reflectionsQuery.isLoading || affirmationQuery.isLoading;

  const config = configQuery.data ?? null;
  const reflections = reflectionsQuery.data ?? {};
  const affirmation = affirmationQuery.data ?? '';

  const saveConfigMutation = useMutation({
    mutationFn: (newConfig: ReflectionConfig) => reflApi.saveReflectionConfig(newConfig),
    onMutate: (newConfig) => {
      qc.setQueryData(queryKeys.reflections.config, newConfig);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.reflections.config });
    },
  });

  const saveDayMutation = useMutation({
    mutationFn: ({ date, data }: { date: string; data: DayReflections }) =>
      reflApi.saveReflections(date, data),
    onMutate: ({ date, data }) => {
      if (hasRange) {
        qc.setQueryData(rangeKey, (old: Record<string, DayReflections> | undefined) => ({
          ...old,
          [date]: data,
        }));
      }
    },
  });

  const saveAffirmationMutation = useMutation({
    mutationFn: (value: string) => reflApi.saveAffirmation(value),
    onMutate: (value) => {
      qc.setQueryData(queryKeys.reflections.affirmation, value);
    },
  });

  const saveConfig = useCallback(
    async (newConfig: ReflectionConfig) => {
      await saveConfigMutation.mutateAsync(newConfig);
    },
    [saveConfigMutation],
  );

  const saveDay = useCallback(
    async (date: string, data: DayReflections) => {
      await saveDayMutation.mutateAsync({ date, data });
    },
    [saveDayMutation],
  );

  const saveAffirmationValue = useCallback(
    async (value: string) => {
      await saveAffirmationMutation.mutateAsync(value);
    },
    [saveAffirmationMutation],
  );

  return {
    config,
    reflections,
    affirmation,
    loading,
    saveConfig,
    saveDay,
    saveAffirmationValue,
  };
}
