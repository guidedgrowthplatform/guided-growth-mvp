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

const MOCK_EXCHANGES = [
  {
    user: 'I want to start meditating every morning',
    ai: "Great idea! I've created a daily meditation habit for you. Consistency is key — even 5 minutes counts!",
    habitCard: { name: 'Morning Meditation', days: [false, true, true, true, true, true, false] },
  },
  {
    user: 'How am I doing with my habits this week?',
    ai: "You're doing well! You've completed 8 out of 12 habits this week. Your longest streak is 5 days on 'Reading'. Keep it up!",
  },
  {
    user: 'I slept terribly last night, feeling tired',
    ai: "Sorry to hear that. I've logged your mood as low with a sleep note. Consider winding down earlier tonight — your sleep patterns tend to improve mid-week.",
  },
];

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function useVoiceChat() {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    { id: 'greeting', role: 'ai', text: GREETING, timestamp: Date.now() },
  ]);
  const [mockState, setMockState] = useState<VoiceChatState>('idle');

  const { isListening, start, stop, resetTranscript } = useVoiceInput();
  const { processTranscript, isProcessing } = useVoiceCommand();

  const transcript = useVoiceStore((s) => s.transcript);
  const lastResult = useCommandStore((s) => s.lastResult);
  const lastIntent = useCommandStore((s) => s.lastIntent);

  const lastHandledTranscript = useRef('');
  const lastHandledResult = useRef<typeof lastResult>(null);
  const mockIndexRef = useRef(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const useMock = true;
  const voiceState: VoiceChatState = useMock
    ? mockState
    : isProcessing
      ? 'processing'
      : isListening
        ? 'listening'
        : 'idle';

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

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
    if (useMock) {
      setMockState('listening');
      return;
    }
    resetTranscript();
    start();
  }, [useMock, start, resetTranscript]);

  const stopListening = useCallback(() => {
    if (useMock) {
      const exchange = MOCK_EXCHANGES[mockIndexRef.current % MOCK_EXCHANGES.length];
      mockIndexRef.current++;

      setMockState('processing');
      setMessages((prev) => [
        ...prev,
        { id: makeId(), role: 'user', text: exchange.user, timestamp: Date.now() },
      ]);

      const t = setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: makeId(),
            role: 'ai',
            text: exchange.ai,
            habitCards: exchange.habitCard ? [exchange.habitCard] : undefined,
            timestamp: Date.now(),
          },
        ]);
        setMockState('idle');
      }, 1500);
      timersRef.current.push(t);
      return;
    }
    stop();
  }, [useMock, stop]);

  const reset = useCallback(() => {
    clearTimers();
    setMessages([{ id: 'greeting', role: 'ai', text: GREETING, timestamp: Date.now() }]);
    setMockState('idle');
    mockIndexRef.current = 0;
    lastHandledTranscript.current = '';
    lastHandledResult.current = null;
    resetTranscript();
  }, [resetTranscript, clearTimers]);

  useEffect(() => clearTimers, [clearTimers]);

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
