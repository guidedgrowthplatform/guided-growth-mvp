import { useCallback, useEffect, useRef, useState } from 'react';
import { useVoice } from '@/hooks/useVoice';
import { stopTTS } from '@/lib/services/tts-service';
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

/** Time-aware greeting per Voice Journey Spreadsheet v3 */
function getGreeting(name?: string): string {
  const hour = new Date().getHours();
  const displayName = name || 'there';
  if (hour < 12)
    return `Morning, ${displayName}. How are you feeling today? You can ask me to create habits, log metrics, or check your progress.`;
  if (hour < 17)
    return `Good afternoon, ${displayName}. What's on your mind? You can ask me to create habits, log metrics, or check your progress.`;
  return `Evening, ${displayName}. How was today? You can ask me to create habits, log metrics, or check your progress.`;
}

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function defaultMessages(name?: string): ChatMessage[] {
  return [{ id: 'greeting', role: 'ai', text: getGreeting(name), timestamp: Date.now() }];
}

export function useVoiceChat(userName?: string) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => defaultMessages(userName));
  const { enterRealtime, release, transition } = useVoice();

  const { isListening, start, stop, resetTranscript, error: voiceError } = useVoiceInput();
  const { processTranscript, isProcessing, error: commandError } = useVoiceCommand();

  const transcript = useVoiceStore((s) => s.transcript);
  const lastResult = useCommandStore((s) => s.lastResult);
  const lastIntent = useCommandStore((s) => s.lastIntent);

  const lastHandledTranscript = useRef('');
  const lastHandledResult = useRef<typeof lastResult>(null);
  const lastHandledVoiceError = useRef('');
  const lastHandledCommandError = useRef<string | null>(null);
  const hasSpokenGreeting = useRef(false);

  const voiceState: VoiceChatState = isProcessing
    ? 'processing'
    : isListening
      ? 'listening'
      : 'idle';

  // Sync local voiceState → global VoiceContext transitions
  useEffect(() => {
    if (voiceState === 'listening') {
      enterRealtime(); // acquires the channel + sets global to 'listening'
    } else if (voiceState === 'processing') {
      transition('thinking');
    } else if (voiceState === 'idle') {
      // Only release if we were previously active
      // (avoid releasing on initial mount)
    }
  }, [voiceState, enterRealtime, transition]);

  // Re-enabled Cartesia TTS greeting since /api/cartesia-tts is now stable on Vercel.
  useEffect(() => {
    if (!hasSpokenGreeting.current && messages.length > 0) {
      speak(messages[0].text);
      hasSpokenGreeting.current = true;
    }
  }, [messages]);

  // Process transcript when recording stops and transcript is available
  useEffect(() => {
    if (!transcript || transcript === lastHandledTranscript.current) return;
    if (isListening) return;

    lastHandledTranscript.current = transcript;

    // Add the user's message bubble
    setMessages((prev) => [
      ...prev,
      { id: makeId(), role: 'user', text: transcript, timestamp: Date.now() },
    ]);

    // Process — AI response arrives via lastResult effect
    processTranscript(transcript);
    resetTranscript();
  }, [transcript, isListening, processTranscript, resetTranscript]);

  // AI response bubble + TTS
  useEffect(() => {
    if (!lastResult || lastResult === lastHandledResult.current) return;
    lastHandledResult.current = lastResult;

    // Global state → speaking (TTS is about to play)
    transition('speaking');

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

    // TTS is handled by useVoiceCommand — don't duplicate here
    // After TTS finishes, release the voice channel back to idle.
    // We use a timeout approximation since speak() is fire-and-forget.
    setTimeout(() => {
      release();
    }, 3000);
  }, [lastResult, lastIntent, transition, release]);

  // Voice/mic errors as friendly AI bubbles
  useEffect(() => {
    if (!voiceError || voiceError === lastHandledVoiceError.current) return;
    lastHandledVoiceError.current = voiceError;

    const friendlyMsg = "Hmm, I didn't catch that. Try tapping the mic and speaking again.";
    setMessages((prev) => [
      ...prev,
      { id: makeId(), role: 'ai', text: friendlyMsg, timestamp: Date.now() },
    ]);
  }, [voiceError]);

  // Command processing errors as friendly AI bubbles
  useEffect(() => {
    if (!commandError || commandError === lastHandledCommandError.current) return;
    lastHandledCommandError.current = commandError;

    const friendlyMsg = "Something didn't work on my end. Try saying that again?";
    setMessages((prev) => [
      ...prev,
      { id: makeId(), role: 'ai', text: friendlyMsg, timestamp: Date.now() },
    ]);
  }, [commandError]);

  const startListening = useCallback(() => {
    // Stop any TTS that's playing before listening
    stopTTS();
    // Clear the processed-transcript guard so a repeated command with
    // identical text (e.g. user confirms with "yes" twice) is not dropped.
    // Previously the effect at line 69 compared transcript against the
    // last-handled text and returned early if equal, silently skipping
    // the second "yes". Clearing on each new start makes repeated text
    // commands work again.
    lastHandledTranscript.current = '';
    resetTranscript();
    start();
  }, [start, resetTranscript]);

  const stopListening = useCallback(() => {
    stop();
  }, [stop]);

  // Reset clears ref trackers and starts fresh
  const reset = useCallback(() => {
    const fresh = defaultMessages(userName);
    setMessages(fresh);
    lastHandledTranscript.current = '';
    lastHandledResult.current = null;
    lastHandledVoiceError.current = '';
    lastHandledCommandError.current = null;
    hasSpokenGreeting.current = false;
    resetTranscript();
  }, [resetTranscript, userName]);

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
