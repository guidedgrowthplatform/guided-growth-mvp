import { useCallback, useEffect, useRef, useState } from 'react';
import { useCommandStore } from '@/stores/commandStore';
import { useVoiceStore } from '@/stores/voiceStore';
import { useVoiceCommand } from './useVoiceCommand';
import { useVoiceInput } from './useVoiceInput';

export interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  text: string;
  habitCards?: Array<{ name: string; days: boolean[] }>;
  timestamp: number;
}

export type VoiceChatState = 'idle' | 'listening' | 'processing';

const GREETING =
  'Hi there! How are you feeling today? You can ask me to create habits, log metrics, or check your progress.';

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function useVoiceChat() {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    { id: 'greeting', role: 'ai', text: GREETING, timestamp: Date.now() },
  ]);

  const { isListening, start, stop, resetTranscript } = useVoiceInput();
  const { processTranscript, isProcessing } = useVoiceCommand();

  const transcript = useVoiceStore((s) => s.transcript);
  const lastResult = useCommandStore((s) => s.lastResult);
  const lastIntent = useCommandStore((s) => s.lastIntent);

  const lastHandledTranscript = useRef('');
  const lastHandledResult = useRef<typeof lastResult>(null);

  const voiceState: VoiceChatState = isProcessing
    ? 'processing'
    : isListening
      ? 'listening'
      : 'idle';

  useEffect(() => {
    if (!transcript || transcript === lastHandledTranscript.current) return;
    if (isListening) return;

    lastHandledTranscript.current = transcript;

    setMessages((prev) => [
      ...prev,
      { id: makeId(), role: 'user', text: transcript, timestamp: Date.now() },
    ]);

    processTranscript(transcript);
    resetTranscript();
  }, [transcript, isListening, processTranscript, resetTranscript]);

  useEffect(() => {
    if (!lastResult || lastResult === lastHandledResult.current) return;
    lastHandledResult.current = lastResult;

    const habitCards: ChatMessage['habitCards'] =
      lastIntent?.action === 'create' && lastIntent?.entity === 'habit' && lastResult.success
        ? [
            {
              name: (lastIntent.params?.name as string) || 'New Habit',
              days: [false, true, true, true, true, true, false],
            },
          ]
        : undefined;

    setMessages((prev) => [
      ...prev,
      {
        id: makeId(),
        role: 'ai',
        text: lastResult.message,
        habitCards,
        timestamp: Date.now(),
      },
    ]);
  }, [lastResult, lastIntent]);

  const startListening = useCallback(() => {
    resetTranscript();
    start();
  }, [start, resetTranscript]);

  const stopListening = useCallback(() => {
    stop();
  }, [stop]);

  const reset = useCallback(() => {
    setMessages([{ id: 'greeting', role: 'ai', text: GREETING, timestamp: Date.now() }]);
    lastHandledTranscript.current = '';
    lastHandledResult.current = null;
    resetTranscript();
  }, [resetTranscript]);

  const updateHabitDays = useCallback((messageId: string, cardIndex: number, days: boolean[]) => {
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== messageId || !msg.habitCards) return msg;
        const cards = [...msg.habitCards];
        cards[cardIndex] = { ...cards[cardIndex], days };
        return { ...msg, habitCards: cards };
      }),
    );
  }, []);

  return {
    messages,
    voiceState,
    isSupported: true,
    startListening,
    stopListening,
    reset,
    updateHabitDays,
  };
}
