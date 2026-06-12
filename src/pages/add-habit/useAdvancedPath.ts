import { useEffect, useRef, useState } from 'react';
import { track } from '@/analytics';
import { WEEKDAYS } from '@/components/onboarding/constants';
import { useParseHabits } from '@/hooks/useParseHabits';
import { speak, stopTTS } from '@/lib/services/tts-service';
import type { HabitItem, Phase } from './types';

export function useAdvancedPath(phase: Phase) {
  const { parse, loading: parsing } = useParseHabits();
  const [brainDumpText, setBrainDumpText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null!);

  const [advancedHabits, setAdvancedHabits] = useState<HabitItem[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editDays, setEditDays] = useState<Set<number>>(new Set());
  const [editTime, setEditTime] = useState('21:45');
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // TTS on phase entry — ref guard prevents StrictMode double-fire
  const lastSpokenPhase = useRef('');
  useEffect(() => {
    if (lastSpokenPhase.current === phase) return;
    lastSpokenPhase.current = phase;
    if (phase === 'advanced-input') {
      speak(
        "Tell me everything. What habits do you want to build? What are you trying to change? Don't hold back — just talk. I'll organize it all.",
      );
      return () => {
        stopTTS();
      };
    }
    if (phase === 'advanced-results') {
      speak(
        "Here's what I put together from what you told me. Take a look — you can edit anything, or if it's way off, go back and try again.",
      );
      return () => {
        stopTTS();
      };
    }
    if (phase === 'advanced-edit') {
      speak('What do you want to change about this habit?');
      return () => {
        stopTTS();
      };
    }
  }, [phase]);

  async function handleBrainDumpDone() {
    const { habits } = await parse(brainDumpText);
    setAdvancedHabits(
      habits.map((h) => ({
        name: h.name,
        days: new Set(h.days ?? WEEKDAYS),
        time: h.time ?? '21:45',
      })),
    );
  }

  function startEditHabit(index: number) {
    const h = advancedHabits[index];
    setEditingIndex(index);
    setEditName(h.name);
    setEditDays(new Set(h.days));
    setEditTime(h.time);
  }

  function saveEditHabit() {
    if (editingIndex === null || !editName.trim()) return;
    track('edit_habit', {
      habit_name: editName.trim(),
      frequency_days: editDays.size,
      source: 'add_habit_advanced',
    });
    setAdvancedHabits((prev) =>
      prev.map((h, i) =>
        i === editingIndex ? { name: editName.trim(), days: new Set(editDays), time: editTime } : h,
      ),
    );
    setEditingIndex(null);
  }

  function requestDelete() {
    setShowDeleteModal(true);
  }

  function confirmDelete() {
    if (editingIndex === null) return;
    setAdvancedHabits((prev) => prev.filter((_, i) => i !== editingIndex));
    setEditingIndex(null);
    setShowDeleteModal(false);
  }

  function cancelDelete() {
    setShowDeleteModal(false);
  }

  return {
    brainDumpText,
    setBrainDumpText,
    textareaRef,
    parsing,
    advancedHabits,
    editingIndex,
    editName,
    setEditName,
    editDays,
    setEditDays,
    editTime,
    setEditTime,
    showDeleteModal,
    handleBrainDumpDone,
    startEditHabit,
    saveEditHabit,
    requestDelete,
    confirmDelete,
    cancelDelete,
  };
}
