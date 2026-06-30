import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { checkinFlowForScreen, useCoachChatLauncher } from '@/contexts/CoachChatContext';
import {
  CoachVoiceContext,
  type CoachTranscriptEvent,
  type CoachTranscriptListener,
  type CoachVoiceContextValue,
} from '@/contexts/useCoachVoiceSession';
import { useCoachChat } from '@/hooks/useCoachChat';
import { useDualButtonControls } from '@/hooks/useDualButtonControls';
import { createListenerBus, type ListenerBus } from '@/lib/util/listenerBus';

// Lifts useCoachChat above the overlay so the chat session, Soniox stream,
// and LLM message history survive overlay open/close + page navigation.
// Sits inside CoachChatProvider (which owns open/close + target screenId).
//
// Strategy: track the LAST screenId the user opened the chat with. When the
// overlay closes (openScreenId → null), we keep that screenId so the chat
// session stays bound to the same conversation.
export function CoachVoiceProvider({ children }: { children: ReactNode }) {
  const { openScreenId, initiateCheckinNonce } = useCoachChatLauncher();
  const { micOn } = useDualButtonControls();
  const [activeScreenId, setActiveScreenId] = useState<string | null>(null);

  // MCHECK/ECHECK run on the beat engine, not this LLM session — exclude them so
  // the coach doesn't open/speak behind the engine overlay.
  const isEngineCheckin = checkinFlowForScreen(openScreenId) !== null;
  const chatOpenScreenId = isEngineCheckin ? null : openScreenId;

  useEffect(() => {
    if (chatOpenScreenId && chatOpenScreenId !== activeScreenId) {
      setActiveScreenId(chatOpenScreenId);
    }
  }, [chatOpenScreenId, activeScreenId]);

  // Prefer the CURRENTLY-open screen so per-turn context + the dimension-scales
  // gate reflect the real screen, not a stale activeScreenId left from an earlier
  // morning check-in (MR#5). Falls back to the last screen when closed.
  const currentScreenId = chatOpenScreenId ?? activeScreenId ?? 'HOME-CHECKIN';

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

  // micOn arms capture on Home before the overlay is ever opened (#88) —
  // currentScreenId falls back to HOME-CHECKIN so the session has context.
  const api = useCoachChat(currentScreenId, {
    // Engine check-ins (MCHECK/ECHECK) run their own scoped coach loop in the
    // overlay — keep this provider instance off so there's no dual mic/session.
    enabled: !isEngineCheckin && (activeScreenId !== null || micOn),
    onTranscriptStream: handleTranscriptStream,
    initiateCheckinNonce,
    // Welcome opener must not fire when only the mic is armed on Home (MR#4).
    overlayOpen: chatOpenScreenId !== null,
  });

  // Pull specific stable fields from `api` instead of spreading the whole
  // object. The hook returns a NEW object reference every render, so spreading
  // it would churn the context value (and re-render every consumer) needlessly.
  const {
    messages,
    voiceState,
    speaking,
    revealingMessageId,
    micListening,
    startListening,
    stopListening,
    sendText,
    updateHabitDays,
    lastCreatedItem,
    loadOlder,
    hasMore,
    loadingOlder,
  } = api;

  const value = useMemo<CoachVoiceContextValue>(
    () => ({
      messages,
      voiceState,
      speaking,
      revealingMessageId,
      micListening,
      startListening,
      stopListening,
      sendText,
      updateHabitDays,
      lastCreatedItem,
      loadOlder,
      hasMore,
      loadingOlder,
      currentScreenId,
      subscribeTranscripts,
    }),
    [
      messages,
      voiceState,
      speaking,
      revealingMessageId,
      micListening,
      startListening,
      stopListening,
      sendText,
      updateHabitDays,
      lastCreatedItem,
      loadOlder,
      hasMore,
      loadingOlder,
      currentScreenId,
      subscribeTranscripts,
    ],
  );

  return <CoachVoiceContext.Provider value={value}>{children}</CoachVoiceContext.Provider>;
}
