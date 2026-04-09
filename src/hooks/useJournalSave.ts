import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createJournalEntry } from '@/api/journal';
import { useToast } from '@/contexts/ToastContext';
import type { JournalEntryCreate } from '@shared/types';

export function useJournalSave() {
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);

  const save = async (data: JournalEntryCreate) => {
    setSaving(true);
    try {
      await createJournalEntry(data);
      addToast('success', 'Reflection saved!');
      navigate('/home');
    } catch {
      addToast('error', 'Failed to save — please try again');
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
