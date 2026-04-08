import { useEffect, useRef, useState } from 'react';
import { WEEKDAYS } from '@/components/onboarding/constants';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { speak, stopTTS } from '@/lib/services/tts-service';
import { parseHabitsFromText } from '@/lib/utils/parse-habits-from-text';
import { useVoiceStore } from '@/stores/voiceStore';
import type { HabitItem, Phase } from './types';

const FALLBACK_HABITS: HabitItem[] = [
  { name: 'Sleep by 11 PM', days: new Set(WEEKDAYS), time: '21:45' },
  { name: 'Morning stretch', days: new Set(WEEKDAYS), time: '07:00' },
  { name: 'No coffee after 3 PM', days: new Set(WEEKDAYS), time: '15:00' },
];

export function useAdvancedPath(phase: Phase) {
  const [brainDumpText, setBrainDumpText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null!);
  const { isListening, toggle, transcript } = useVoiceInput();
  const resetTranscript = useVoiceStore((s) => s.resetTranscript);

  const [advancedHabits, setAdvancedHabits] = useState<HabitItem[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editDays, setEditDays] = useState<Set<number>>(new Set());
  const [editTime, setEditTime] = useState('21:45');
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Append voice transcript — brain dump appends, edit replaces name
  useEffect(() => {
    if (!isListening && transcript) {
      if (phase === 'advanced-edit' && editingIndex !== null) {
        setEditName(transcript.trim());
      } else {
        setBrainDumpText((prev) => (prev ? prev + '\n' + transcript : transcript));
      }
      resetTranscript();
    }
  }, [isListening, transcript, resetTranscript, phase, editingIndex]);

  // TTS on phase entry
  useEffect(() => {
    if (phase === 'advanced-input') {
      speak(
        "Tell me everything. What habits do you want to build? What are you trying to change? Don't hold back — just talk. I'll organize it all.",
      );
      return () => { stopTTS(); };
    }
    if (phase === 'advanced-results') {
      speak(
        "Here's what I put together from what you told me. Take a look — you can edit anything, or if it's way off, go back and try again.",
      );
      return () => { stopTTS(); };
    }
    if (phase === 'advanced-edit') {
      speak('What do you want to change about this habit?');
      return () => { stopTTS(); };
    }
  }, [phase]);

  function handleBrainDumpDone() {
    const parsed = parseHabitsFromText(brainDumpText);
    if (parsed.length > 0) {
      setAdvancedHabits(
        parsed.map((h) => ({ name: h.name, days: new Set(WEEKDAYS), time: '21:45' })),
      );
    } else {
      setAdvancedHabits(FALLBACK_HABITS.map((h) => ({ ...h, days: new Set(h.days) })));
    }
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
    setAdvancedHabits((prev) =>
      prev.map((h, i) =>
        i === editingIndex
          ? { name: editName.trim(), days: new Set(editDays), time: editTime }
          : h,
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

  function handleStartOver() {
    setBrainDumpText('');
    setAdvancedHabits([]);
  }

  return {
    brainDumpText,
    setBrainDumpText,
    textareaRef,
    isListening,
    toggleVoice: toggle,
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
    handleStartOver,
  };
}
