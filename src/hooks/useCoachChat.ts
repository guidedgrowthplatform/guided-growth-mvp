import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isCheckinScreen, trackCheckinStarted } from '@/analytics/coachFunnel';
import { track } from '@/analytics/posthog';
import {
  BARGE_ECHO_GATE,
  BARGE_MIN_CHARS,
  BARGE_MIN_RMS,
  BARGE_REQUIRE_FINAL_FOR_LOW_ENERGY,
  FULL_DUPLEX_BARGE_IN,
  TURN_AGGREGATION_MS,
  TURN_PAUSE_COMPLETE_MS,
  TURN_PAUSE_INCOMPLETE_MS,
} from '@/config/voiceConfig';
import type { ReleaseToken, Surface } from '@/contexts/voiceContextDef';
import { useAudioUnlocked } from '@/hooks/useAudioUnlocked';
import { useChatHistory } from '@/hooks/useChatHistory';
import { useChatSession } from '@/hooks/useChatSession';
import { useCoachChatToolEvents } from '@/hooks/useCoachChatToolEvents';
import { useDualButtonControls } from '@/hooks/useDualButtonControls';
import { useLLM } from '@/hooks/useLLM';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { useVoice } from '@/hooks/useVoice';
import { useVoiceInCapture } from '@/hooks/useVoiceInCapture';
import {
  buildCheckinCard,
  buildHabitCards,
  messageHasHabitCompletion,
  messageHasTodayHabits,
} from '@/lib/chat/coachChatCards';
import type { ChatMessage, CoachChatApi, VoiceChatState } from '@/lib/chat/coachChatTypes';
import { nextSentenceChunks, flushSentenceTail } from '@/lib/services/sentenceChunks';
import { startKeyWarmLoop, stopKeyWarmLoop } from '@/lib/services/soniox-temp-key-cache';
import {
  beginSpeechTurn,
  endSpeechTurn,
  pushSpeechChunk,
  speak,
  stopTTS,
  useTtsPlaybackStore,
} from '@/lib/services/tts-service';
import { isSemanticEndOfTurn, resolveTurnPauseMs } from '@/lib/voice/turnDecision';
import { useAudioMetricsStore } from '@/stores/audioMetricsStore';
import { useVoiceStore } from '@/stores/voiceStore';
import type { CoachingStyle } from '@gg/shared/types/llm';

// Breath window before the mic goes hot (post-TTS and on first arm) — covers the
// echo tail + a Siri-style pause before listening resumes.
const MIC_GRACE_MS = 2500;

const LLM_ERROR_TEXT = "Something didn't work on my end. Mind trying that again?";
const TOOL_FAIL_TEXT = "I couldn't save that just now — want to try again?";
const SESSION_ERROR_TEXT = "Can't connect right now. Try reopening the chat.";

// One write session per user — anchors the coach's continuous memory across all
// screens. The per-turn screen_id stays real (sent on each /api/llm request).
const UNIFIED_SESSION_ID = 'COACH';

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
    initiateCheckinNonce?: number;
    overlayOpen?: boolean;
  },
): CoachChatApi {
  const surface = opts?.surface ?? 'chat';
  const coachingStyle = opts?.coachingStyle ?? 'warm';
  const enabled = opts?.enabled ?? true;
  const onTranscriptStream = opts?.onTranscriptStream;
  const initiateCheckinNonce = opts?.initiateCheckinNonce ?? 0;
  const overlayOpen = opts?.overlayOpen ?? true;

  const { preferences } = useUserPreferences();
  const voiceModeOn = preferences.voiceMode === 'voice';
  const audioReady = useAudioUnlocked();
  const { micOn } = useDualButtonControls();
  const setInterim = useVoiceStore((s) => s.setInterim);

  const { chatSessionId: writeSessionId, status: sessionStatus } = useChatSession(
    UNIFIED_SESSION_ID,
    { enabled, resume: true },
  );

  // Display = linear per-user timeline (first page seeds useLLM; older pages
  // prepend on scroll-up). Decoupled from the write session's anchor history.
  const {
    initialMessages,
    loadOlder: loadOlderPage,
    hasMore,
    loadingOlder,
    status: historyStatus,
  } = useChatHistory({ enabled });

  // Effective session id: gate everything (seed + sends + opener) until the
  // first history page genuinely loads. NOT on 'error' — an empty page from a
  // failed fetch would seed a blank timeline and persist a spurious welcome
  // over the user's real history (MR#1).
  const historyReady = historyStatus === 'ready';
  const chatSessionId = historyReady ? writeSessionId : null;

  const {
    sendMessage,
    sendOpener,
    prependMessages,
    messages: llmMessages,
    response: llmResponse,
    isStreaming,
    error: llmError,
    toolFailures,
    cancel: cancelLlm,
    regenerate,
  } = useLLM(screenId, {
    coachingStyle,
    chatSessionId: chatSessionId ?? undefined,
    initialMessages,
    inputMode: voiceModeOn ? 'voice' : 'text',
  });

  // Returns the count of genuinely-new rows prepended, so the view can release
  // the scroll anchor when an older page added nothing (MR#8).
  const loadOlder = useCallback(
    () => loadOlderPage().then(prependMessages),
    [loadOlderPage, prependMessages],
  );

  const { acquireRealtime, releaseToken, setStatus } = useVoice();
  const isSpeaking = useTtsPlaybackStore((s) => s.isSpeaking);
  // Mirror reactive state into refs so the stable Soniox callbacks below can read
  // it imperatively without churning their identity (which would re-sync the WS).
  const isStreamingRef = useRef(false);
  isStreamingRef.current = isStreaming;
  const isSpeakingRef = useRef(false);
  isSpeakingRef.current = isSpeaking;

  const lastCreatedItem = useCoachChatToolEvents(
    llmMessages,
    chatSessionId,
    initialMessages,
    screenId,
  );

  const tokenRef = useRef<ReleaseToken | null>(null);
  const pendingTurnRef = useRef<string | null>(null);
  const openerSentRef = useRef<string | null>(null);
  const initiateNonceRef = useRef(0);
  const spokenSeededForRef = useRef<string | null>(null);
  const spokenIdsRef = useRef<Set<string>>(new Set());
  const lastLlmErrorRef = useRef('');
  const lastVoiceErrorRef = useRef('');
  const errorSeqRef = useRef(0);
  const firedToolFailIdsRef = useRef<Set<string>>(new Set());
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
  // End-of-turn aggregation: buffer consecutive finals, flush as one turn
  // after a TURN_AGGREGATION_MS quiet gap (GitLab #209).
  const utteranceBufferRef = useRef('');
  const aggregationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Turn-taking instrumentation + resume detection (Phase 0 metrics).
  const finalsInTurnRef = useRef(0);
  const lastFinalAtRef = useRef(0);
  const awaitingResumeRef = useRef(false);
  const bargeFiredRef = useRef(false);
  // The adaptive pause the current flush timer was armed with (Phase 1).
  const lastArmedPauseRef = useRef(TURN_AGGREGATION_MS);
  // Reply-guarantee: owesResponseRef is set when we abort a reply mid-generation
  // (the coach owes a fresh one); regeneratedRef makes the recovery fire at most
  // once per barge so it can't loop.
  const owesResponseRef = useRef(false);
  const regeneratedRef = useRef(false);
  // Turn-aggregation window: utterance-end (flush → submit) → reply-start (stream begins).
  const turnSubmittedAtRef = useRef(0);

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
  // Barge-in: the instant the user starts a turn, stop the coach's TTS AND abort
  // the in-flight reply — NOT debounced, else the coach talks/computes over the
  // user for TURN_AGGREGATION_MS. cancelLlm() is a no-op when nothing is in
  // flight; aborting here is what the "single reconciliation" comment expects.
  // Flush the aggregated utterance as ONE turn once the quiet gap elapses.
  // Defined BEFORE interruptTts so a barge-in can arm a settle check through it.
  const flushUtterance = useCallback(() => {
    if (aggregationTimerRef.current) {
      clearTimeout(aggregationTimerRef.current);
      aggregationTimerRef.current = null;
    }
    const text = utteranceBufferRef.current.trim();
    utteranceBufferRef.current = '';
    const finalsMerged = finalsInTurnRef.current;
    const msSinceLastFinal = lastFinalAtRef.current ? Date.now() - lastFinalAtRef.current : 0;
    const pauseMs = lastArmedPauseRef.current;
    finalsInTurnRef.current = 0;
    awaitingResumeRef.current = false;
    if (!text) {
      // User went quiet after interrupting a reply (said nothing new) → guarantee
      // a response by regenerating the interrupted turn. Once per barge.
      if (owesResponseRef.current && !regeneratedRef.current) {
        owesResponseRef.current = false;
        regeneratedRef.current = true;
        void regenerate();
      }
      return;
    }
    owesResponseRef.current = false;
    regeneratedRef.current = false;
    const verdict = isSemanticEndOfTurn(text);
    track('coach_turn_completed', {
      pause_ms: pauseMs,
      verdict,
      decided_by: verdict === 'unsure' ? 'timeout' : 'semantic',
      finals_merged: finalsMerged,
      ms_since_last_final: msSinceLastFinal,
      text_len: text.length,
    });
    turnSubmittedAtRef.current = Date.now();
    submitTurnRef.current(text);
  }, [regenerate]);

  // Arm (or re-arm) the flush timer with an ADAPTIVE pause: shorter when the
  // buffered transcript sounds finished, longer when it sounds mid-thought, so a
  // trailing "and…" isn't cut off and a clear "I'm done." replies promptly.
  const armFlush = useCallback(() => {
    if (aggregationTimerRef.current) clearTimeout(aggregationTimerRef.current);
    const pauseMs = resolveTurnPauseMs(utteranceBufferRef.current, {
      base: TURN_AGGREGATION_MS,
      complete: TURN_PAUSE_COMPLETE_MS,
      incomplete: TURN_PAUSE_INCOMPLETE_MS,
    });
    lastArmedPauseRef.current = pauseMs;
    aggregationTimerRef.current = setTimeout(flushUtterance, pauseMs);
  }, [flushUtterance]);

  // Barge-in: the instant the user starts a turn, stop the coach's audio AND
  // abort the in-flight reply so the loading indicator clears immediately. The
  // reply-guarantee (owesResponseRef + the settle check in flushUtterance)
  // re-answers if the user adds nothing new, so aborting can't strand the coach.
  const interruptTts = useCallback(() => {
    if ((isStreamingRef.current || isSpeakingRef.current) && !bargeFiredRef.current) {
      bargeFiredRef.current = true;
      track('coach_barge_in', {
        during_playback: isSpeakingRef.current,
        was_streaming: isStreamingRef.current,
      });
    }
    // The coach owes a fresh reply if we cut one off mid-GENERATION or
    // mid-SPEECH (the user didn't hear all of it) — so the settle check below
    // re-answers if the user adds nothing new.
    if (isStreamingRef.current || isSpeakingRef.current) {
      owesResponseRef.current = true;
      // Fresh debt re-arms exactly one guaranteed reply for this barge.
      regeneratedRef.current = false;
    }
    cancelLlm();
    stopTTS();
    endCoachSpeechTurn();
    // Always schedule a settle check after a barge so the guarantee fires even if
    // no further speech arrives (rather than leaving the coach silent).
    if (!aggregationTimerRef.current) armFlush();
  }, [cancelLlm, endCoachSpeechTurn, armFlush]);

  // Own-voice echo gate: while the coach is audibly speaking, a low-energy
  // candidate is its own TTS leaking into a hot mic — drop it (don't barge,
  // buffer, or submit) so it can't self-interrupt. Real speech clears BARGE_MIN_RMS.
  const passesEchoGate = useCallback((text: string, isFinal: boolean) => {
    if (!BARGE_ECHO_GATE || !isSpeakingRef.current) return true;
    const rms = useAudioMetricsStore.getState().currentRms;
    if (rms >= BARGE_MIN_RMS) return true;
    if (BARGE_REQUIRE_FINAL_FOR_LOW_ENERGY && isFinal && text.trim().length >= BARGE_MIN_CHARS) {
      return true;
    }
    track('coach_barge_suppressed', { rms, text_len: text.trim().length, had_final: isFinal });
    return false;
  }, []);

  const handleSonioxFinal = useCallback(
    (t: string) => {
      if (!passesEchoGate(t, true)) return;
      // Clear interim AT THE MOMENT we route the final, so the user bubble
      // doesn't flicker between Soniox closing the socket and the message
      // bubble landing.
      setInterim('');
      onTranscriptStreamRef.current?.('user', t, 'final');
      interruptTts();
      utteranceBufferRef.current = utteranceBufferRef.current
        ? `${utteranceBufferRef.current} ${t}`
        : t;
      finalsInTurnRef.current += 1;
      lastFinalAtRef.current = Date.now();
      awaitingResumeRef.current = true;
      armFlush();
    },
    [setInterim, interruptTts, armFlush, passesEchoGate],
  );

  const handleSonioxInterim = useCallback(
    (t: string) => {
      if (!passesEchoGate(t, false)) return;
      setInterim(t);
      onTranscriptStreamRef.current?.('user', t, 'partial');
      // User still talking after a buffered final → restart the quiet timer so
      // we don't flush mid-thought. Always interrupt TTS immediately (barge-in).
      interruptTts();
      // Empty interims must not defer the flush forever — only real speech resets it.
      if (t.trim() && aggregationTimerRef.current) {
        // A buffered final was about to flush and the user kept going — record
        // the near-cutoff so we can measure how often the fixed pause is too short.
        if (awaitingResumeRef.current) {
          awaitingResumeRef.current = false;
          track('coach_turn_resumed', { buffered_len: utteranceBufferRef.current.length });
        }
        armFlush();
      }
    },
    [setInterim, interruptTts, armFlush, passesEchoGate],
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

  // Mute the mic during playback ONLY in half-duplex mode. With full-duplex the
  // mic stays hot so the user can barge in mid-reply; echo is handled by the
  // browser's AEC (best on headphones). Gates on isSpeaking (actual playback),
  // not the fetch window — else immediate user replies get swallowed.
  const micMutedForTts = !FULL_DUPLEX_BARGE_IN && voiceModeOn && isSpeaking;

  // Post-speech HOLD: mic stays muted MIC_GRACE_MS after playback ends —
  // covers echo tail + Siri-style breath before listening resumes.
  // Full-duplex never mutes for TTS, so skip the cold-start hold that would
  // otherwise swallow the first ~2.5s of an immediate opener.
  const [micMutedHeld, setMicMutedHeld] = useState(!FULL_DUPLEX_BARGE_IN);
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
      stopTTS();
      const t = tokenRef.current;
      if (t) {
        tokenRef.current = null;
        releaseToken(t);
      }
    };
  }, [releaseToken]);

  // ─── Explicit check-in initiation: coach leads the next turn regardless of
  // existing history. Fires exactly once per nonce bump (guard ref) and marks
  // this session's opener sent so the empty-welcome below never double-fires. ─
  useEffect(() => {
    if (!chatSessionId || initiateCheckinNonce <= 0) return;
    if (initiateNonceRef.current === initiateCheckinNonce) return;
    // defer until audio is unlocked so the spoken opener isn't lost on cold start
    if (voiceModeOn && !audioReady) return;
    initiateNonceRef.current = initiateCheckinNonce;
    openerSentRef.current = chatSessionId;
    if (isCheckinScreen(screenId)) trackCheckinStarted(screenId);
    void sendOpener();
  }, [chatSessionId, initiateCheckinNonce, screenId, sendOpener, voiceModeOn, audioReady]);

  // ─── First-ever open with a truly empty timeline → one welcome opener.
  // Returning users with history get NO auto-opener unless they explicitly
  // initiate a check-in (handled above). ───────────────────────────────
  useEffect(() => {
    // Only when the overlay is actually open — a mic-armed Home (no overlay)
    // must not silently persist a welcome turn (MR#4).
    if (!chatSessionId || !overlayOpen) return;
    // Dedicated check-in screens drive their opener ONLY through the nonce-gated
    // initiate path above (which respects once-per-day doneToday/initiatedToday).
    // This generic empty-timeline welcome is NOT so gated — letting it fire on
    // MCHECK-01/ECHECK-01 re-asks an already-started check-in on reopen (the
    // timeline is empty for users with no prior coach history). HOME-CHECKIN
    // (plain chat) keeps its welcome.
    if (screenId.startsWith('MCHECK') || screenId.startsWith('ECHECK')) return;
    if (openerSentRef.current === chatSessionId) return;
    if (initialMessages.length > 0) return;
    openerSentRef.current = chatSessionId;
    void sendOpener();
  }, [chatSessionId, initialMessages, sendOpener, overlayOpen, screenId]);

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
      if (turnSubmittedAtRef.current) {
        track('coach_turn_latency', {
          screen_id: screenId,
          aggregation_ms: Date.now() - turnSubmittedAtRef.current,
        });
        turnSubmittedAtRef.current = 0;
      }
      lastSpokenOffsetRef.current = 0;
      streamTurnActiveRef.current = false;
      streamedSomethingRef.current = false;
      // New coach turn → allow one barge-in event for it.
      bargeFiredRef.current = false;
      // Re-open the reply-guarantee in lockstep, else a later empty barge no-ops.
      regeneratedRef.current = false;
    }
    prevStreamingRef.current = isStreaming;

    if (!isStreaming || !voiceModeOn || !llmResponse) return;
    const { chunks, nextOffset } = nextSentenceChunks(llmResponse, lastSpokenOffsetRef.current);
    if (chunks.length === 0) return;
    if (!streamTurnActiveRef.current) {
      turnSeqRef.current += 1;
      beginSpeechTurn();
      streamTurnActiveRef.current = true;
      turnFinalizedRef.current = false;
      ttsBumpedRef.current = true;
      setTtsActive((c) => c + 1);
    }
    for (const c of chunks) pushSpeechChunk(c);
    lastSpokenOffsetRef.current = nextOffset;
    streamedSomethingRef.current = true;
  }, [isStreaming, llmResponse, voiceModeOn, screenId]);

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
  useEffect(() => {
    if (!onTranscriptStream) return;
    if (!isStreaming || llmResponse.length === 0) return;
    onTranscriptStream('assistant', llmResponse, 'partial');
  }, [isStreaming, llmResponse, onTranscriptStream]);

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
      if (!chatSessionId) {
        pendingTurnRef.current = pendingTurnRef.current
          ? `${pendingTurnRef.current} ${trimmed}`
          : trimmed;
        return;
      }
      if (isStreaming) {
        // A real new turn landed mid-reply: queue it, then abort the now-stale
        // reply so it doesn't linger. The flush effect below fires the queued
        // turn the instant the LLM goes idle — so a completed turn ALWAYS gets
        // an answer (clean interrupt, guaranteed response).
        pendingTurnRef.current = pendingTurnRef.current
          ? `${pendingTurnRef.current} ${trimmed}`
          : trimmed;
        cancelLlm();
        return;
      }
      void sendMessage(trimmed);
    },
    [chatSessionId, isStreaming, sendMessage, endCoachSpeechTurn, cancelLlm],
  );
  submitTurnRef.current = submitTurn;

  // Flush queued turn once the session is ready AND the LLM is idle.
  useEffect(() => {
    if (!chatSessionId || isStreaming || !pendingTurnRef.current) return;
    const text = pendingTurnRef.current;
    pendingTurnRef.current = null;
    void sendMessage(text);
  }, [chatSessionId, isStreaming, sendMessage]);

  // Drop the aggregation timer on unmount / session end — no leaked timer, no
  // flush-after-unmount.
  useEffect(() => {
    if (voiceInActive) return;
    if (aggregationTimerRef.current) {
      clearTimeout(aggregationTimerRef.current);
      aggregationTimerRef.current = null;
    }
    utteranceBufferRef.current = '';
  }, [voiceInActive]);
  useEffect(
    () => () => {
      if (aggregationTimerRef.current) clearTimeout(aggregationTimerRef.current);
    },
    [],
  );

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

  // Failed write tool → deterministic in-thread signal, so a model that doesn't
  // relay the ok:false can't present a silent failure as success (RC-3).
  useEffect(() => {
    if (toolFailures.length === 0) return;
    const fresh = toolFailures.filter((f) => !firedToolFailIdsRef.current.has(f.id));
    if (fresh.length === 0) return;
    fresh.forEach((f) => firedToolFailIdsRef.current.add(f.id));
    setErrorBubbles((prev) => [
      ...prev,
      { id: `tool-fail-${(errorSeqRef.current += 1)}`, role: 'ai', text: TOOL_FAIL_TEXT },
    ]);
  }, [toolFailures]);

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
        habitReport:
          role === 'ai' ? messageHasHabitCompletion(m) || messageHasTodayHabits(m) : undefined,
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
    micListening: isListening,
    startListening,
    stopListening,
    sendText,
    updateHabitDays,
    lastCreatedItem,
    loadOlder,
    hasMore,
    loadingOlder,
  };
}
