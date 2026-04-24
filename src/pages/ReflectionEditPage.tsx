import { useQueryClient } from '@tanstack/react-query';
import { lazy, Suspense, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { updateJournalEntry } from '@/api/journal';
import { TemplateEntry } from '@/components/journal/TemplateEntry';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/hooks/useAuth';
import { useReflectionDetail } from '@/hooks/useReflectionDetail';

const FreeformEntry = lazy(() =>
  import('@/components/journal/FreeformEntry').then((m) => ({ default: m.FreeformEntry })),
);

export function ReflectionEditPage() {
  const { entryId } = useParams<{ entryId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const { user } = useAuth();
  const { entry, isLoading, error } = useReflectionDetail(entryId);
  const userName = user?.nickname ?? user?.name?.split(' ')[0] ?? 'there';

  const [title, setTitle] = useState('');
  const [templateAnswers, setTemplateAnswers] = useState<Record<string, string>>({});
  const [mood, setMood] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!entry) return;
    setTitle(entry.title ?? '');
    setMood(entry.mood ?? null);
    if (entry.type === 'template') setTemplateAnswers(entry.fields ?? {});
  }, [entry]);

  const handleBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate(`/reflections/${entryId}`);
  };

  const handleSaveFreeform = async (body: string) => {
    if (!entry) return;
    setSaving(true);
    try {
      await updateJournalEntry(entry.id, {
        title: title || null,
        fields: { body },
        mood,
      });
      await queryClient.invalidateQueries({ queryKey: ['reflections'] });
      addToast('success', 'Reflection updated');
      navigate(`/reflections/${entry.id}`);
    } catch {
      addToast('error', 'Failed to save — please try again');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!entry) return;
    setSaving(true);
    try {
      await updateJournalEntry(entry.id, {
        fields: templateAnswers,
        mood,
      });
      await queryClient.invalidateQueries({ queryKey: ['reflections'] });
      addToast('success', 'Reflection updated');
      navigate(`/reflections/${entry.id}`);
    } catch {
      addToast('error', 'Failed to save — please try again');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary" />
      </div>
    );
  }

  if (error || !entry) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <h2 className="text-lg font-semibold text-content">Couldn't load this reflection</h2>
        <p className="max-w-sm text-sm text-content-secondary">
          It may have been deleted, or there was a network hiccup.
        </p>
        <button
          type="button"
          onClick={() => navigate('/reflections')}
          className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white"
        >
          Back to Reflections
        </button>
      </div>
    );
  }

  if (entry.type === 'template') {
    return (
      <TemplateEntry
        templateId={entry.template_id ?? '5-minute-morning'}
        answers={templateAnswers}
        onAnswerChange={(i, v) => setTemplateAnswers((prev) => ({ ...prev, [String(i)]: v }))}
        onSave={handleSaveTemplate}
        onBack={handleBack}
        saving={saving}
        mood={mood}
        onMoodChange={setMood}
      />
    );
  }

  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary" />
        </div>
      }
    >
      <FreeformEntry
        initialBody={entry.fields?.body ?? ''}
        title={title}
        onTitleChange={setTitle}
        onSave={handleSaveFreeform}
        onBack={handleBack}
        userName={userName}
        saving={saving}
        mood={mood}
        onMoodChange={setMood}
      />
    </Suspense>
  );
}
