import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { track } from '@/analytics';
import { deleteJournalEntry, fetchRecentJournalEntries } from '@/api/journal';
import { ReflectionListCard, ReflectionsTopBar } from '@/components/reflections';
import { useToast } from '@/contexts/ToastContext';
import type { JournalEntry } from '@shared/types';

const PAGE_SIZE = 20;

export function ReflectionsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  const query = useInfiniteQuery({
    queryKey: ['reflections', 'feed'],
    queryFn: ({ pageParam = 0 }: { pageParam?: number }) =>
      fetchRecentJournalEntries({ limit: PAGE_SIZE, page: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length < PAGE_SIZE ? undefined : allPages.length,
    staleTime: 30_000,
  });

  const entries = query.data?.pages.flat() ?? [];

  useEffect(() => {
    track('reflection_list_opened');
  }, []);

  const handleDelete = useCallback(
    async (entry: JournalEntry) => {
      try {
        await deleteJournalEntry(entry.id);
        queryClient.invalidateQueries({ queryKey: ['reflections'] });
        addToast('success', 'Reflection deleted');
      } catch {
        addToast('error', 'Failed to delete — please try again');
      }
    },
    [queryClient, addToast],
  );

  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && query.hasNextPage && !query.isFetchingNextPage) {
          query.fetchNextPage();
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [query]);

  return (
    <div>
      <ReflectionsTopBar title="Reflections" />
      <div className="flex flex-col gap-2 pt-4">
        <h2 className="text-[30px] font-semibold leading-tight tracking-tight text-content">
          Recent Reflections
        </h2>
        <p className="text-base text-content-secondary">
          Scroll through your thoughts and milestones.
        </p>
      </div>

      <div className="flex flex-col gap-6 pt-6">
        {query.isLoading ? (
          <ListSkeleton count={5} />
        ) : entries.length === 0 ? (
          <EmptyState onStart={() => navigate('/journal')} />
        ) : (
          <>
            {entries.map((entry) => (
              <ReflectionListCard key={entry.id} entry={entry} onDelete={handleDelete} />
            ))}
            <div ref={sentinelRef} className="h-8" />
            {query.isFetchingNextPage && <ListSkeleton count={2} />}
          </>
        )}
      </div>
    </div>
  );
}

function ListSkeleton({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="relative flex flex-col gap-4 overflow-hidden rounded-[32px] bg-surface-secondary p-6"
        >
          <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent bg-[length:200%_100%]" />
          <div className="bg-surface-raised relative h-3 w-1/3 rounded" />
          <div className="bg-surface-raised relative h-5 w-1/4 rounded" />
          <div className="bg-surface-raised relative h-4 w-full rounded" />
          <div className="bg-surface-raised relative h-4 w-5/6 rounded" />
        </div>
      ))}
    </>
  );
}

function EmptyState({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl bg-surface-secondary px-6 py-10 text-center">
      <p className="text-base font-semibold text-content">No reflections yet</p>
      <p className="text-sm text-content-secondary">
        Capture a quick journal entry and it'll show up here.
      </p>
      <button
        type="button"
        onClick={onStart}
        className="mt-2 rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white"
      >
        Start your first reflection
      </button>
    </div>
  );
}
