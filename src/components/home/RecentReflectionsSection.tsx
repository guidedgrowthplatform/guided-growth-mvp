import { format, parseISO, subDays } from 'date-fns';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchJournalEntries } from '@/api/journal';
import {
  formatHomeLabel,
  previewText,
  truncate,
} from '@/components/reflections/reflectionFormatters';
import type { JournalEntry } from '@shared/types';
import { SectionHeader } from './SectionHeader';

const HOME_PREVIEW_MAX = 90;

export function RecentReflectionsSection() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<JournalEntry[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const today = new Date();
    const start = format(subDays(today, 30), 'yyyy-MM-dd');
    const end = format(today, 'yyyy-MM-dd');
    fetchJournalEntries(start, end)
      .then((rows) => {
        if (cancelled) return;
        const sorted = [...rows].sort(
          (a, b) => parseISO(b.created_at).getTime() - parseISO(a.created_at).getTime(),
        );
        setEntries(sorted.slice(0, 3));
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return null;
  if (entries && entries.length === 0) return null;

  return (
    <div>
      <SectionHeader
        title="Recent Reflections"
        actionLabel="See all"
        onAction={() => navigate('/reflections')}
      />
      {entries === null ? (
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
