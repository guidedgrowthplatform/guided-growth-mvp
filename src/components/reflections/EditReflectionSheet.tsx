import { lazy, Suspense, useState } from 'react';
import { updateJournalEntry } from '@/api/journal';
import { GuidedTab } from '@/components/journal/GuidedTab';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/hooks/useAuth';
import type { JournalEntry } from '@shared/types';

const FreeformTab = lazy(() =>
  import('@/components/journal/FreeformTab').then((m) => ({ default: m.FreeformTab })),
);

interface EditReflectionSheetProps {
  entry: JournalEntry;
  onClose: () => void;
  onSaved: (updated: JournalEntry) => void;
}

export function EditReflectionSheet({ entry, onClose, onSaved }: EditReflectionSheetProps) {
  const { addToast } = useToast();
  const { user } = useAuth();
  const userName = user?.nickname ?? user?.name ?? 'there';
  const now = new Date(entry.created_at);

  const [freeformTitle, setFreeformTitle] = useState(entry.title ?? '');
  const [freeformBody, setFreeformBody] = useState(entry.fields?.body ?? '');
  const [guidedAnswers, setGuidedAnswers] = useState<Record<string, string>>({
    ...(entry.fields ?? {}),
  });
  const [saving, setSaving] = useState(false);

  const handleAnswerChange = (index: number, value: string) => {
    setGuidedAnswers((prev) => ({ ...prev, [String(index)]: value }));
  };

  const handleSave = async (close: () => void) => {
    setSaving(true);
    try {
      const updated =
        entry.type === 'freeform'
          ? await updateJournalEntry(entry.id, {
              title: freeformTitle || undefined,
              fields: { body: freeformBody },
            })
          : await updateJournalEntry(entry.id, { fields: guidedAnswers });
      addToast('success', 'Reflection updated');
      close();
      onSaved(updated);
    } catch {
      addToast('error', 'Failed to update — please try again');
      setSaving(false);
    }
  };

  return (
    <BottomSheet onClose={onClose} topOffset="top-12">
      {(close) => (
        <div className="px-6 pt-2" style={{ paddingBottom: '150px' }}>
          {entry.type === 'freeform' ? (
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
                onSave={() => handleSave(close)}
                saving={saving}
                userName={userName}
                now={now}
              />
            </Suspense>
          ) : (
            <GuidedTab
              answers={guidedAnswers}
              onAnswerChange={handleAnswerChange}
              onSave={() => handleSave(close)}
              saving={saving}
              now={now}
            />
          )}
        </div>
      )}
    </BottomSheet>
  );
}
