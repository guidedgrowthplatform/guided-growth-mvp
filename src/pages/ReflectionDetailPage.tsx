import { Icon } from '@iconify/react';
import { useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { useCallback, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { deleteJournalEntry } from '@/api/journal';
import { getTemplate } from '@/components/journal/templates';
import {
  AiInsightCard,
  ReflectionsTopBar,
  ReflectionOverflowMenu,
  getMoodPreset,
} from '@/components/reflections';
import { useToast } from '@/contexts/ToastContext';
import { useReflectionDetail } from '@/hooks/useReflectionDetail';
import { track } from '@/lib/analytics';
import type { JournalEntry } from '@shared/types';

export function ReflectionDetailPage() {
  const { entryId } = useParams<{ entryId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const { entry, isLoading, error, insightLoading } = useReflectionDetail(entryId);

  useEffect(() => {
    if (entry) track('reflection_detail_opened', { entry_id: entry.id });
  }, [entry]);

  useEffect(() => {
    if (entry?.ai_insight) track('ai_insight_shown', { entry_id: entry.id });
  }, [entry?.ai_insight, entry?.id]);

  const handleDelete = useCallback(async () => {
    if (!entry) return;
    try {
      await deleteJournalEntry(entry.id);
      queryClient.invalidateQueries({ queryKey: ['reflections'] });
      addToast('success', 'Reflection deleted');
      navigate('/reflections');
    } catch {
      addToast('error', 'Failed to delete — please try again');
    }
  }, [entry, queryClient, addToast, navigate]);

  return (
    <div className="min-h-dvh px-6 pb-8 pt-[max(1rem,env(safe-area-inset-top))]">
      <ReflectionsTopBar
        title="Journal Entry"
        rightSlot={
          entry && (
            <ReflectionOverflowMenu
              onEdit={() => navigate(`/reflections/${entry.id}/edit`)}
              onDelete={handleDelete}
            />
          )
        }
      />

      {isLoading ? (
        <DetailSkeleton />
      ) : error || !entry ? (
        <ErrorState onBack={() => navigate('/reflections')} />
      ) : (
        <DetailContent entry={entry} insightLoading={insightLoading} />
      )}
    </div>
  );
}

function DetailContent({
  entry,
  insightLoading,
}: {
  entry: JournalEntry;
  insightLoading: boolean;
}) {
  const createdAt = parseISO(entry.created_at);
  const monthLabel = format(createdAt, 'MMMM yyyy');
  const bigDate = format(createdAt, 'EEEE, MMMM d, yyyy');
  const time = format(createdAt, 'hh:mm a');
  const mood = getMoodPreset(entry.mood);

  return (
    <div className="flex flex-col gap-6 pt-6">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-content-secondary">{monthLabel}</span>
        <h1 className="text-[32px] font-bold leading-tight tracking-tight text-content">
          {bigDate}
        </h1>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-2 text-sm text-content-secondary">
          <Icon icon="mdi:clock-outline" width={16} height={16} />
          {time}
        </span>
        {mood && (
          <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-semibold text-primary-light">
            <span className="text-base leading-none">{mood.emoji}</span>
            {mood.label}
          </span>
        )}
      </div>

      <BodyCard entry={entry} />
      <AiInsightCard insight={entry.ai_insight} isLoading={insightLoading} />
    </div>
  );
}

function BodyCard({ entry }: { entry: JournalEntry }) {
  if (entry.type === 'freeform') {
    const body = entry.fields?.body ?? '';
    return (
      <div className="rounded-[24px] bg-surface-secondary p-6">
        <div
          className="prose prose-invert max-w-none text-base leading-relaxed text-content [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-5"
          dangerouslySetInnerHTML={{ __html: body }}
        />
      </div>
    );
  }

  const template = getTemplate(entry.template_id);
  return (
    <div className="flex flex-col gap-4">
      {template.questions.map((question, i) => {
        const answer = entry.fields?.[String(i)];
        if (!answer || !answer.trim()) return null;
        return (
          <div key={i} className="rounded-[24px] bg-surface-secondary p-6">
            <p className="text-sm font-semibold text-content-secondary">{question}</p>
            <p className="mt-2 whitespace-pre-wrap text-base leading-relaxed text-content">
              {answer}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-6 pt-6">
      <div className="relative h-10 w-3/4 overflow-hidden rounded-xl bg-surface-secondary">
        <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent bg-[length:200%_100%]" />
      </div>
      <div className="relative h-40 w-full overflow-hidden rounded-[24px] bg-surface-secondary">
        <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent bg-[length:200%_100%]" />
      </div>
    </div>
  );
}

function ErrorState({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl bg-surface-secondary px-6 py-10 text-center">
      <p className="text-base font-semibold text-content">Couldn't load this reflection</p>
      <p className="text-sm text-content-secondary">
        It may have been deleted, or there was a network hiccup.
      </p>
      <button
        type="button"
        onClick={onBack}
        className="mt-2 rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white"
      >
        Back to Reflections
      </button>
    </div>
  );
}
