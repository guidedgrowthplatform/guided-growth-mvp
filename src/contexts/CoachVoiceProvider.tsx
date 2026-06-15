import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCoachChatLauncher } from '@/contexts/CoachChatContext';
import {
  CoachVoiceContext,
  type CoachTranscriptEvent,
  type CoachTranscriptListener,
  type CoachVoiceContextValue,
} from '@/contexts/useCoachVoiceSession';
import { useCoachChat } from '@/hooks/useCoachChat';
import { createListenerBus, type ListenerBus } from '@/lib/util/listenerBus';

// Lifts useCoachChat above the overlay so the chat session, Soniox stream,
// and LLM message history survive overlay open/close + page navigation.
// Sits inside CoachChatProvider (which owns open/close + target screenId).
//
// Strategy: track the LAST screenId the user opened the chat with. When the
// overlay closes (openScreenId → null), we keep that screenId so the chat
// session stays bound to the same conversation.
export function CoachVoiceProvider({ children }: { children: ReactNode }) {
  const { openScreenId } = useCoachChatLauncher();
  const [activeScreenId, setActiveScreenId] = useState<string | null>(null);

  useEffect(() => {
    if (openScreenId && openScreenId !== activeScreenId) {
      setActiveScreenId(openScreenId);
    }
  }, [openScreenId, activeScreenId]);

  // Default until the user opens for the first time — keeps the bound chat
  // present (resumable on next open) without forcing a screen-context-less
  // session creation.
  const currentScreenId = activeScreenId ?? 'HOME-CHECKIN';

  // Lazy-init the bus only once — useRef's argument is evaluated every render
  // but only the first result is stored. This pattern avoids churn while
  // keeping the bus identity rock-solid across the provider's lifetime.
  const busRef = useRef<ListenerBus<CoachTranscriptEvent> | null>(null);
  if (busRef.current === null) {
    busRef.current = createListenerBus<CoachTranscriptEvent>('coach/transcript');
  }
  const transcriptBus = busRef.current;

  // Stable wrapper so useEffect([subscribeTranscripts]) downstream never
  // re-fires due to identity churn — consumers' subscriptions stay live.
  const subscribeTranscripts = useCallback(
    (listener: CoachTranscriptListener) => transcriptBus.subscribe(listener),
    [transcriptBus],
  );

  const handleTranscriptStream = useCallback(
    (role: 'user' | 'assistant', text: string, kind: 'partial' | 'final') => {
      transcriptBus.notify({ role, kind, text });
    },
    [transcriptBus],
  );

  const api = useCoachChat(currentScreenId, {
    enabled: activeScreenId !== null,
    onTranscriptStream: handleTranscriptStream,
  });

  // Pull specific stable fields from `api` instead of spreading the whole
  // object. The hook returns a NEW object reference every render, so spreading
  // it would churn the context value (and re-render every consumer) needlessly.
  const {
    messages,
    voiceState,
    speaking,
    startListening,
    stopListening,
    sendText,
    updateHabitDays,
    lastCreatedItem,
  } = api;

  const value = useMemo<CoachVoiceContextValue>(
    () => ({
      messages,
      voiceState,
      speaking,
      startListening,
      stopListening,
      sendText,
      updateHabitDays,
      lastCreatedItem,
      currentScreenId,
      subscribeTranscripts,
    }),
    [
      messages,
      voiceState,
      speaking,
      startListening,
      stopListening,
      sendText,
      updateHabitDays,
      lastCreatedItem,
      currentScreenId,
      subscribeTranscripts,
    ],
  );

  return <CoachVoiceContext.Provider value={value}>{children}</CoachVoiceContext.Provider>;
}
