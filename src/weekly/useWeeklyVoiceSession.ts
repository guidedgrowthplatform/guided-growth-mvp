/**
 * useWeeklyVoiceSession — composes The Weekly into ONE live Vapi voice session.
 *
 * Fetches the tester's real week data, starts a call on the dedicated weekly
 * assistant with that data injected into the cold-start context, and turns the
 * coach's in-band weekly_* tool calls into advance / complete signals the QA
 * page uses to drive the flow orchestrator. anon_id is sourced exactly the way
 * OnboardingVoiceProvider sources it (the authStore selector) so tool writes
 * land under the real signed-in user.
 *
 * NO EM DASHES.
 */
import type Vapi from '@vapi-ai/web';
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchWeeklyContext, type WeeklyContextResponse } from '@/api/weeklyContext';
import { useRealtimeVoice, type RealtimeTranscriptEvent } from '@/hooks/useRealtimeVoice';
import { buildAssistantOverrides } from '@/lib/voice/buildAssistantOverrides';
import { getNode } from '@/onboarding-flow/flowMachine';
import { getPublishedFlow } from '@/onboarding-flow/useFlow';
import { useAuthStore } from '@/stores/authStore';
import { parseWeeklyToolCalls } from './parseWeeklyToolCalls';

// The entry beat's context rides the cold-start initial_screen_context alongside
// the week block; every later beat is pushed mid-session by the page. Resolved
// once from the published flow (the same doc the page mounts).
const WEEKLY_FLOW = getPublishedFlow('weekly-checkin');
const WEEKLY_ENTRY_SCREEN_ID = WEEKLY_FLOW
  ? (getNode(WEEKLY_FLOW, WEEKLY_FLOW.entryNodeId)?.screenId ?? 'WCHECK-FRAME')
  : 'WCHECK-FRAME';
const WEEKLY_ENTRY_CONTEXT_BLOCK = WEEKLY_FLOW
  ? (getNode(WEEKLY_FLOW, WEEKLY_FLOW.entryNodeId)?.context.contextBlock ?? '')
  : '';

export interface UseWeeklyVoiceSessionOptions {
  /** Fired when the coach calls weekly_advance (advance the flow one beat). */
  onAdvance?: () => void;
  /** Fired when the coach calls weekly_complete (session is done). */
  onComplete?: () => void;
  onEnd?: () => void;
  onError?: (message: string) => void;
  onTranscript?: (event: RealtimeTranscriptEvent) => void;
}

export interface UseWeeklyVoiceSessionReturn {
  start: () => Promise<void>;
  stop: () => void;
  /** Push a beat's context to the live coach mid-session (system add-message). */
  pushBeatContext: (content: string) => void;
  state: ReturnType<typeof useRealtimeVoice>['state'];
  isActive: boolean;
  isSpeaking: boolean;
  error: string | null;
  weekContext: WeeklyContextResponse | null;
  loading: boolean;
}

export function useWeeklyVoiceSession(
  options: UseWeeklyVoiceSessionOptions = {},
): UseWeeklyVoiceSessionReturn {
  const { onAdvance, onComplete, onEnd, onError, onTranscript } = options;
  const anonId = useAuthStore((s) => s.anonId);

  const [weekContext, setWeekContext] = useState<WeeklyContextResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchWeeklyContext()
      .then((res) => {
        if (!alive) return;
        setWeekContext(res);
        setFetchError(null);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setFetchError(err instanceof Error ? err.message : 'Failed to load week data.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Refs so the stable Vapi callbacks always read the latest values.
  const weekContextRef = useRef<WeeklyContextResponse | null>(null);
  useEffect(() => {
    weekContextRef.current = weekContext;
  }, [weekContext]);

  const onAdvanceRef = useRef(onAdvance);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onAdvanceRef.current = onAdvance;
    onCompleteRef.current = onComplete;
  });

  const getClientRef = useRef<(() => Vapi | null) | null>(null);
  const messageAttachedRef = useRef(false);
  const isActiveRef = useRef(false);

  // The week block rides inside initial_screen_context (the weekly assistant
  // prompt has no separate {{week_data}} slot). Falls back to the dashboard
  // firstMessage if the week fetch has not landed yet.
  const getAssistantOverrides = useCallback(async () => {
    const ctx = weekContextRef.current;
    if (!ctx) return undefined;
    const contextBlock = `${WEEKLY_ENTRY_CONTEXT_BLOCK}\n\n${ctx.block}`;
    const overrides = buildAssistantOverrides({
      screenId: WEEKLY_ENTRY_SCREEN_ID,
      contextBlock,
      stateDelta: [],
    });
    return {
      ...overrides,
      variableValues: { ...overrides.variableValues, anon_id: anonId ?? '' },
    };
  }, [anonId]);

  const handleMessage = useCallback((message: unknown) => {
    const names = parseWeeklyToolCalls(message);
    if (names.length === 0) return;
    if (names.includes('weekly_advance')) onAdvanceRef.current?.();
    if (names.includes('weekly_complete')) onCompleteRef.current?.();
  }, []);

  // The Vapi instance persists across stop/start inside useRealtimeVoice, so the
  // tool-call listener is attached exactly once (idempotent) and reads latest
  // callbacks via refs. Removed on unmount.
  const handleCallStart = useCallback(() => {
    const client = getClientRef.current?.();
    if (!client || messageAttachedRef.current) return;
    client.on('message', handleMessage);
    messageAttachedRef.current = true;
  }, [handleMessage]);

  const { start, stop, state, isActive, isSpeaking, error, getClient } = useRealtimeVoice({
    assistant: 'weekly',
    metadata: { anon_id: anonId ?? '', screen: 'weekly' },
    getAssistantOverrides,
    onCallStart: handleCallStart,
    onEnd,
    onError,
    onTranscript,
  });

  useEffect(() => {
    getClientRef.current = getClient;
  }, [getClient]);

  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  useEffect(() => {
    return () => {
      const client = getClientRef.current?.();
      if (client && messageAttachedRef.current) {
        try {
          client.removeListener('message', handleMessage);
        } catch {
          /* noop */
        }
        messageAttachedRef.current = false;
      }
    };
  }, [handleMessage]);

  // Mirrors OnboardingVoiceProvider.pushScreenContext's send payload. QA guard:
  // skip when the call is not active (Vapi throws before join).
  const pushBeatContext = useCallback((content: string) => {
    const client = getClientRef.current?.();
    if (!client || !isActiveRef.current) return;
    try {
      client.send({
        type: 'add-message',
        message: { role: 'system', content },
        triggerResponseEnabled: true,
      });
    } catch {
      /* pre-join or transient send failure; QA can retry on the next beat */
    }
  }, []);

  return {
    start,
    stop,
    pushBeatContext,
    state,
    isActive,
    isSpeaking,
    error: fetchError ?? error,
    weekContext,
    loading,
  };
}
