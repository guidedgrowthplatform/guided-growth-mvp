import { Icon } from '@iconify/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO, subMonths } from 'date-fns';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { deleteJournalEntry, fetchJournalEntries } from '@/api/journal';
import { EditReflectionSheet } from '@/components/reflections/EditReflectionSheet';
import { ReflectionListCard } from '@/components/reflections/ReflectionListCard';
import { ConfirmDialog } from '@/components/settings/ConfirmDialog';
import { useToast } from '@/contexts/ToastContext';
import { queryKeys } from '@/lib/query';
import type { JournalEntry } from '@shared/types';

const FETCH_MONTHS = 6;

function sortEntries(rows: JournalEntry[]): JournalEntry[] {
  return [...rows].sort(
    (a, b) => parseISO(b.created_at).getTime() - parseISO(a.created_at).getTime(),
  );
}

export function ReflectionsListPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const qc = useQueryClient();

  const { start, end } = useMemo(() => {
    const today = new Date();
    return {
      start: format(subMonths(today, FETCH_MONTHS), 'yyyy-MM-dd'),
      end: format(today, 'yyyy-MM-dd'),
    };
  }, []);

  const queryKey = useMemo(() => queryKeys.journal.range(start, end), [start, end]);

  const {
    data: entries,
    isPending,
    isError,
  } = useQuery({
    queryKey,
    queryFn: () => fetchJournalEntries(start, end),
    select: sortEntries,
  });

  const [menuEntry, setMenuEntry] = useState<JournalEntry | null>(null);
  const [editEntry, setEditEntry] = useState<JournalEntry | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteJournalEntry(id),
    onSuccess: (_, id) => {
      qc.setQueryData<JournalEntry[]>(queryKey, (prev) =>
        prev ? prev.filter((e) => e.id !== id) : prev,
      );
      qc.invalidateQueries({ queryKey: queryKeys.journal.all });
      addToast('success', 'Reflection deleted');
      setConfirmDelete(false);
      setMenuEntry(null);
    },
    onError: () => addToast('error', 'Failed to delete — please try again'),
  });

  const handleMenuToggle = useCallback((entry: JournalEntry) => {
    setMenuEntry((prev) => (prev?.id === entry.id ? null : entry));
  }, []);

  const handleMenuClose = useCallback(() => setMenuEntry(null), []);

  const handleEdit = useCallback((entry: JournalEntry) => {
    setEditEntry(entry);
    setMenuEntry(null);
  }, []);

  const handleDeleteRequest = useCallback((entry: JournalEntry) => {
    setMenuEntry(entry);
    setConfirmDelete(true);
  }, []);

  const cancelDelete = useCallback(() => {
    setConfirmDelete(false);
    setMenuEntry(null);
  }, []);

  const confirmDeletion = useCallback(() => {
    if (!menuEntry) return;
    deleteMutation.mutate(menuEntry.id);
  }, [menuEntry, deleteMutation]);

  const handleSaved = useCallback(
    (updated: JournalEntry) => {
      qc.setQueryData<JournalEntry[]>(queryKey, (prev) =>
        prev ? prev.map((e) => (e.id === updated.id ? updated : e)) : prev,
      );
      qc.invalidateQueries({ queryKey: queryKeys.journal.all });
      setEditEntry(null);
    },
    [qc, queryKey],
  );

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
          {isError && (
            <div className="rounded-2xl bg-surface px-4 py-6 text-center text-sm text-content-secondary">
              Couldn&apos;t load reflections. Pull down to retry.
            </div>
          )}
          {!isError && isPending && (
            <>
              <div className="h-28 animate-pulse rounded-2xl bg-surface" />
              <div className="h-28 animate-pulse rounded-2xl bg-surface" />
              <div className="h-28 animate-pulse rounded-2xl bg-surface" />
            </>
          )}
          {!isError && entries && entries.length === 0 && (
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
          {!isError &&
            entries &&
            entries.map((entry) => (
              <ReflectionListCard
                key={entry.id}
                entry={entry}
                isMenuOpen={menuEntry?.id === entry.id && !confirmDelete && !editEntry}
                onMenuToggle={handleMenuToggle}
                onMenuClose={handleMenuClose}
                onEdit={handleEdit}
                onDelete={handleDeleteRequest}
              />
            ))}
        </div>
      </div>

      {menuEntry && confirmDelete && (
        <ConfirmDialog
          title="Delete reflection?"
          message="This cannot be undone."
          confirmLabel="Delete"
          cancelLabel="Cancel"
          variant="danger"
          isLoading={deleteMutation.isPending}
          onConfirm={confirmDeletion}
          onCancel={cancelDelete}
        />
      )}

      {editEntry && (
        <EditReflectionSheet
          entry={editEntry}
          onClose={() => setEditEntry(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
