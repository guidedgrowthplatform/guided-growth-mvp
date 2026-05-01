import { Icon } from '@iconify/react';
import { format, parseISO, subMonths } from 'date-fns';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { deleteJournalEntry, fetchJournalEntries } from '@/api/journal';
import { ReflectionListCard } from '@/components/reflections/ReflectionListCard';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { useToast } from '@/contexts/ToastContext';
import type { JournalEntry } from '@shared/types';

const FETCH_MONTHS = 6;

export function ReflectionsListPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [entries, setEntries] = useState<JournalEntry[] | null>(null);
  const [error, setError] = useState(false);
  const [menuEntry, setMenuEntry] = useState<JournalEntry | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const today = new Date();
    const start = format(subMonths(today, FETCH_MONTHS), 'yyyy-MM-dd');
    const end = format(today, 'yyyy-MM-dd');
    fetchJournalEntries(start, end)
      .then((rows) => {
        if (cancelled) return;
        const sorted = [...rows].sort(
          (a, b) => parseISO(b.created_at).getTime() - parseISO(a.created_at).getTime(),
        );
        setEntries(sorted);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDelete = useCallback(async () => {
    if (!menuEntry) return;
    if (!window.confirm('Delete this reflection? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await deleteJournalEntry(menuEntry.id);
      setEntries((prev) => prev?.filter((e) => e.id !== menuEntry.id) ?? null);
      addToast('success', 'Reflection deleted');
      setMenuEntry(null);
    } catch {
      addToast('error', 'Failed to delete — please try again');
    } finally {
      setDeleting(false);
    }
  }, [menuEntry, addToast]);

  const handleEdit = useCallback(() => {
    if (!menuEntry) return;
    const id = menuEntry.id;
    setMenuEntry(null);
    navigate(`/reflections/${id}/edit`);
  }, [menuEntry, navigate]);

  return (
    <div className="min-h-dvh bg-primary-bg">
      <div className="sticky top-0 z-10 flex items-center bg-primary-bg px-6 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Go back"
          className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-content hover:bg-surface-secondary active:bg-surface-secondary"
        >
          <Icon icon="mdi:arrow-left" width={24} height={24} />
        </button>
        <h1 className="flex-1 text-center text-base font-semibold text-content">Reflections</h1>
        <div className="h-10 w-10" aria-hidden />
      </div>

      <div
        className="px-6 pt-2"
        style={{ paddingBottom: 'calc(200px + env(safe-area-inset-bottom))' }}
      >
        <h2 className="text-2xl font-bold text-content">Recent Reflections</h2>
        <p className="mt-1 text-sm text-content-secondary">
          Scroll through your thoughts and milestones.
        </p>

        <div className="mt-6 flex flex-col gap-4">
          {error && (
            <div className="rounded-2xl bg-surface px-4 py-6 text-center text-sm text-content-secondary">
              Couldn&apos;t load reflections. Pull down to retry.
            </div>
          )}
          {!error && entries === null && (
            <>
              <div className="h-28 animate-pulse rounded-2xl bg-surface" />
              <div className="h-28 animate-pulse rounded-2xl bg-surface" />
              <div className="h-28 animate-pulse rounded-2xl bg-surface" />
            </>
          )}
          {!error && entries && entries.length === 0 && (
            <div className="flex flex-col items-center gap-3 rounded-2xl bg-surface px-6 py-10 text-center">
              <Icon
                icon="mdi:notebook-outline"
                width={32}
                height={32}
                className="text-content-tertiary"
              />
              <p className="text-sm font-medium text-content">No reflections yet</p>
              <p className="text-xs text-content-secondary">
                Start a reflection from the home screen.
              </p>
              <button
                type="button"
                onClick={() => navigate('/journal')}
                className="mt-1 rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white"
              >
                Start one
              </button>
            </div>
          )}
          {!error &&
            entries &&
            entries.map((entry) => (
              <ReflectionListCard key={entry.id} entry={entry} onMenuOpen={setMenuEntry} />
            ))}
        </div>
      </div>

      {menuEntry && (
        <BottomSheet onClose={() => setMenuEntry(null)}>
          <div className="px-6 pb-8 pt-2">
            <button
              type="button"
              onClick={handleEdit}
              className="flex w-full items-center gap-4 rounded-xl px-4 py-4 text-left text-base font-medium text-content hover:bg-surface-secondary"
            >
              <Icon icon="mdi:pencil-outline" width={22} height={22} className="text-content" />
              Edit
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="flex w-full items-center gap-4 rounded-xl px-4 py-4 text-left text-base font-medium text-danger hover:bg-danger/5 disabled:opacity-50"
            >
              <Icon icon="mdi:trash-can-outline" width={22} height={22} />
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </BottomSheet>
      )}
    </div>
  );
}
