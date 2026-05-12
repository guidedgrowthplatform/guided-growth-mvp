import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createJournalEntry } from '@/api/journal';
import { useToast } from '@/contexts/ToastContext';
import { useSessionLog } from '@/hooks/useSessionLog';
import type { JournalEntryCreate } from '@shared/types';

export function useJournalSave() {
  const { addToast } = useToast();
  const navigate = useNavigate();
  const { logEvent } = useSessionLog();
  const [saving, setSaving] = useState(false);

  const save = async (data: JournalEntryCreate): Promise<boolean> => {
    setSaving(true);
    try {
      await createJournalEntry(data);
      const responseLength = Object.values(data.fields ?? {}).join('').length;
      logEvent(
        'reflection_logged',
        {
          style: data.type === 'template' ? (data.template_id ?? 'template') : 'freeform',
          prompt: data.title ?? '',
          response_length: responseLength,
        },
        data.type === 'template' ? 'EVENING-REFLECTION-GUIDED' : 'EVENING-REFLECTION-FREEFORM',
      );
      addToast('success', 'Reflection saved!');
      navigate('/home');
      return true;
    } catch {
      addToast('error', 'Failed to save — please try again');
      return false;
    } finally {
      // Always reset saving state — previously only the catch path
      // reset it, so if navigate('/home') didn't unmount the component
      // (e.g. router error, back button before unmount), the spinner
      // would be stuck on forever.
      setSaving(false);
    }
  };

  return { save, saving };
}
