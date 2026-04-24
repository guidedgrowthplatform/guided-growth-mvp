import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/contexts/ToastContext';
import { useMetrics } from '@/hooks/useMetrics';
import type { Phase } from './types';
import { daysToFrequency } from './types';
import { useAdvancedPath } from './useAdvancedPath';
import { useBeginnerPath } from './useBeginnerPath';

export function useAddHabitState() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { create } = useMetrics();

  const [phase, setPhase] = useState<Phase>('choose-path');
  const [path, setPath] = useState<'simple' | 'braindump' | null>(null);
  const [saving, setSaving] = useState(false);

  const beginner = useBeginnerPath();
  const advanced = useAdvancedPath(phase);

  function handleBack() {
    switch (phase) {
      case 'choose-path':
        navigate(-1);
        break;
      case 'beginner-select':
      case 'advanced-input':
        setPhase('choose-path');
        break;
      case 'beginner-confirm':
        setPhase('beginner-select');
        break;
      case 'advanced-results':
        setPhase('advanced-input');
        break;
      case 'advanced-edit':
        setPhase('advanced-results');
        break;
    }
  }

  function handlePathContinue() {
    if (path === 'simple') setPhase('beginner-select');
    else if (path === 'braindump') setPhase('advanced-input');
  }

  // Beginner: when customization queue finishes, transition to confirm
  function handleBeginnerSheetNext(config: Parameters<typeof beginner.handleSheetNext>[0]) {
    beginner.handleSheetNext(config, () => setPhase('beginner-confirm'));
  }

  // Advanced: when edit starts/saves, transition phases
  function handleAdvancedEditStart(index: number) {
    advanced.startEditHabit(index);
    setPhase('advanced-edit');
  }

  function handleAdvancedEditSave() {
    advanced.saveEditHabit();
    setPhase('advanced-results');
  }

  function handleAdvancedDelete() {
    advanced.confirmDelete();
    setPhase('advanced-results');
  }

  function handleAdvancedStartOver() {
    advanced.handleStartOver();
    setPhase('advanced-input');
  }

  function handleBrainDumpDone() {
    advanced.handleBrainDumpDone();
    setPhase('advanced-results');
  }

  const handleConfirm = useCallback(async () => {
    if (phase !== 'beginner-confirm' && phase !== 'advanced-results') return;

    const habits =
      phase === 'beginner-confirm'
        ? Object.entries(beginner.habitConfigs).map(([name, config]) => ({
            name,
            frequency: daysToFrequency(config.days),
            days: [...config.days],
          }))
        : advanced.advancedHabits.map((h) => ({
            name: h.name,
            frequency: daysToFrequency(h.days),
            days: [...h.days],
          }));

    if (habits.length === 0) return;

    setSaving(true);
    try {
      const results = await Promise.allSettled(
        habits.map((h) =>
          create({
            name: h.name,
            input_type: 'binary',
            question: '',
            frequency: h.frequency,
            schedule_days: h.days,
          }),
        ),
      );

      const failed = results.filter((r) => r.status === 'rejected').length;
      if (failed > 0) {
        addToast('error', `${failed} habit(s) failed to save. Please try again.`);
      }

      const succeeded = results.filter((r) => r.status === 'fulfilled').length;
      if (succeeded > 0) {
        navigate('/', { replace: true });
      }
    } catch {
      addToast('error', 'Failed to create habits. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [phase, beginner.habitConfigs, advanced.advancedHabits, create, navigate, addToast]);

  return {
    phase,
    path,
    setPath,
    saving,
    handleBack,
    handlePathContinue,
    handleConfirm,

    // Beginner
    ...beginner,
    handleBeginnerSheetNext,

    // Advanced
    ...advanced,
    handleAdvancedEditStart,
    handleAdvancedEditSave,
    handleAdvancedDelete,
    handleAdvancedStartOver,
    handleBrainDumpDone,
  };
}
