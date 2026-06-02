import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReleaseToken, Surface } from '@/contexts/voiceContextDef';
import { useChatSession } from '@/hooks/useChatSession';
import { useCoachChatToolEvents } from '@/hooks/useCoachChatToolEvents';
import { useLLM } from '@/hooks/useLLM';
import { useVoice } from '@/hooks/useVoice';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { buildHabitCards } from '@/lib/chat/coachChatCards';
import type { ChatMessage, CoachChatApi, VoiceChatState } from '@/lib/chat/coachChatTypes';
import { speak, stopTTS, useTtsPlaybackStore } from '@/lib/services/tts-service';
import type { CoachingStyle } from '@gg/shared/types/llm';

const LLM_ERROR_TEXT = "Something didn't work on my end. Mind trying that again?";
const SESSION_ERROR_TEXT =
  "I'm having trouble connecting right now. Try closing and reopening the chat.";

// Reusable post-onboarding coach conversation. Screen-parameterized so it can
// mount on any screen; the tools the LLM gets are decided server-side per screenId.
export function useCoachChat(
  screenId: string,
  opts?: { surface?: Surface; coachingStyle?: CoachingStyle },
): CoachChatApi {
  const surface = opts?.surface ?? 'chat';
  const coachingStyle = opts?.coachingStyle ?? 'warm';

  const {
    chatSessionId,
    initialMessages,
    status: sessionStatus,
  } = useChatSession(screenId, { enabled: true, resume: true });
  const {
    sendMessage,
    sendOpener,
    messages: llmMessages,
    isStreaming,
    error: llmError,
  } = useLLM(screenId, {
    coachingStyle,
    chatSessionId: chatSessionId ?? undefined,
    initialMessages,
  });

  const {
    isListening,
    transcript,
    start,
    stop,
    resetTranscript,
    error: voiceError,
  } = useVoiceInput();
  const { acquireRealtime, releaseToken, setStatus } = useVoice();
  const isSpeaking = useTtsPlaybackStore((s) => s.isSpeaking);

  useCoachChatToolEvents(llmMessages, chatSessionId, initialMessages);

  const tokenRef = useRef<ReleaseToken | null>(null);
  const pendingTurnRef = useRef<string | null>(null);
  const lastHandledTranscript = useRef('');
  const openerSentRef = useRef<string | null>(null);
  const spokenSeededForRef = useRef<string | null>(null);
  const spokenIdsRef = useRef<Set<string>>(new Set());
  const lastLlmErrorRef = useRef('');
  const lastVoiceErrorRef = useRef('');
  const errorSeqRef = useRef(0);
  const lastAssistantIdRef = useRef<string | null>(null);

  const [dayOverrides, setDayOverrides] = useState<Map<string, boolean[]>>(() => new Map());
  const [errorBubbles, setErrorBubbles] = useState<ChatMessage[]>([]);
  // >0 from speak() dispatch until playback ends — closes the gap where the TTS
  // store's isSpeaking flips async (fetch latency) and the channel would release early.
  const [ttsActive, setTtsActive] = useState(0);

  const voiceState: VoiceChatState =
    isStreaming || sessionStatus === 'loading' ? 'processing' : isListening ? 'listening' : 'idle';

  // ─── Voice channel token: acquire on listening, reflect phase ────────
  useEffect(() => {
    if (voiceState === 'listening') {
      if (!tokenRef.current) {
        const token = acquireRealtime({
          surface,
          onCleanup: () => {
            tokenRef.current = null;
          },
        });
        if (token) tokenRef.current = token;
      } else {
        setStatus(tokenRef.current, 'listening');
      }
    } else if (voiceState === 'processing' && tokenRef.current) {
      setStatus(tokenRef.current, 'thinking');
    } else if ((isSpeaking || ttsActive > 0) && tokenRef.current) {
      setStatus(tokenRef.current, 'speaking');
    }
  }, [voiceState, isSpeaking, ttsActive, acquireRealtime, setStatus, surface]);

  // Release once the turn is fully settled (state-driven — no per-turn finally,
  // so a tool-only/no-text turn still frees the channel and a new turn never
  // gets its token released out from under it).
  useEffect(() => {
    if (isListening || isStreaming || isSpeaking || ttsActive > 0) return;
    const t = tokenRef.current;
    if (t) {
      tokenRef.current = null;
      releaseToken(t);
    }
  }, [isListening, isStreaming, isSpeaking, ttsActive, releaseToken]);

  useEffect(() => {
    return () => {
      const t = tokenRef.current;
      if (t) {
        tokenRef.current = null;
        releaseToken(t);
      }
    };
  }, [releaseToken]);

  // ─── Server opener on a fresh session (no resumed history) ───────────
  useEffect(() => {
    if (!chatSessionId) return;
    if (openerSentRef.current === chatSessionId) return;
    openerSentRef.current = chatSessionId;
    if (initialMessages.length > 0) return; // resumed thread already populated
    void sendOpener();
  }, [chatSessionId, initialMessages, sendOpener]);

  // ─── Pre-seed spoken ids from resumed history (declared BEFORE the speak
  // effect so it runs first in-commit) — prevents replaying old turns ──
  useEffect(() => {
    if (!chatSessionId) return;
    if (spokenSeededForRef.current === chatSessionId) return;
    spokenSeededForRef.current = chatSessionId;
    spokenIdsRef.current = new Set(
      initialMessages.filter((m) => m.role === 'assistant').map((m) => m.id),
    );
  }, [chatSessionId, initialMessages]);

  // ─── Speak each newly-seen assistant message ─────────────────────────
  useEffect(() => {
    for (const m of llmMessages) {
      if (m.role !== 'assistant' || !m.content) continue;
      if (spokenIdsRef.current.has(m.id)) continue;
      spokenIdsRef.current.add(m.id);
      setTtsActive((c) => c + 1);
      void speak(m.content).finally(() => setTtsActive((c) => Math.max(0, c - 1)));
    }
  }, [llmMessages]);

  // ─── Transcript → LLM (held until the session lands) ─────────────────
  const submitTurn = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming) return;
      if (!chatSessionId) {
        pendingTurnRef.current = trimmed;
        return;
      }
      void sendMessage(trimmed);
    },
    [chatSessionId, isStreaming, sendMessage],
  );

  useEffect(() => {
    if (!transcript || transcript === lastHandledTranscript.current) return;
    if (isListening) return;
    lastHandledTranscript.current = transcript;
    stopTTS();
    submitTurn(transcript);
    resetTranscript();
  }, [transcript, isListening, submitTurn, resetTranscript]);

  // Flush a held turn once the session is ready (sendMessage changes with it).
  useEffect(() => {
    if (!chatSessionId || !pendingTurnRef.current) return;
    const text = pendingTurnRef.current;
    pendingTurnRef.current = null;
    void sendMessage(text);
  }, [chatSessionId, sendMessage]);

  // ─── Error bubbles (no offline-parse fallback) ───────────────────────
  useEffect(() => {
    if (!llmError) return;
    if (llmError.message === lastLlmErrorRef.current) return;
    lastLlmErrorRef.current = llmError.message;
    setErrorBubbles((prev) => [
      ...prev,
      { id: `llm-error-${(errorSeqRef.current += 1)}`, role: 'ai', text: LLM_ERROR_TEXT },
    ]);
  }, [llmError]);

  useEffect(() => {
    if (!voiceError || voiceError === lastVoiceErrorRef.current) return;
    lastVoiceErrorRef.current = voiceError;
    setErrorBubbles((prev) => [
      ...prev,
      { id: `voice-error-${(errorSeqRef.current += 1)}`, role: 'ai', text: voiceError },
    ]);
  }, [voiceError]);

  // Session never landed → sendMessage silently no-ops; surface it so input isn't swallowed.
  useEffect(() => {
    if (sessionStatus !== 'error') return;
    setErrorBubbles((prev) =>
      prev.some((b) => b.id === 'session-error')
        ? prev
        : [...prev, { id: 'session-error', role: 'ai', text: SESSION_ERROR_TEXT }],
    );
  }, [sessionStatus]);

  useEffect(() => {
    let latestId: string | null = null;
    for (const m of llmMessages) if (m.role === 'assistant' && m.content) latestId = m.id;
    if (latestId === lastAssistantIdRef.current) return;
    lastAssistantIdRef.current = latestId;
    lastLlmErrorRef.current = '';
    lastVoiceErrorRef.current = '';
    setErrorBubbles((prev) => (prev.length ? [] : prev));
  }, [llmMessages]);

  // ─── Map LLM messages → overlay ChatMessage[]; error bubbles trail ───
  const messages = useMemo<ChatMessage[]>(() => {
    const out: ChatMessage[] = [];
    for (const m of llmMessages) {
      if ((m.role !== 'assistant' && m.role !== 'user') || !m.content) continue;
      const role: 'user' | 'ai' = m.role === 'assistant' ? 'ai' : 'user';
      out.push({
        id: m.id,
        role,
        text: m.content,
        habitCards: role === 'ai' ? buildHabitCards(m, dayOverrides) : undefined,
      });
    }
    return [...out, ...errorBubbles];
  }, [llmMessages, dayOverrides, errorBubbles]);

  // ─── Controls ────────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    stopTTS();
    lastHandledTranscript.current = '';
    resetTranscript();
    void start();
  }, [resetTranscript, start]);

  const stopListening = useCallback(() => {
    stop();
  }, [stop]);

  const sendText = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming) return;
      stopTTS();
      submitTurn(trimmed);
    },
    [isStreaming, submitTurn],
  );

  const updateHabitDays = useCallback((messageId: string, cardIndex: number, days: boolean[]) => {
    setDayOverrides((prev) => {
      const next = new Map(prev);
      next.set(`${messageId}:${cardIndex}`, days);
      return next;
    });
  }, []);

  return {
    messages,
    voiceState,
    speaking: isSpeaking || ttsActive > 0,
    startListening,
    stopListening,
    sendText,
    updateHabitDays,
  };
}
