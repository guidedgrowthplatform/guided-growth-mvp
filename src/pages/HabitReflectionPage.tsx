import { Icon } from '@iconify/react';
import { format } from 'date-fns';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { track } from '@/analytics';
import { createJournalEntry } from '@/api/journal';
import { isEditorEmpty } from '@/components/reflections/editorUtils';
import { RichTextEditor } from '@/components/reflections/RichTextEditor';
import { useToast } from '@/contexts/ToastContext';
import type { Habit } from '@/lib/services/data-service.interface';
import { getDataService } from '@/lib/services/service-provider';

export function HabitReflectionPage() {
  const { habitId } = useParams<{ habitId: string }>();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [habit, setHabit] = useState<Habit | null>(null);
  const [loadingHabit, setLoadingHabit] = useState(true);
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [now] = useState(() => new Date());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!habitId) return;
      try {
        const ds = await getDataService();
        const found = await ds.getHabitById(habitId);
        if (cancelled) return;
        if (!found) {
          addToast('error', 'Habit not found');
          navigate('/habits', { replace: true });
          return;
        }
        setHabit(found);
      } finally {
        if (!cancelled) setLoadingHabit(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [habitId, navigate, addToast]);

  const empty = isEditorEmpty(body);

  const handleSave = async () => {
    if (!habit || empty || saving) return;
    setSaving(true);
    try {
      await createJournalEntry({
        type: 'freeform',
        date: format(now, 'yyyy-MM-dd'),
        title: habit.name,
        habit_id: habit.id,
        fields: { body },
      });
      track('log_habit_reflection', {
        habit_name: habit.name,
        reflection_length_chars: body.length,
      });
      addToast('success', 'Reflection saved');
      navigate('/habits');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save reflection';
      addToast('error', msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-full flex-col gap-6 pb-24 pt-2">
      <div className="flex flex-col gap-3">
        <button
          aria-label="Back"
          onClick={() => navigate(-1)}
          className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full hover:bg-surface-secondary active:bg-surface-secondary"
        >
          <Icon icon="mdi:arrow-left" className="h-6 w-6 text-content" />
        </button>
        <h1 className="text-[28px] font-semibold leading-tight text-content">
          Log habit reflection
        </h1>
        <p className="text-sm text-content-secondary">
          {format(now, 'EEEE, MMMM d')} · {format(now, 'hh:mm a')}
        </p>
        {loadingHabit ? (
          <div className="h-5 w-40 animate-pulse rounded bg-surface-secondary" />
        ) : (
          <p className="text-base font-bold text-content">{habit?.name}</p>
        )}
      </div>

      <RichTextEditor value={body} onChange={setBody} />

      <button
        type="button"
        onClick={handleSave}
        disabled={empty || saving || !habit}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-4 text-base font-semibold text-white shadow-sm transition-opacity active:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving && <Icon icon="svg-spinners:ring-resize" width={18} />}
        Save
      </button>
    </div>
  );
}
