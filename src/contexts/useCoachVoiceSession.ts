import { createContext, useContext, useEffect, useRef } from 'react';
import type { CoachChatApi } from '@/lib/chat/coachChatTypes';

export interface CoachTranscriptEvent {
  role: 'assistant' | 'user';
  kind: 'partial' | 'final';
  text: string;
}

export type CoachTranscriptListener = (event: CoachTranscriptEvent) => void;

// CoachVoiceProvider lifts useCoachChat above the overlay so the chat session,
// Soniox stream, and message history survive overlay open/close. The overlay
// + subtitle bar are both consumers.
export interface CoachVoiceContextValue extends CoachChatApi {
  // Screen ID the chat is currently bound to (last-opened screen, persists
  // across overlay close so the conversation continues).
  currentScreenId: string;
  // Subtitle bar + overlay subscribe here for streaming partials + finals.
  subscribeTranscripts: (listener: CoachTranscriptListener) => () => void;
}

export const CoachVoiceContext = createContext<CoachVoiceContextValue | null>(null);

export function useCoachVoice(): CoachVoiceContextValue | null {
  return useContext(CoachVoiceContext);
}

export function useCoachTranscripts(
  handler: CoachTranscriptListener,
  enabled: boolean = true,
): void {
  const session = useContext(CoachVoiceContext);
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  const subscribe = session?.subscribeTranscripts;
  useEffect(() => {
    if (!enabled || !subscribe) return;
    return subscribe((evt) => handlerRef.current(evt));
  }, [subscribe, enabled]);
}
