import { useQuery } from '@tanstack/react-query';
import { fetchRecentJournalEntries } from '@/api/journal';
import type { JournalEntry } from '@shared/types';

export const REFLECTIONS_KEYS = {
  all: ['reflections'] as const,
  list: (limit: number, page: number) => ['reflections', 'list', limit, page] as const,
};

interface UseReflectionsOptions {
  limit?: number;
  page?: number;
  enabled?: boolean;
}

export function useReflections({
  limit = 20,
  page = 0,
  enabled = true,
}: UseReflectionsOptions = {}) {
  const query = useQuery<JournalEntry[]>({
    queryKey: REFLECTIONS_KEYS.list(limit, page),
    queryFn: () => fetchRecentJournalEntries({ limit, page }),
    enabled,
    staleTime: 30_000,
  });

  return {
    entries: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error ? (query.error as Error).message : null,
    refetch: query.refetch,
  };
}
