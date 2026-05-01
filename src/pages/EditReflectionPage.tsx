import { Icon } from '@iconify/react';
import { lazy, Suspense, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchJournalEntry, updateJournalEntry } from '@/api/journal';
import { GuidedTab } from '@/components/journal/GuidedTab';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/hooks/useAuth';
import type { JournalEntry } from '@shared/types';

const FreeformTab = lazy(() =>
  import('@/components/journal/FreeformTab').then((m) => ({ default: m.FreeformTab })),
);

export function EditReflectionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { user } = useAuth();
  const userName = user?.nickname ?? user?.name ?? 'there';

  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [freeformTitle, setFreeformTitle] = useState('');
  const [freeformBody, setFreeformBody] = useState('');
  const [guidedAnswers, setGuidedAnswers] = useState<Record<string, string>>({});
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    fetchJournalEntry(id)
      .then((row) => {
        if (cancelled) return;
        setEntry(row);
        setNow(new Date(row.created_at));
        if (row.type === 'freeform') {
          setFreeformTitle(row.title ?? '');
          setFreeformBody(row.fields?.body ?? '');
        } else {
          setGuidedAnswers({ ...(row.fields ?? {}) });
        }
      })
      .catch(() => {
        if (cancelled) return;
        addToast('error', 'Reflection not found');
        navigate('/reflections', { replace: true });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, addToast, navigate]);

  const handleAnswerChange = (index: number, value: string) => {
    setGuidedAnswers((prev) => ({ ...prev, [String(index)]: value }));
  };

  const handleSave = async () => {
    if (!entry) return;
    setSaving(true);
    try {
      if (entry.type === 'freeform') {
        await updateJournalEntry(entry.id, {
          title: freeformTitle || undefined,
          fields: { body: freeformBody },
        });
      } else {
        await updateJournalEntry(entry.id, { fields: guidedAnswers });
      }
      addToast('success', 'Reflection updated');
      navigate(`/reflections/${entry.id}`, { replace: true });
    } catch {
      addToast('error', 'Failed to update — please try again');
      setSaving(false);
    }
  };

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
        <h1 className="flex-1 text-center text-base font-semibold text-content">Edit Reflection</h1>
        <div className="h-10 w-10" aria-hidden />
      </div>

      <div
        className="px-6 pt-2"
        style={{ paddingBottom: 'calc(200px + env(safe-area-inset-bottom))' }}
      >
        {loading || !entry ? (
          <div className="flex flex-col gap-4">
            <div className="h-6 w-40 animate-pulse rounded bg-surface" />
            <div className="h-32 animate-pulse rounded-2xl bg-surface" />
            <div className="h-32 animate-pulse rounded-2xl bg-surface" />
          </div>
        ) : entry.type === 'freeform' ? (
          <Suspense
            fallback={
              <div className="flex items-center justify-center p-8">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary" />
              </div>
            }
          >
            <FreeformTab
              title={freeformTitle}
              body={freeformBody}
              onTitleChange={setFreeformTitle}
              onBodyChange={setFreeformBody}
              onSave={handleSave}
              saving={saving}
              userName={userName}
              now={now}
            />
          </Suspense>
        ) : (
          <GuidedTab
            answers={guidedAnswers}
            onAnswerChange={handleAnswerChange}
            onSave={handleSave}
            saving={saving}
            now={now}
          />
        )}
      </div>
    </div>
  );
}
