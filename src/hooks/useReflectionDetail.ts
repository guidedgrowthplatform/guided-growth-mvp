import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { fetchJournalEntry, generateJournalInsight } from '@/api/journal';
import type { JournalEntry } from '@shared/types';

export const REFLECTION_DETAIL_KEYS = {
  entry: (id: string) => ['reflections', 'detail', id] as const,
};

export function useReflectionDetail(id: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery<JournalEntry>({
    queryKey: REFLECTION_DETAIL_KEYS.entry(id ?? ''),
    queryFn: () => fetchJournalEntry(id!),
    enabled: !!id,
    staleTime: 30_000,
  });

  const insightMutation = useMutation({
    mutationFn: (entryId: string) => generateJournalInsight(entryId),
    onSuccess: (result, entryId) => {
      if (!result?.ai_insight) return;
      queryClient.setQueryData<JournalEntry | undefined>(
        REFLECTION_DETAIL_KEYS.entry(entryId),
        (prev) =>
          prev
            ? {
                ...prev,
                ai_insight: result.ai_insight,
                ai_insight_generated_at: new Date().toISOString(),
              }
            : prev,
      );
    },
  });

  const backfillFiredRef = useRef<string | null>(null);
  useEffect(() => {
    const entry = query.data;
    if (!entry || !id) return;
    if (entry.ai_insight) return;
    if (backfillFiredRef.current === id) return;
    if (!navigator.onLine) return;
    backfillFiredRef.current = id;
    insightMutation.mutate(id);
  }, [query.data, id, insightMutation]);

  return {
    entry: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    insightLoading: insightMutation.isPending,
    refetch: query.refetch,
  };
}
