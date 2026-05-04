import { useQuery } from '@tanstack/react-query';
import { format, parseISO, subDays } from 'date-fns';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchJournalEntries } from '@/api/journal';
import {
  formatHomeLabel,
  previewText,
  truncate,
} from '@/components/reflections/reflectionFormatters';
import { queryKeys } from '@/lib/query';
import type { JournalEntry } from '@shared/types';
import { SectionHeader } from './SectionHeader';

const HOME_PREVIEW_MAX = 90;
const RECENT_LIMIT = 3;

function selectRecentEntries(rows: JournalEntry[]): JournalEntry[] {
  return [...rows]
    .sort((a, b) => parseISO(b.created_at).getTime() - parseISO(a.created_at).getTime())
    .slice(0, RECENT_LIMIT);
}

export function RecentReflectionsSection() {
  const navigate = useNavigate();

  const { start, end } = useMemo(() => {
    const today = new Date();
    return {
      start: format(subDays(today, 30), 'yyyy-MM-dd'),
      end: format(today, 'yyyy-MM-dd'),
    };
  }, []);

  const {
    data: entries,
    isPending,
    isError,
  } = useQuery({
    queryKey: queryKeys.journal.range(start, end),
    queryFn: () => fetchJournalEntries(start, end),
    select: selectRecentEntries,
  });

  if (isError) return null;
  if (entries && entries.length === 0) return null;

  return (
    <div>
      <SectionHeader
        title="Recent Reflections"
        actionLabel="See all"
        onAction={() => navigate('/reflections')}
      />
      {isPending || !entries ? (
        <div className="flex flex-col gap-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-surface" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {entries.map((entry) => (
            <article
              key={entry.id}
              onClick={() => navigate(`/reflections/${entry.id}`)}
              className="cursor-pointer rounded-2xl bg-surface px-4 py-3 active:bg-surface-secondary"
              aria-label={`Reflection from ${formatHomeLabel(entry.created_at)}`}
            >
              <p className="text-xs font-medium text-content-secondary">
                {formatHomeLabel(entry.created_at)}
              </p>
              <p className="mt-1 text-sm font-medium text-content">
                {truncate(previewText(entry), HOME_PREVIEW_MAX)}
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
