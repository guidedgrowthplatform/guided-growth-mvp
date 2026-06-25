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
import type { OrbState } from '@/lib/orb/orbState';
import { routeOrbSend } from '@/lib/orb/routeOrbSend';
import { queryKeys } from '@/lib/query';
import { speak, stopTTS } from '@/lib/services/tts-service';
import { detectAffirmation } from '@gg/shared/onboarding/detectAffirmation';
import type { OnboardingState } from '@gg/shared/types';
import type { CoachingStyle } from '@gg/shared/types/llm';

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
}

export interface UseOnboardingChatReturn {
  sendUserTurn: (text: string) => void;
  // Low-frequency: flips at most twice per turn (start/end) — safe in context value.
  chatBusy: boolean;
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
}: UseOnboardingChatArgs): UseOnboardingChatReturn {
  const qc = useQueryClient();
  const isOnboardingScreen = (screenId ?? '').startsWith('ONBOARD-');

  const { chatSessionId, initialMessages, useStableSession } = useOnboardingChatSession(
    screenId ?? '',
    enabled,
    isOnboardingScreen,
  );
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
  const firedToolFailIdsRef = useRef<Set<string>>(new Set());
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

  // Latest values via refs so sendUserTurn stays stable (no context-value churn).
  const onAdvanceRef = useRef(onAdvance);
  onAdvanceRef.current = onAdvance;
  const orbStateRef = useRef(orbState);
  orbStateRef.current = orbState;
  const llmRef = useRef(llm);
  llmRef.current = llm;
  const chatSessionIdRef = useRef(chatSessionId);
  chatSessionIdRef.current = chatSessionId;
  const suppressTrailingRef = useRef(false);

  const startStream = useCallback((text: string) => {
    suppressTrailingRef.current = false;
    streamActiveRef.current = true;
    void llmRef.current.sendMessage(text);
  }, []);

  // Seed the opener when the screen changes. Stable session → continuous thread
  // (append opener, keep prior turns); legacy → per-screen wipe (reset + replace).
  useEffect(() => {
    if (!enabled || !screenId || !isOnboardingScreen) return;
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
    if (stable) {
      const openerId = `opener-${screenId}-${visitCounterRef.current++}`;
      startThread(screenId, opener ? [{ id: openerId, role: 'ai', text: opener }] : [], 'append');
    } else {
      startThread(screenId, opener ? [{ id: `opener-${screenId}`, role: 'ai', text: opener }] : []);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, screenId, isOnboardingScreen, startThread, qc]);

  // Vapi takeover: abort any in-flight Direct-LLM stream so it can't collide
  // with Vapi's opening turn.
  useEffect(() => {
    if (orbState === 'vapi') llmRef.current.cancel();
  }, [orbState]);

  // Stop in-flight TTS when leaving voice-out mode.
  useEffect(() => {
    if (orbState !== 'voice_out_only') stopTTS();
  }, [orbState]);

  // Flush a held voice-in turn once the session is ready.
  useEffect(() => {
    if (!chatSessionId || !pendingTurnRef.current) return;
    const text = pendingTurnRef.current;
    pendingTurnRef.current = null;
    startStream(text);
  }, [chatSessionId, startStream]);

  const toolActive = enabled || streamActiveRef.current;

  // Mirror LLM messages → shared thread (skip empties; speak in voice-out mode).
  useEffect(() => {
    if (!toolActive) return;
    for (const m of llm.messages) {
      if (m.role !== 'assistant' && m.role !== 'user') continue;
      if (mirroredIdsRef.current.has(m.id)) continue;
      if (!m.content) continue;
      if (suppressTrailingRef.current && m.role === 'assistant') {
        suppressTrailingRef.current = false;
        mirroredIdsRef.current.add(m.id);
        continue;
      }
      mirroredIdsRef.current.add(m.id);
      appendMessage({
        id: `llm-${m.id}`,
        role: m.role === 'assistant' ? 'ai' : 'user',
        text: m.content,
      });
      if (m.role === 'assistant') {
        emitAssistant(m.content, 'final');
        if (orbStateRef.current === 'voice_out_only') void speak(m.content);
      }
    }
  }, [toolActive, llm.messages, appendMessage, emitAssistant]);

  // Live streaming partial → transcript bus (overlay + subtitle render it).
  useEffect(() => {
    if (!toolActive || !llm.isStreaming || llm.response.length === 0) return;
    emitAssistant(llm.response, 'partial');
  }, [toolActive, llm.isStreaming, llm.response, emitAssistant]);

  // Surface LLM errors as a coach bubble (dedup identical consecutive messages).
  useEffect(() => {
    if (!enabled || !llm.error) return;
    const msg = llm.error.message;
    if (msg === lastLlmErrorRef.current) return;
    lastLlmErrorRef.current = msg;
    appendMessage({ id: `llm-error-${Date.now()}`, role: 'ai', text: msg });
  }, [enabled, llm.error, appendMessage]);

  // Failed write tool → soft retry bubble; never advance (useChatToolEvents is ok-gated).
  useEffect(() => {
    if (!enabled || llm.toolFailures.length === 0) return;
    const fresh = llm.toolFailures.filter((f) => !firedToolFailIdsRef.current.has(f.id));
    if (fresh.length === 0) return;
    fresh.forEach((f) => firedToolFailIdsRef.current.add(f.id));
    appendMessage({
      id: `tool-fail-${fresh[0].id}`,
      role: 'ai',
      text: "I couldn't save that just now — want to try again?",
    });
  }, [enabled, llm.toolFailures, appendMessage]);

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
      // Revisit "move on" shortcut: affirm on an already-complete screen advances.
      if (
        action === 'onboarding' &&
        landedCompleteRef.current &&
        detectAffirmation(text, 'single').affirmed
      ) {
        const now = Date.now();
        appendMessage({ id: `user-${now}`, role: 'user', text });
        appendMessage({ id: `ai-${now}`, role: 'ai', text: 'Great — moving on.' });
        if (orbStateRef.current === 'voice_out_only') void speak('Great — moving on.');
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
      startStream(text);
    },
    [isOnboardingScreen, appendMessage, startStream],
  );

  return { sendUserTurn, chatBusy: llm.isStreaming };
}
