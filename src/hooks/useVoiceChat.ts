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

const SESSION_STORAGE_KEY = 'voice-chat-messages';

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function defaultMessages(): ChatMessage[] {
  return [{ id: 'greeting', role: 'ai', text: GREETING, timestamp: Date.now() }];
}

function loadMessages(): ChatMessage[] {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (raw) {
      const parsed: ChatMessage[] = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // Corrupted data — fall back to default
  }
  return defaultMessages();
}

function saveMessages(messages: ChatMessage[]): void {
  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(messages));
  } catch {
    // Storage full or unavailable
  }
}

export function useVoiceChat() {
  const [messages, setMessages] = useState<ChatMessage[]>(loadMessages);

  const { isListening, start, stop, resetTranscript, error: voiceError } = useVoiceInput();
  const { processTranscript, isProcessing, error: commandError } = useVoiceCommand();

  const transcript = useVoiceStore((s) => s.transcript);
  const lastResult = useCommandStore((s) => s.lastResult);
  const lastIntent = useCommandStore((s) => s.lastIntent);

  const lastHandledTranscript = useRef('');
  const lastHandledResult = useRef<typeof lastResult>(null);
  const lastHandledVoiceError = useRef('');
  const lastHandledCommandError = useRef<string | null>(null);

  const voiceState: VoiceChatState = isProcessing
    ? 'processing'
    : isListening
      ? 'listening'
      : 'idle';

  // Bug 1 fix: persist messages to sessionStorage on every change
  useEffect(() => {
    saveMessages(messages);
  }, [messages]);

  // Bug 2 fix: add user bubble BEFORE processing the transcript
  useEffect(() => {
    if (!transcript || transcript === lastHandledTranscript.current) return;
    if (isListening) return;

    lastHandledTranscript.current = transcript;

    // Add the user's message bubble first
    setMessages((prev) => [
      ...prev,
      { id: makeId(), role: 'user', text: transcript, timestamp: Date.now() },
    ]);

    // Then process — AI response will arrive via the lastResult effect
    processTranscript(transcript);
    resetTranscript();
  }, [transcript, isListening, processTranscript, resetTranscript]);

  // AI response bubble
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

  // Bug 3 fix: show voice/mic errors as AI bubbles
  useEffect(() => {
    if (!voiceError || voiceError === lastHandledVoiceError.current) return;
    lastHandledVoiceError.current = voiceError;

    setMessages((prev) => [
      ...prev,
      {
        id: makeId(),
        role: 'ai',
        text: `Sorry, there was a problem with voice input: ${voiceError}`,
        timestamp: Date.now(),
      },
    ]);
  }, [voiceError]);

  // Bug 3 fix: show command processing errors as AI bubbles
  useEffect(() => {
    if (!commandError || commandError === lastHandledCommandError.current) return;
    lastHandledCommandError.current = commandError;

    setMessages((prev) => [
      ...prev,
      {
        id: makeId(),
        role: 'ai',
        text: `Something went wrong while processing your request: ${commandError}`,
        timestamp: Date.now(),
      },
    ]);
  }, [commandError]);

  const startListening = useCallback(() => {
    resetTranscript();
    start();
  }, [start, resetTranscript]);

  const stopListening = useCallback(() => {
    stop();
  }, [stop]);

  // Bug 1 fix: reset now clears sessionStorage and ref trackers
  const reset = useCallback(() => {
    const fresh = defaultMessages();
    setMessages(fresh);
    saveMessages(fresh);
    lastHandledTranscript.current = '';
    lastHandledResult.current = null;
    lastHandledVoiceError.current = '';
    lastHandledCommandError.current = null;
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
