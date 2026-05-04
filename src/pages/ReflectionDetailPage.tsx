import { Icon } from '@iconify/react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchJournalEntry } from '@/api/journal';
import { EditReflectionSheet } from '@/components/reflections/EditReflectionSheet';
import { entryHeading, formatDetailHeader } from '@/components/reflections/reflectionFormatters';
import { useToast } from '@/contexts/ToastContext';
import type { JournalEntry } from '@shared/types';
import '@/styles/tiptap.css';

const GUIDED_PROMPTS = [
  'What are the things you are grateful for today?',
  'What are the things you are proud of today?',
  'What are the things you forgive yourself for today?',
];

function FreeformBody({ entry }: { entry: JournalEntry }) {
  const html = entry.fields?.body ?? '';
  return (
    <div className="rounded-2xl bg-surface p-5 shadow-card">
      {entry.title && (
        <h3 className="mb-3 text-lg font-bold text-content">{entry.title}</h3>
      )}
      <div
        className="reflection-editor prose prose-sm max-w-none text-content"
        // entry HTML is sanitized at write-time on the API; rendering as-is.
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

function GuidedBody({ entry }: { entry: JournalEntry }) {
  return (
    <div className="flex flex-col gap-4">
      {GUIDED_PROMPTS.map((prompt, i) => {
        const answer = entry.fields?.[String(i)]?.trim();
        if (!answer) return null;
        return (
          <div key={i} className="rounded-2xl bg-surface p-5 shadow-card">
            <p className="text-sm font-bold text-content">
              {i + 1}. {prompt}
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-content-secondary">{answer}</p>
          </div>
        );
      })}
    </div>
  );
}

function AIInsightCard() {
  return (
    <div className="rounded-2xl bg-surface p-5 shadow-card">
      <div className="flex items-center justify-between">
        <p className="text-base font-bold text-content">AI Insight</p>
        <Icon icon="mdi:auto-awesome" width={22} height={22} className="text-primary" />
      </div>
      <p className="mt-2 text-sm text-content-secondary">
        Personalized insights about this reflection will appear here soon.
      </p>
    </div>
  );
}

export function ReflectionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetchJournalEntry(id)
      .then((row) => {
        if (!cancelled) setEntry(row);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const status =
          typeof err === 'object' && err && 'status' in err ? (err as { status: number }).status : 0;
        const message =
          status === 404
            ? "We couldn't find this reflection. It may have been deleted."
            : err instanceof Error
              ? err.message
              : 'Failed to load reflection';
        setLoadError(message);
        addToast('error', message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, addToast]);

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
        <h1 className="flex-1 text-center text-lg font-semibold text-content">Journal Entry</h1>
        <button
          type="button"
          onClick={() => entry && setEditOpen(true)}
          aria-label="Edit reflection"
          disabled={!entry}
          className="-mr-2 flex h-10 w-10 items-center justify-center rounded-full text-content hover:bg-surface-secondary active:bg-surface-secondary disabled:opacity-40"
        >
          <Icon icon="mdi:pencil-outline" width={18} height={18} />
        </button>
      </div>

      <div
        className="px-6 pt-2"
        style={{ paddingBottom: 'calc(200px + env(safe-area-inset-bottom))' }}
      >
        {loadError && !loading ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-surface px-6 py-10 text-center">
            <Icon
              icon="mdi:alert-circle-outline"
              width={32}
              height={32}
              className="text-content-tertiary"
            />
            <p className="text-sm font-medium text-content">{loadError}</p>
            <button
              type="button"
              onClick={() => navigate('/reflections')}
              className="mt-1 rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white"
            >
              Back to all reflections
            </button>
          </div>
        ) : loading || !entry ? (
          <div className="flex flex-col gap-4">
            <div className="h-6 w-24 animate-pulse rounded bg-surface" />
            <div className="h-9 w-3/4 animate-pulse rounded bg-surface" />
            <div className="mt-4 h-40 animate-pulse rounded-2xl bg-surface" />
            <div className="h-32 animate-pulse rounded-2xl bg-surface" />
          </div>
        ) : (
          <>
            {(() => {
              const header = formatDetailHeader(entry.created_at);
              return (
                <>
                  <h2 className="text-lg font-bold leading-tight text-content">
                    {header.fullDate}
                  </h2>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-content-secondary">
                      <Icon icon="mdi:clock-outline" width={16} height={16} className="text-primary" />
                      {header.time}
                    </div>
                    <span className="rounded-full border border-border-light bg-surface px-3 py-1 text-xs font-semibold text-primary">
                      {entryHeading(entry)}
                    </span>
                  </div>
                </>
              );
            })()}

            <div className="mt-6">
              {entry.type === 'freeform' ? (
                <FreeformBody entry={entry} />
              ) : (
                <GuidedBody entry={entry} />
              )}
            </div>

            <div className="mt-4">
              <AIInsightCard />
            </div>
          </>
        )}
      </div>

      {editOpen && entry && (
        <EditReflectionSheet
          entry={entry}
          onClose={() => setEditOpen(false)}
          onSaved={(updated) => {
            setEntry(updated);
            setEditOpen(false);
          }}
        />
      )}
    </div>
  );
}
