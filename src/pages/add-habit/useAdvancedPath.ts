import { useEffect, useRef, useState } from 'react';
import { track } from '@/analytics';
import { WEEKDAYS } from '@/components/onboarding/constants';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { speak, stopTTS } from '@/lib/services/tts-service';
import { parseHabitsFromText } from '@/lib/utils/parse-habits-from-text';
import { useVoiceStore } from '@/stores/voiceStore';
import type { HabitItem, Phase } from './types';

/**
 * Extract a time from a spoken transcript.
 * Handles: "10 PM", "9:30 AM", "at 7", "change it to 10", "move to 3 PM",
 * "every day at 9:30 PM", "weekdays at 7".
 * Returns 24h format "HH:MM" or null if no time found.
 */
function extractTimeFromTranscript(text: string): string | null {
  const lower = text.toLowerCase().trim();

  // Match patterns: "10:30 PM", "9 AM", "at 7", "to 10 PM", "10 pm"
  const timeRegex = /(?:at|to|for|around|by)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?/i;
  const match = lower.match(timeRegex);
  if (!match) return null;

  let hour = parseInt(match[1], 10);
  const minute = match[2] ? parseInt(match[2], 10) : 0;
  const meridian = match[3]?.replace(/\./g, '').toLowerCase();

  // Validate ranges
  if (hour < 1 || hour > 23 || minute < 0 || minute > 59) return null;

  // Convert to 24h
  if (meridian === 'pm' && hour < 12) hour += 12;
  if (meridian === 'am' && hour === 12) hour = 0;

  // If no meridian and hour <= 12, guess: <= 6 = PM (evening habits), > 6 = AM
  if (!meridian && hour <= 12) {
    if (hour <= 6) hour += 12; // "at 6" → 6 PM for evening habits
  }

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** Convert 24h "HH:MM" to human-readable "H:MM AM/PM" for TTS */
function formatTime(time24: string): string {
  const [h, m] = time24.split(':').map(Number);
  const meridian = h >= 12 ? 'PM' : 'AM';
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${String(m).padStart(2, '0')} ${meridian}`;
}

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

  // Append voice transcript — brain dump appends, edit replaces name or time
  useEffect(() => {
    if (!isListening && transcript) {
      if (phase === 'advanced-edit' && editingIndex !== null) {
        // Try to extract a time from the transcript (Voice Journey v3: "Change it to 10 PM")
        const parsedTime = extractTimeFromTranscript(transcript);
        if (parsedTime) {
          setEditTime(parsedTime);
          speak(`Updated to ${formatTime(parsedTime)}. All good?`);
        } else {
          // No time found — treat as name edit
          setEditName(transcript.trim());
          speak('Updated. All good?');
        }
      } else {
        setBrainDumpText((prev) => (prev ? prev + '\n' + transcript : transcript));
      }
      resetTranscript();
    }
  }, [isListening, transcript, resetTranscript, phase, editingIndex]);

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
