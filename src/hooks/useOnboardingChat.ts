import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { fetchScreenRoutes } from '@/api/context';
import {
  getOnboardingOpener,
  getOnboardingRevisitOpener,
} from '@/components/onboarding/onboardingOpeners';
import type { OnboardingVoiceResult, VoiceMessage } from '@/contexts/useOnboardingVoiceSession';
import { useChatToolEvents } from '@/hooks/useChatToolEvents';
import { useLLM } from '@/hooks/useLLM';
import { useOnboardingChatSession } from '@/hooks/useOnboardingChatSession';
import { cardForScreenId } from '@/lib/onboarding/onboardingChatCards';
import type { OnboardingCard } from '@/lib/onboarding/onboardingChatTypes';
import { ADVANCING_TOOL_NAMES } from '@/lib/onboarding/onboardingStepBeats';
import { STATIC_FEED_MODE } from '@/lib/onboarding/staticFeed';
import type { OrbState } from '@/lib/orb/orbState';
import { routeOrbSend } from '@/lib/orb/routeOrbSend';
import { queryKeys } from '@/lib/query';
import { flushSentenceTail, nextSentenceChunks } from '@/lib/services/sentenceChunks';
import {
  beginSpeechTurn,
  endSpeechTurn,
  pushSpeechChunk,
  speak,
  stopTTS,
  ttsKaraokeActive,
  useTtsPlaybackStore,
} from '@/lib/services/tts-service';
import { detectAffirmation } from '@gg/shared/onboarding/detectAffirmation';
import type { OnboardingState } from '@gg/shared/types';
import type { CoachingStyle } from '@gg/shared/types/llm';

// Safety net for a stalled voice-out turn: a Cartesia ws turn can connect but
// never drain (no audio, no `done`/error), so endSpeechTurn() hangs forever and
// the assistant bubble — deferred to end-of-speech — never lands. The reply is
// still persisted (shows on refresh), but live it goes silent. Poll playback;
// once it has stayed idle through the grace window, land the bubble anyway.
const TTS_LAND_POLL_MS = 500;
const TTS_LAND_GRACE_TICKS = 6; // ~3s of continuous playback silence
const TTS_LAND_MAX_TICKS = 120; // ~60s hard ceiling, even if isSpeaking sticks

export interface UseOnboardingChatArgs {
  screenId: string | null;
  enabled: boolean;
  orbState: OrbState;
  coachingStyle: CoachingStyle;
  appendMessage: (msg: VoiceMessage) => void;
  startThread: (
    screenId: string,
    initial: VoiceMessage[],
    mode?: 'replace' | 'append-if-empty' | 'append',
  ) => void;
  // Push assistant text onto the transcript bus (subtitle bar + overlay render).
  emitAssistant: (text: string, kind: 'partial' | 'final') => void;
  onVoiceAction: (result: OnboardingVoiceResult) => void;
  onAdvance: () => void;
  // Single-screen chat page — navigate_next advances the beat in place.
  chatNative?: boolean;
  // Speak assistant replies aloud (Cartesia TTS). Driven by the voice-out button,
  // independent of mic — so full-duplex (voice-out + voice-in) speaks too.
  speakReplies?: boolean;
  // True if the beat's screen already has dialogue in the shared feed (e.g. Vapi
  // spoke its opener). Used to suppress a duplicate Direct-LLM opener when this
  // hook takes over a beat mid-flow.
  hasExistingTurn?: (screenId: string) => boolean;
}

export interface UseOnboardingChatReturn {
  sendUserTurn: (text: string) => void;
  // Low-frequency: flips at most twice per turn (start/end) — safe in context value.
  chatBusy: boolean;
  // Barge-in: cut the coach's audio + abort the in-flight reply the instant the
  // user starts speaking (full-duplex, mirrors useCoachChat.interruptTts).
  interrupt: () => void;
  // Re-answer the last turn (or re-open) after a barge-in that produced no real
  // user turn — echo/noise cancels the reply, this guarantees it comes back.
  regenerate: () => void;
}

// Owns the Direct-LLM onboarding chat (Path 3) lifted out of the overlay so a
// voice-in final reaches the LLM whether the overlay is open or closed.
export function useOnboardingChat({
  screenId,
  enabled,
  orbState,
  coachingStyle,
  appendMessage,
  startThread,
  emitAssistant,
  onVoiceAction,
  onAdvance,
  chatNative,
  speakReplies = false,
  hasExistingTurn,
}: UseOnboardingChatArgs): UseOnboardingChatReturn {
  const qc = useQueryClient();
  const isOnboardingScreen = (screenId ?? '').startsWith('ONBOARD-');

  const { chatSessionId, initialMessages, useStableSession, historyMessages, historyLoaded } =
    useOnboardingChatSession(screenId ?? '', enabled, isOnboardingScreen);
  const llm = useLLM(screenId ?? '', {
    coachingStyle,
    chatSessionId: chatSessionId ?? undefined,
    initialMessages,
    // text_only orb = typing; every other orb state speaks the reply aloud.
    inputMode: orbState === 'text_only' ? 'text' : 'voice',
  });

  const { data: routesData } = useQuery({
    queryKey: ['screenRoutes'],
    queryFn: fetchScreenRoutes,
    staleTime: 5 * 60 * 1000,
    enabled,
  });

  // Per-screen dedup/seed state — reset on screen change (no key= remount here).
  const mirroredIdsRef = useRef<Set<string>>(new Set());
  const lastLlmErrorRef = useRef<string>('');
  const openerSeededRef = useRef<string | null>(null);
  const streamActiveRef = useRef(false);
  const landedCompleteRef = useRef(false);
  // First voice-in final can arrive before the chat session lands — hold it.
  const pendingTurnRef = useRef<string | null>(null);
  // Stable read inside the screen-change effect (kept out of its dep array).
  const useStableSessionRef = useRef(useStableSession);
  useStableSessionRef.current = useStableSession;
  // Monotonic — globally-unique opener ids so revisits never collide React keys.
  const visitCounterRef = useRef(0);
  // Chat-native: the beat's card is attached to the LLM-streamed opener message
  // (the opener is rendered by the LLM verbatim, not seeded). Holds the card
  // until that first assistant turn lands (or the error fallback fires).
  const openerCardRef = useRef<{ screenId: string; card: OnboardingCard } | null>(null);
  const screenIdRef = useRef(screenId);
  screenIdRef.current = screenId;
  // A beat that advances mid-stream (a beat-completing tool fires while the
  // coach is still streaming) changes screenId before the prior stream drains.
  // sendOpener no-ops against an in-flight stream, so the next beat's opener
  // would never fire — hold it here and flush once the stream settles.
  const pendingOpenerRef = useRef<string | null>(null);
  // Rehydration (stable session): seed the persisted thread once per session id,
  // and remember which beats it covered so their openers aren't re-streamed
  // (duplicate bubble). Keyed by session id so a user switch re-rehydrates.
  const rehydratedSessionRef = useRef<string | null>(null);
  const rehydratedScreenIdsRef = useRef<Set<string>>(new Set());

  // Latest values via refs so sendUserTurn stays stable (no context-value churn).
  const onAdvanceRef = useRef(onAdvance);
  onAdvanceRef.current = onAdvance;
  const orbStateRef = useRef(orbState);
  orbStateRef.current = orbState;
  const speakRepliesRef = useRef(speakReplies);
  speakRepliesRef.current = speakReplies;
  const hasExistingTurnRef = useRef(hasExistingTurn);
  hasExistingTurnRef.current = hasExistingTurn;
  const llmRef = useRef(llm);
  llmRef.current = llm;
  const chatSessionIdRef = useRef(chatSessionId);
  chatSessionIdRef.current = chatSessionId;
  const suppressTrailingRef = useRef(false);

  // Stream-chunked TTS (mirrors useCoachChat): speak each completed sentence as
  // it streams and pace the on-screen text off audio timing (karaoke reveal), so
  // the coach's voice stays in sync with the text instead of trailing a one-shot.
  const lastSpokenOffsetRef = useRef(0);
  const streamTurnActiveRef = useRef(false);
  const streamedSomethingRef = useRef(false);
  const prevStreamingRef = useRef(false);
  const turnFinalizedRef = useRef(true);
  const turnSeqRef = useRef(0);
  const resetSpeechTurn = useCallback(() => {
    streamTurnActiveRef.current = false;
    streamedSomethingRef.current = false;
    lastSpokenOffsetRef.current = 0;
    turnFinalizedRef.current = true;
  }, []);

  const startStream = useCallback((text: string) => {
    suppressTrailingRef.current = false;
    streamActiveRef.current = true;
    void llmRef.current.sendMessage(text);
  }, []);

  // Fire the beat's opener now, or hold it until the in-flight stream drains.
  const fireOrDeferOpener = useCallback((sid: string) => {
    if (llmRef.current.isStreaming) {
      pendingOpenerRef.current = sid;
      return;
    }
    pendingOpenerRef.current = null;
    streamActiveRef.current = true;
    void llmRef.current.sendOpener();
  }, []);

  // Barge-in: stop the coach's TTS and abort any in-flight reply. cancel() is a
  // no-op when nothing is streaming; stopTTS() a no-op when nothing is playing.
  const interrupt = useCallback(() => {
    stopTTS();
    // stopTTS already tore down the ws turn — reset flags synchronously so a
    // stale endSpeechTurn/seal can't fire against the next turn (mirrors
    // useCoachChat.interruptTts → endCoachSpeechTurn).
    resetSpeechTurn();
    llmRef.current.cancel();
  }, [resetSpeechTurn]);

  // Re-answer the interrupted turn without re-adding the user message (reuses its
  // id) — or re-open if the opener itself was cut. Mirrors useCoachChat's
  // owesResponse settle-check recovery so an echo-triggered barge never strands
  // the coach in silence.
  const regenerate = useCallback(() => {
    suppressTrailingRef.current = false;
    streamActiveRef.current = true;
    void llmRef.current.regenerate();
  }, []);

  // Rehydrate the persisted thread once the history fetch settles (chat-native
  // stable session only). Each restored turn carries its beat's screen_id so the
  // feed groups it correctly; cards aren't persisted — BeatFeed redraws those
  // from state. Display only; LLM memory is server-side via response-chaining.
  useEffect(() => {
    if (!enabled || !chatNative || !useStableSession || !historyLoaded || !chatSessionId) return;
    if (rehydratedSessionRef.current === chatSessionId) return;
    rehydratedSessionRef.current = chatSessionId;
    rehydratedScreenIdsRef.current = new Set();
    for (const m of historyMessages) {
      if (m.screenId) rehydratedScreenIdsRef.current.add(m.screenId);
      if (!m.content) continue;
      appendMessage({
        id: `hist-${m.id}`,
        role: m.role === 'user' ? 'user' : 'ai',
        text: m.content,
        ...(m.screenId ? { screenId: m.screenId } : {}),
      });
    }
  }, [
    enabled,
    chatNative,
    useStableSession,
    historyLoaded,
    historyMessages,
    appendMessage,
    chatSessionId,
  ]);

  // Seed the opener when the screen changes. Stable session → continuous thread
  // (append opener, keep prior turns); legacy → per-screen wipe (reset + replace).
  useEffect(() => {
    if (STATIC_FEED_MODE && chatNative) return;
    if (!enabled || !screenId || !isOnboardingScreen) return;
    // Wait for the persisted thread before deciding to fire — else a fresh opener
    // stream duplicates the restored one for the current beat.
    if (chatNative && useStableSessionRef.current && !historyLoaded) return;
    if (openerSeededRef.current === screenId) return;
    openerSeededRef.current = screenId;
    const stable = useStableSessionRef.current;
    if (!stable) mirroredIdsRef.current = new Set();
    lastLlmErrorRef.current = '';
    pendingTurnRef.current = null;
    streamActiveRef.current = false;
    suppressTrailingRef.current = true;
    if (!stable) llm.reset();

    const onboardingState =
      qc.getQueryData<OnboardingState | null>(queryKeys.onboarding.state) ?? null;
    const revisit = getOnboardingRevisitOpener(screenId, onboardingState);
    landedCompleteRef.current = revisit?.complete === true;
    const opener = revisit?.text ?? getOnboardingOpener(screenId);
    // Chat-native page: attach this beat's inline card to its opener message so
    // it renders at the turn and freezes in scrollback when the flow advances.
    const card = chatNative ? cardForScreenId(screenId, onboardingState) : null;
    const cards = card ? [card] : undefined;

    if (chatNative) {
      if (!stable) llm.reset();
      // Restored beat → its opener + turns are already in the thread; don't
      // re-stream the opener (would duplicate the bubble).
      if (rehydratedScreenIdsRef.current.has(screenId)) {
        suppressTrailingRef.current = false;
        openerCardRef.current = null;
        return;
      }
      // Another engine (Vapi) already delivered this beat's opener → don't restream
      // it when Direct-LLM takes over mid-beat (e.g. user toggled voice off).
      if (hasExistingTurnRef.current?.(screenId)) {
        suppressTrailingRef.current = false;
        openerCardRef.current = null;
        return;
      }
      if (opener) {
        // The OPENER is rendered by the LLM verbatim (server-scripted), the same
        // way the home check-in fires sendOpener — NOT seeded as hardcoded text.
        // The card attaches to the streamed opener turn (openerCardRef); on any
        // failure the error effect degrades to the authored line + card.
        suppressTrailingRef.current = false;
        openerCardRef.current = card ? { screenId, card } : null;
        // Chat-native is ONE continuous feed — always append so every prior beat
        // stays scrollable; never wipe (only auth is hidden, by the page).
        startThread(screenId, [], 'append');
        // Defer if a prior turn is still streaming (the data tool that just
        // advanced the beat) — else sendOpener no-ops and the opener is lost.
        fireOrDeferOpener(screenId);
      } else {
        // No authored line (auth gate / sub-screens) → don't seed the chat thread.
        // The synchronous StaticFeed fallback (page renders it while `messages` is
        // empty) draws the card and handles the auth gate's authed-hide. Seeding
        // the auth card into the thread would leave it stranded in scrollback.
        suppressTrailingRef.current = true;
        openerCardRef.current = null;
      }
      return;
    }

    // Legacy overlay (non-chat-native): hardcoded opener seed, unchanged.
    if (stable) {
      const openerId = `opener-${screenId}-${visitCounterRef.current++}`;
      startThread(
        screenId,
        opener ? [{ id: openerId, role: 'ai', text: opener, cards }] : [],
        'append',
      );
    } else {
      startThread(
        screenId,
        opener ? [{ id: `opener-${screenId}`, role: 'ai', text: opener, cards }] : [],
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, screenId, isOnboardingScreen, startThread, qc, chatNative, historyLoaded]);

  // Vapi takeover: abort any in-flight Direct-LLM stream so it can't collide
  // with Vapi's opening turn. (Disabling for other reasons — e.g. mic drop —
  // deliberately does NOT abort: the streamActiveRef latch lets an in-flight tool
  // dispatch like advance_step still land.)
  useEffect(() => {
    if (orbState === 'vapi') llmRef.current.cancel();
  }, [orbState]);

  // Stop in-flight TTS when voice-out is off, or on Vapi takeover (Vapi speaks).
  useEffect(() => {
    if (!speakReplies || orbState === 'vapi') stopTTS();
  }, [speakReplies, orbState]);

  // Flush a held voice-in turn once the session is ready AND the LLM is idle.
  // sendMessage no-ops while a stream is in flight, so a turn that landed
  // mid-reply (barge-in queued it) must wait for the abort to settle.
  useEffect(() => {
    if (!chatSessionId || llm.isStreaming || !pendingTurnRef.current) return;
    const text = pendingTurnRef.current;
    pendingTurnRef.current = null;
    startStream(text);
  }, [chatSessionId, llm.isStreaming, startStream]);

  // Flush a held opener once the prior (beat-advancing) stream settles. Drop it
  // if the beat moved on again before it could fire (a newer screen-change owns
  // the opener now).
  useEffect(() => {
    if (llm.isStreaming || !pendingOpenerRef.current) return;
    const sid = pendingOpenerRef.current;
    pendingOpenerRef.current = null;
    if (sid !== screenIdRef.current) return;
    suppressTrailingRef.current = false;
    streamActiveRef.current = true;
    void llmRef.current.sendOpener();
  }, [llm.isStreaming]);

  const toolActive = enabled || streamActiveRef.current;

  // Stream-chunked TTS: speak each completed sentence as it streams (voice-out),
  // and drive the on-screen partial off audio timing via beginSpeechTurn.onReveal.
  useEffect(() => {
    if (llm.isStreaming && !prevStreamingRef.current) {
      lastSpokenOffsetRef.current = 0;
      streamTurnActiveRef.current = false;
      streamedSomethingRef.current = false;
    }
    prevStreamingRef.current = llm.isStreaming;

    if (!toolActive || !llm.isStreaming || !speakRepliesRef.current || !llm.response) return;
    const { chunks, nextOffset } = nextSentenceChunks(llm.response, lastSpokenOffsetRef.current);
    if (chunks.length === 0) return;
    if (!streamTurnActiveRef.current) {
      turnSeqRef.current += 1;
      beginSpeechTurn({ onReveal: (t) => emitAssistant(t, 'partial') });
      streamTurnActiveRef.current = true;
      turnFinalizedRef.current = false;
    }
    for (const c of chunks) pushSpeechChunk(c);
    lastSpokenOffsetRef.current = nextOffset;
    streamedSomethingRef.current = true;
  }, [toolActive, llm.isStreaming, llm.response, emitAssistant]);

  // Mirror LLM messages → shared thread. A voice-out turn that streamed chunks
  // defers its thread append + bubble-clear until playback drains, so the final
  // text lands together with the audio (the karaoke bubble reveals meanwhile);
  // text mode (or a sub-sentence one-shot) appends immediately.
  useEffect(() => {
    if (!toolActive) return;
    for (const m of llm.messages) {
      if (m.role !== 'assistant' && m.role !== 'user') continue;
      if (mirroredIdsRef.current.has(m.id)) continue;
      if (!m.content) continue;
      // Suppress the coach's trailing line on a turn that advanced the beat: the
      // next beat's opener carries the conversation, so a "saved, let's continue"
      // bubble is redundant. Decided off the turn's OWN tool events (deterministic)
      // so it survives the screen-change reset of suppressTrailingRef.
      const advancedBeatTurn =
        !!chatNative &&
        m.role === 'assistant' &&
        !!m.toolEvents?.some((t) => ADVANCING_TOOL_NAMES.has(t.name) && t.result?.ok === true);
      if ((suppressTrailingRef.current || advancedBeatTurn) && m.role === 'assistant') {
        suppressTrailingRef.current = false;
        mirroredIdsRef.current.add(m.id);
        continue;
      }
      mirroredIdsRef.current.add(m.id);

      // Tag every turn with its beat so the chat-native feed groups dialogue
      // under the right beat and keeps each prior beat scrollable.
      const turnScreenId = screenIdRef.current ?? undefined;

      if (m.role === 'user') {
        appendMessage({
          id: `llm-${m.id}`,
          role: 'user',
          text: m.content,
          ...(turnScreenId ? { screenId: turnScreenId } : {}),
        });
        continue;
      }

      // Attach the beat's card to the LLM opener turn (first assistant message
      // for this beat) so it freezes inline beneath the opener, as before.
      let cards: OnboardingCard[] | undefined;
      const pendingCard = openerCardRef.current;
      if (pendingCard && pendingCard.screenId === screenIdRef.current) {
        cards = [pendingCard.card];
        openerCardRef.current = null;
      }
      const content = m.content;
      const land = () =>
        appendMessage({
          id: `llm-${m.id}`,
          role: 'ai',
          text: content,
          ...(cards ? { cards } : {}),
          ...(turnScreenId ? { screenId: turnScreenId } : {}),
        });

      if (speakRepliesRef.current && streamedSomethingRef.current) {
        streamedSomethingRef.current = false;
        turnFinalizedRef.current = true;
        const tail = flushSentenceTail(content, lastSpokenOffsetRef.current);
        if (tail) pushSpeechChunk(tail);
        const seq = turnSeqRef.current;
        let landed = false;
        let pollId: ReturnType<typeof setInterval> | null = null;
        const finalizeLand = () => {
          if (landed) return;
          landed = true;
          if (pollId !== null) {
            clearInterval(pollId);
            pollId = null;
          }
          // Append always (never drop the turn from scrollback); clear the
          // karaoke bubble only if no newer turn has taken over the partial.
          land();
          if (turnSeqRef.current === seq) {
            resetSpeechTurn();
            emitAssistant(content, 'final');
          }
        };
        // Happy path: land when the speech turn drains.
        void endSpeechTurn().finally(finalizeLand);
        // Stall guard: if the ws turn never drains, land once playback has
        // stayed idle through the grace window (reset every tick audio plays),
        // with a hard ceiling so a stuck isSpeaking can't hang it forever.
        let grace = TTS_LAND_GRACE_TICKS;
        let ticks = 0;
        pollId = setInterval(() => {
          if (landed) return;
          ticks += 1;
          if (useTtsPlaybackStore.getState().isSpeaking) grace = TTS_LAND_GRACE_TICKS;
          else grace -= 1;
          if (grace <= 0 || ticks >= TTS_LAND_MAX_TICKS) finalizeLand();
        }, TTS_LAND_POLL_MS);
      } else {
        land();
        emitAssistant(content, 'final');
        if (speakRepliesRef.current) void speak(content);
      }
    }
  }, [toolActive, llm.messages, appendMessage, emitAssistant, resetSpeechTurn, chatNative]);

  // Stream ended with no final message (abort/tool-only) — drain the open speech
  // turn so it doesn't hang. Guarded so it never fires after the mirror effect
  // already finalized a streamed turn.
  useEffect(() => {
    if (llm.isStreaming || !streamTurnActiveRef.current || turnFinalizedRef.current) return;
    turnFinalizedRef.current = true;
    streamedSomethingRef.current = false;
    void endSpeechTurn().finally(resetSpeechTurn);
  }, [llm.isStreaming, llm.messages, resetSpeechTurn]);

  // Live streaming partial → transcript bus (overlay + subtitle render it).
  // Karaoke turns drive the partial off audio timing (beginSpeechTurn.onReveal),
  // so skip the full-text push to keep text paced with speech.
  useEffect(() => {
    if (!toolActive || !llm.isStreaming || llm.response.length === 0) return;
    if (speakRepliesRef.current && ttsKaraokeActive()) return;
    emitAssistant(llm.response, 'partial');
  }, [toolActive, llm.isStreaming, llm.response, emitAssistant]);

  // Surface LLM errors as a coach bubble (dedup identical consecutive messages).
  useEffect(() => {
    if (!enabled || !llm.error) return;
    const msg = llm.error.message;
    if (msg === lastLlmErrorRef.current) return;
    lastLlmErrorRef.current = msg;
    // Opener turn failed → degrade to the authored line + card so the coach never
    // renders as a raw error (the LLM is the renderer; the authored line is the
    // source-of-truth fallback).
    const pending = openerCardRef.current;
    if (chatNative && pending && pending.screenId === screenIdRef.current) {
      openerCardRef.current = null;
      const line = getOnboardingOpener(screenIdRef.current) ?? '';
      appendMessage({
        id: `opener-fallback-${screenIdRef.current}`,
        role: 'ai',
        text: line,
        cards: [pending.card],
        ...(screenIdRef.current ? { screenId: screenIdRef.current } : {}),
      });
      return;
    }
    appendMessage({ id: `llm-error-${Date.now()}`, role: 'ai', text: msg });
  }, [enabled, llm.error, appendMessage, chatNative]);

  useChatToolEvents({
    toolEvents: llm.toolEvents,
    active: toolActive,
    routes: routesData?.routes,
    onVoiceAction,
    onWillAdvance: () => {
      suppressTrailingRef.current = true;
    },
    // Stable session → session-scoped dedup (call_ids are globally unique);
    // legacy → per-screen reset, unchanged.
    resetKey: useStableSession ? (chatSessionId ?? screenId) : screenId,
    screenId,
    chatNative,
  });

  const sendUserTurn = useCallback(
    (text: string) => {
      const action = routeOrbSend({
        orbState: orbStateRef.current,
        surface: isOnboardingScreen ? 'onboarding' : 'coach',
        isProcessing: false,
        isStreaming: llmRef.current.isStreaming,
      });
      if (action === 'noop' || action === 'vapi') return;
      // Barge-in: a landed user turn cuts the coach's current audio. Reset the
      // speech-turn flags synchronously (ws already torn down by stopTTS).
      stopTTS();
      resetSpeechTurn();
      // Revisit "move on" shortcut: affirm on an already-complete screen advances.
      if (
        action === 'onboarding' &&
        landedCompleteRef.current &&
        detectAffirmation(text, 'single').affirmed
      ) {
        const now = Date.now();
        appendMessage({ id: `user-${now}`, role: 'user', text });
        appendMessage({ id: `ai-${now}`, role: 'ai', text: 'Great — moving on.' });
        if (speakRepliesRef.current) void speak('Great — moving on.');
        // Already-complete revisit: no current_step transition for useAgentNavigation,
        // so advance the page directly (synchronous, this screen only — no timer race).
        onAdvanceRef.current?.();
        return;
      }
      // Session not minted yet (cold voice-in entry) — hold; flushed on ready.
      if (!chatSessionIdRef.current) {
        pendingTurnRef.current = text;
        return;
      }
      // A reply is still streaming (barge-in mid-reply): abort it and queue this
      // turn — the idle-flush effect sends it once the abort settles.
      if (llmRef.current.isStreaming) {
        pendingTurnRef.current = pendingTurnRef.current
          ? `${pendingTurnRef.current} ${text}`
          : text;
        llmRef.current.cancel();
        return;
      }
      startStream(text);
    },
    [isOnboardingScreen, appendMessage, startStream, resetSpeechTurn],
  );

  return { sendUserTurn, chatBusy: llm.isStreaming, interrupt, regenerate };
}
