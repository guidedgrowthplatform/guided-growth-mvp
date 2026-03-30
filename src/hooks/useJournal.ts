import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import type { JournalEntry } from '@/lib/services/data-service.interface';
import { getDataService } from '@/lib/services/service-provider';

const JOURNAL_KEYS = {
  all: ['journal'] as const,
  range: (start: string, end: string) => ['journal', start, end] as const,
};

async function fetchJournalEntries(startDate?: string, endDate?: string): Promise<JournalEntry[]> {
  const ds = await getDataService();
  return ds.getJournalEntries(startDate, endDate);
}

async function createEntry(
  content: string,
  mood?: string,
  themes?: string[],
): Promise<JournalEntry> {
  const ds = await getDataService();
  return ds.createJournalEntry(content, mood, themes);
}

export function useJournal(startDate?: string, endDate?: string) {
  const qc = useQueryClient();

  const {
    data: entries = [],
    isLoading,
    error: queryError,
  } = useQuery({
    queryKey: startDate && endDate ? JOURNAL_KEYS.range(startDate, endDate) : JOURNAL_KEYS.all,
    queryFn: () => fetchJournalEntries(startDate, endDate),
  });

  const error = queryError ? (queryError as Error).message : null;

  const mutation = useMutation({
    mutationFn: (params: { content: string; mood?: string; themes?: string[] }) =>
      createEntry(params.content, params.mood, params.themes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: JOURNAL_KEYS.all });
    },
  });

  const save = useCallback(
    async (content: string, mood?: string, themes?: string[]) => {
      return mutation.mutateAsync({ content, mood, themes });
    },
    [mutation],
  );

  return {
    entries,
    isLoading,
    error,
    saving: mutation.isPending,
    save,
  };
}
