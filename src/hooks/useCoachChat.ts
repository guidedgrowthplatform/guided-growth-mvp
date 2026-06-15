import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isCheckinScreen, trackCheckinStarted } from '@/analytics/coachFunnel';
import type { ReleaseToken, Surface } from '@/contexts/voiceContextDef';
import { useChatSession } from '@/hooks/useChatSession';
import { useCoachChatToolEvents } from '@/hooks/useCoachChatToolEvents';
import { useDualButtonControls } from '@/hooks/useDualButtonControls';
import { useLLM } from '@/hooks/useLLM';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { useVoice } from '@/hooks/useVoice';
import { useVoiceInCapture } from '@/hooks/useVoiceInCapture';
import { buildCheckinCard, buildHabitCards } from '@/lib/chat/coachChatCards';
import type { ChatMessage, CoachChatApi, VoiceChatState } from '@/lib/chat/coachChatTypes';
import { startTokenWarmLoop, stopTokenWarmLoop } from '@/lib/services/cartesia-token-cache';
import { nextSentenceChunks, flushSentenceTail } from '@/lib/services/sentenceChunks';
import { startKeyWarmLoop, stopKeyWarmLoop } from '@/lib/services/soniox-temp-key-cache';
import {
  beginSpeechTurn,
  endSpeechTurn,
  isWsTransport,
  pushSpeechChunk,
  speak,
  stopTTS,
  ttsKaraokeActive,
  ttsWarm,
  useTtsPlaybackStore,
} from '@/lib/services/tts-service';
import { useVoiceStore } from '@/stores/voiceStore';
import type { CoachingStyle } from '@gg/shared/types/llm';

// Breath window before the mic goes hot (post-TTS and on first arm).
// Mirrors VAD_SILENCE_CLOSE_MS in soniox-stream.ts.
const MIC_GRACE_MS = 2500;

const LLM_ERROR_TEXT = "Something didn't work on my end. Mind trying that again?";
const SESSION_ERROR_TEXT = "Can't connect right now. Try reopening the chat.";

// Reusable post-onboarding coach conversation. Screen-parameterized so it can
// mount on any screen; the tools the LLM gets are decided server-side per screenId.
//
// onTranscriptStream (optional): provider-side hook for broadcasting streaming
// partials + finals (both user-side from Soniox and assistant-side from LLM)
// to a transcript bus so the subtitle bar can show live activity outside the
// overlay.
export function useCoachChat(
  screenId: string,
  opts?: {
    surface?: Surface;
    coachingStyle?: CoachingStyle;
    enabled?: boolean;
    onTranscriptStream?: (
      role: 'user' | 'assistant',
      text: string,
      kind: 'partial' | 'final',
    ) => void;
  },
): CoachChatApi {
  const surface = opts?.surface ?? 'chat';
  const coachingStyle = opts?.coachingStyle ?? 'warm';
  const enabled = opts?.enabled ?? true;
  const onTranscriptStream = opts?.onTranscriptStream;

  const { preferences } = useUserPreferences();
  const voiceModeOn = preferences.voiceMode === 'voice';
  const { micOn } = useDualButtonControls();
  const setInterim = useVoiceStore((s) => s.setInterim);

  const {
    chatSessionId,
    initialMessages,
    status: sessionStatus,
  } = useChatSession(screenId, { enabled, resume: true });
  const {
    sendMessage,
    sendOpener,
    messages: llmMessages,
    response: llmResponse,
    isStreaming,
    error: llmError,
  } = useLLM(screenId, {
    coachingStyle,
    chatSessionId: chatSessionId ?? undefined,
    initialMessages,
  });

  const { acquireRealtime, releaseToken, setStatus } = useVoice();
  const isSpeaking = useTtsPlaybackStore((s) => s.isSpeaking);

  const lastCreatedItem = useCoachChatToolEvents(llmMessages, chatSessionId, initialMessages);

  const tokenRef = useRef<ReleaseToken | null>(null);
  const pendingTurnRef = useRef<string | null>(null);
  const openerSentRef = useRef<string | null>(null);
  const startCheckinFiredRef = useRef<string | null>(null);
  const spokenSeededForRef = useRef<string | null>(null);
  const spokenIdsRef = useRef<Set<string>>(new Set());
  const lastLlmErrorRef = useRef('');
  const lastVoiceErrorRef = useRef('');
  const errorSeqRef = useRef(0);
  const lastAssistantIdRef = useRef<string | null>(null);
  // Stream-chunked TTS: offset into the current reply, and per-turn flags.
  const lastSpokenOffsetRef = useRef(0);
  const streamTurnActiveRef = useRef(false);
  const streamedSomethingRef = useRef(false);
  const ttsBumpedRef = useRef(false);
  const prevStreamingRef = useRef(false);
  const turnFinalizedRef = useRef(true);
  const turnSeqRef = useRef(0);
  // Stable identity for the streaming Soniox session callbacks so
  // useVoiceInCapture's WebSocket lifecycle doesn't churn each render.
  const submitTurnRef = useRef<(text: string) => void>(() => undefined);

  const [dayOverrides, setDayOverrides] = useState<Map<string, boolean[]>>(() => new Map());
  const [errorBubbles, setErrorBubbles] = useState<ChatMessage[]>([]);
  // >0 from speak() dispatch until playback ends — closes the gap where the TTS
  // store's isSpeaking flips async (fetch latency) and the channel would release early.
  const [ttsActive, setTtsActive] = useState(0);

  // Single reconciliation for a chunked turn — runs on normal completion AND on
  // barge-in (where the LLM aborts and the final-message effect never fires).
  const endCoachSpeechTurn = useCallback(() => {
    if (ttsBumpedRef.current) {
      ttsBumpedRef.current = false;
      setTtsActive((c) => Math.max(0, c - 1));
    }
    streamTurnActiveRef.current = false;
    streamedSomethingRef.current = false;
    lastSpokenOffsetRef.current = 0;
    turnFinalizedRef.current = true;
  }, []);

  // Streaming Soniox: mic toggle drives `active`; partials → useVoiceStore.interim
  // (overlay's user bubble reads it); finals → submitTurnRef → LLM. `responding`
  // true = 'responding' state, frames silently dropped (soniox-stream.ts
  // feedAudio()) — used here to mute the mic while TTS plays.
  const handleVoiceError = useCallback((msg: string) => {
    if (msg === lastVoiceErrorRef.current) return;
    lastVoiceErrorRef.current = msg;
    setErrorBubbles((prev) => [
      ...prev,
      { id: `voice-error-${(errorSeqRef.current += 1)}`, role: 'ai', text: msg },
    ]);
  }, []);

  // Sync the latest onTranscriptStream into a ref via effect (NOT during
  // render — render-phase mutations are unsafe and can race with effect-phase
  // callback invocations from the Soniox session).
  const onTranscriptStreamRef = useRef(onTranscriptStream);
  useEffect(() => {
    onTranscriptStreamRef.current = onTranscriptStream;
  }, [onTranscriptStream]);

  // Stable callback identities so useVoiceInCapture's ref-update effects
  // don't churn every render of useCoachChat. The handlers read fresh state
  // via the refs declared above.
  const handleSonioxFinal = useCallback(
    (t: string) => {
      // Clear interim AT THE MOMENT we route the final, so the user bubble
      // doesn't flicker between Soniox closing the socket and the message
      // bubble landing.
      setInterim('');
      onTranscriptStreamRef.current?.('user', t, 'final');
      submitTurnRef.current(t);
    },
    [setInterim],
  );

  const handleSonioxInterim = useCallback(
    (t: string) => {
      setInterim(t);
      onTranscriptStreamRef.current?.('user', t, 'partial');
    },
    [setInterim],
  );

  // Match onboarding's voice-in setup EXACTLY:
  //   1. Static preference-based gate (`micOn`) — never churns on transient
  //      state like TTS playback. A churning gate tears down the Soniox WS
  //      every TTS turn and loses audio frames during the rebuild window.
  //   2. `startKeyWarmLoop()` — pre-fetches Soniox temp keys so the WS
  //      handshake doesn't wait on a 500-1500ms key mint. Without this,
  //      cold-mint latency lets the VAD silence timer kill the connection
  //      before it reaches 'listening' → only partial transcripts arrive.
  //   3. `vapiStatus: 'idle'` (coach has no Vapi).
  const voiceInActive = micOn;

  // Half-duplex mute: gate on isSpeaking (actual playback), not the fetch
  // window — else immediate user replies get swallowed.
  const micMutedForTts = voiceModeOn && isSpeaking;

  // Post-speech HOLD: mic stays muted MIC_GRACE_MS after playback ends —
  // covers echo tail + Siri-style breath before listening resumes.
  // Initial true: same grace on first arm, so the session doesn't open hot.
  const [micMutedHeld, setMicMutedHeld] = useState(true);
  useEffect(() => {
    if (micMutedForTts) {
      setMicMutedHeld(true);
      return;
    }
    const t = setTimeout(() => setMicMutedHeld(false), MIC_GRACE_MS);
    return () => clearTimeout(t);
  }, [micMutedForTts]);

  const { isListening } = useVoiceInCapture({
    active: voiceInActive,
    vapiStatus: 'idle',
    onTranscript: handleSonioxFinal,
    onInterim: handleSonioxInterim,
    responding: micMutedForTts || micMutedHeld,
    onError: handleVoiceError,
  });

  // Warm the temp-key cache whenever voice-in is armed. Mirrors onboarding
  // line 698-702 of OnboardingVoiceProvider — this is the single biggest
  // reliability win, since each utterance's WebSocket open would otherwise
  // pay the full key-mint latency from cold.
  useEffect(() => {
    if (!voiceInActive) return;
    startKeyWarmLoop();
    return () => stopKeyWarmLoop();
  }, [voiceInActive]);

  // Warm the Cartesia token + open the ws socket while voice-out is on, so the
  // first coach reply pays no token-mint or connect latency.
  useEffect(() => {
    if (!voiceModeOn || !isWsTransport()) return;
    startTokenWarmLoop();
    ttsWarm();
    return () => stopTokenWarmLoop();
  }, [voiceModeOn]);

  // Clear interim immediately when Soniox finalizes the turn (inside
  // handleSonioxFinal) — NOT reactively on `isListening` flipping, which
  // caused user text to flash-disappear before the final reached the LLM.

  const voiceState: VoiceChatState =
    isStreaming || sessionStatus === 'loading' ? 'processing' : isListening ? 'listening' : 'idle';

  // ─── Voice channel token: acquire on listening, reflect phase ────────
  useEffect(() => {
    // Speaking wins: in both-on, isListening stays true through playback.
    if ((isSpeaking || ttsActive > 0) && tokenRef.current) {
      setStatus(tokenRef.current, 'speaking');
    } else if (voiceState === 'listening') {
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

  // ─── Funnel: opening the coach chat on a check-in screen = start_checkin ──
  useEffect(() => {
    if (!chatSessionId || !isCheckinScreen(screenId)) return;
    if (startCheckinFiredRef.current === chatSessionId) return;
    startCheckinFiredRef.current = chatSessionId;
    if (initialMessages.length > 0) return; // resumed thread — already started earlier
    trackCheckinStarted(screenId);
  }, [chatSessionId, screenId, initialMessages]);

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

  // ─── Stream-chunked TTS: speak each completed sentence as it streams ──
  useEffect(() => {
    if (isStreaming && !prevStreamingRef.current) {
      lastSpokenOffsetRef.current = 0;
      streamTurnActiveRef.current = false;
      streamedSomethingRef.current = false;
    }
    prevStreamingRef.current = isStreaming;

    if (!isStreaming || !voiceModeOn || !llmResponse) return;
    const { chunks, nextOffset } = nextSentenceChunks(llmResponse, lastSpokenOffsetRef.current);
    if (chunks.length === 0) return;
    if (!streamTurnActiveRef.current) {
      turnSeqRef.current += 1;
      beginSpeechTurn({ onReveal: (t) => onTranscriptStream?.('assistant', t, 'partial') });
      streamTurnActiveRef.current = true;
      turnFinalizedRef.current = false;
      ttsBumpedRef.current = true;
      setTtsActive((c) => c + 1);
    }
    for (const c of chunks) pushSpeechChunk(c);
    lastSpokenOffsetRef.current = nextOffset;
    streamedSomethingRef.current = true;
  }, [isStreaming, llmResponse, voiceModeOn, onTranscriptStream]);

  // ─── Final message: emit to bus; speak the tail (chunked) or whole (one-shot) ─
  // State-4 "opening line only" is applied in CoachSubtitleBar, not here —
  // the overlay's streaming bubble reads this same bus.
  useEffect(() => {
    for (const m of llmMessages) {
      if (m.role !== 'assistant' || !m.content) continue;
      if (spokenIdsRef.current.has(m.id)) continue;
      spokenIdsRef.current.add(m.id);
      // screen/text mode: mark seen but stay silent — no backlog when voice re-enables
      if (!voiceModeOn) {
        onTranscriptStream?.('assistant', m.content, 'final');
        continue;
      }
      if (streamedSomethingRef.current) {
        streamedSomethingRef.current = false;
        turnFinalizedRef.current = true;
        const tail = flushSentenceTail(m.content, lastSpokenOffsetRef.current);
        if (tail) pushSpeechChunk(tail);
        const content = m.content;
        const seq = turnSeqRef.current;
        void endSpeechTurn().finally(() => {
          endCoachSpeechTurn();
          if (turnSeqRef.current === seq) {
            onTranscriptStreamRef.current?.('assistant', content, 'final');
          }
        });
      } else {
        onTranscriptStream?.('assistant', m.content, 'final');
        setTtsActive((c) => c + 1);
        void speak(m.content).finally(() => setTtsActive((c) => Math.max(0, c - 1)));
      }
    }
  }, [llmMessages, voiceModeOn, onTranscriptStream, endCoachSpeechTurn]);

  // Stream ended with no final message (abort/tool-only) — seal so ttsActive
  // doesn't stay stuck. After the final-message effect (which marks finalized).
  useEffect(() => {
    if (isStreaming || !streamTurnActiveRef.current || turnFinalizedRef.current) return;
    turnFinalizedRef.current = true;
    streamedSomethingRef.current = false;
    void endSpeechTurn().finally(endCoachSpeechTurn);
  }, [isStreaming, llmMessages, endCoachSpeechTurn]);

  // Live partial stream → transcript bus (subtitle renders typing in real time).
  // Karaoke turns drive the partial off audio timing (beginSpeechTurn onReveal),
  // so skip the full-text push to keep text paced with speech.
  useEffect(() => {
    if (!onTranscriptStream) return;
    if (!isStreaming || llmResponse.length === 0) return;
    if (voiceModeOn && ttsKaraokeActive()) return;
    onTranscriptStream('assistant', llmResponse, 'partial');
  }, [isStreaming, llmResponse, onTranscriptStream, voiceModeOn]);

  // ─── Transcript → LLM (queued while busy, flushed when free) ──────────
  // Streaming Soniox can land multiple finals during a single LLM turn. The
  // old `if (isStreaming) return` guard silently dropped the second utterance.
  // Now we hold it in pendingTurnRef and flush as soon as the LLM is idle.
  const submitTurn = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      stopTTS();
      endCoachSpeechTurn();
      if (!chatSessionId || isStreaming) {
        pendingTurnRef.current = pendingTurnRef.current
          ? `${pendingTurnRef.current} ${trimmed}`
          : trimmed;
        return;
      }
      void sendMessage(trimmed);
    },
    [chatSessionId, isStreaming, sendMessage, endCoachSpeechTurn],
  );
  submitTurnRef.current = submitTurn;

  // Flush queued turn once the session is ready AND the LLM is idle.
  useEffect(() => {
    if (!chatSessionId || isStreaming || !pendingTurnRef.current) return;
    const text = pendingTurnRef.current;
    pendingTurnRef.current = null;
    void sendMessage(text);
  }, [chatSessionId, isStreaming, sendMessage]);

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
        checkinCard: role === 'ai' ? buildCheckinCard(m) : undefined,
      });
    }
    return [...out, ...errorBubbles];
  }, [llmMessages, dayOverrides, errorBubbles]);

  // ─── Controls ────────────────────────────────────────────────────────
  // Mic lifecycle is now driven inside useVoiceInCapture via the `active`
  // flag (=micOn). These remain in the API for backwards compat with
  // CoachChatView but the toggle is the dual-button orb.
  const startListening = useCallback(() => {
    stopTTS();
    endCoachSpeechTurn();
  }, [endCoachSpeechTurn]);

  const stopListening = useCallback(() => {
    // no-op — orb's right half drives the mic
  }, []);

  const sendText = useCallback(
    (text: string) => {
      stopTTS();
      submitTurn(text);
    },
    [submitTurn],
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
    lastCreatedItem,
  };
}
