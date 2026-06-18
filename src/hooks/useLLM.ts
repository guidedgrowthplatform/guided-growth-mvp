import { useCallback, useEffect, useRef, useState } from 'react';
import { streamLLM } from '@/api/llm';
import { isOnboardingScreen, logDebugEvent } from '@/lib/debug/onboardingDebug';
import { useSessionLogStore } from '@/stores/sessionLogStore';
import type {
  CoachingStyle,
  LLMChatMessage,
  LLMStreamEvent,
  LLMToolEvent,
} from '@gg/shared/types/llm';
import { useSessionLog } from './useSessionLog';

export type LLMStatus = 'idle' | 'streaming' | 'done' | 'error';

// Shown when a turn yields neither text nor a tool action — else the UI looks frozen.
const EMPTY_TURN_FALLBACK = "Sorry, I didn't quite get that — could you say it another way?";

// Batches incoming token deltas into one setState per ~40ms window. OpenAI
// streams 1-3 tokens per delta which fragmented lists/sentences visually
// when each delta triggered its own React render + smooth-reveal animation.
const DELTA_COALESCE_MS = 40;

export interface UseLLMReturn {
  sendMessage: (text: string) => Promise<void>;
  sendOpener: () => Promise<void>;
  prependMessages: (older: LLMChatMessage[]) => number;
  messages: LLMChatMessage[];
  response: string;
  toolEvents: LLMToolEvent[];
  status: LLMStatus;
  isStreaming: boolean;
  error: Error | null;
  reset: () => void;
  cancel: () => void;
  regenerate: () => Promise<void>;
}

function makeId(counter: { n: number }): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  counter.n += 1;
  return `msg-${counter.n}`;
}

export function useLLM(
  screenId: string,
  opts?: {
    coachingStyle?: CoachingStyle;
    chatSessionId?: string;
    initialMessages?: LLMChatMessage[];
    inputMode?: 'voice' | 'text';
  },
): UseLLMReturn {
  const { sessionId, logEvent } = useSessionLog();
  const coachingStyle = opts?.coachingStyle ?? 'warm';
  const chatSessionId = opts?.chatSessionId;
  const initialMessages = opts?.initialMessages;

  // Read fresh at send time — a voice/text toggle mustn't restale runStream.
  const inputModeRef = useRef(opts?.inputMode);
  inputModeRef.current = opts?.inputMode;

  const [messages, setMessages] = useState<LLMChatMessage[]>([]);
  // Current messages for synchronous dedup in prependMessages (returns the
  // number of genuinely-new rows so callers know if a prepend will commit).
  const messagesRef = useRef<LLMChatMessage[]>([]);
  messagesRef.current = messages;
  const [response, setResponse] = useState('');
  const [toolEvents, setToolEvents] = useState<LLMToolEvent[]>([]);
  const [status, setStatus] = useState<LLMStatus>('idle');
  const [error, setError] = useState<Error | null>(null);
  const [seededFor, setSeededFor] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const inFlightRef = useRef(false);
  // Last real user turn (id + text) so we can re-answer it without re-adding it.
  const lastUserRef = useRef<{ id: string; content: string } | null>(null);
  const idCounterRef = useRef({ n: 0 });
  const deltaBufferRef = useRef('');
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushDeltaBuffer = useCallback(() => {
    if (flushTimerRef.current !== null) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    if (deltaBufferRef.current.length === 0) return;
    const pending = deltaBufferRef.current;
    deltaBufferRef.current = '';
    setResponse((prev) => prev + pending);
  }, []);

  const reset = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    if (flushTimerRef.current !== null) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    deltaBufferRef.current = '';
    inFlightRef.current = false;
    setMessages([]);
    setResponse('');
    setToolEvents([]);
    setStatus('idle');
    setError(null);
  }, []);

  // Infinite-scroll-up: prepend an older page, deduped by id (a turn already
  // in state from a live send must not double-render).
  const prependMessages = useCallback((older: LLMChatMessage[]): number => {
    if (older.length === 0) return 0;
    const seen = new Set(messagesRef.current.map((m) => m.id));
    const fresh = older.filter((m) => !seen.has(m.id));
    if (fresh.length === 0) return 0;
    setMessages((prev) => {
      const seenPrev = new Set(prev.map((m) => m.id));
      const f = older.filter((m) => !seenPrev.has(m.id));
      return f.length === 0 ? prev : [...f, ...prev];
    });
    return fresh.length;
  }, []);

  const cancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
      if (flushTimerRef.current !== null) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      deltaBufferRef.current = '';
      inFlightRef.current = false;
      setStatus('idle');
    }
  }, []);

  const runStream = useCallback(
    async (opts: {
      mode: 'chat' | 'opener';
      text: string;
      surfaceErrors: boolean;
      reuseTurnId?: string;
    }) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;

      let userTurnId: string | null = null;
      if (opts.mode === 'chat') {
        if (opts.reuseTurnId) {
          // Regenerate: the user message is already in history; reuse its id so
          // the backend dedups (ON CONFLICT) instead of creating a second turn.
          userTurnId = opts.reuseTurnId;
        } else {
          userTurnId = makeId(idCounterRef.current);
          const userMsg: LLMChatMessage = {
            id: userTurnId,
            role: 'user',
            content: opts.text,
          };
          setMessages((prev) => [...prev, userMsg]);
          lastUserRef.current = { id: userTurnId, content: opts.text };
        }
      }
      setResponse('');
      setToolEvents([]);
      setError(null);
      setStatus('streaming');

      const controller = new AbortController();
      abortRef.current = controller;

      let acc = '';
      let sawTerminal = false;
      const localTools: LLMToolEvent[] = [];

      // Direct-LLM (Path 2/3) tap — onboarding only; same console timeline as Vapi.
      const debugOnb = isOnboardingScreen(screenId);

      const onEvent = (e: LLMStreamEvent) => {
        switch (e.type) {
          case 'delta': {
            acc += e.content;
            deltaBufferRef.current += e.content;
            if (flushTimerRef.current === null) {
              flushTimerRef.current = setTimeout(flushDeltaBuffer, DELTA_COALESCE_MS);
            }
            break;
          }
          case 'tool_call': {
            const evt: LLMToolEvent = { id: e.id, name: e.name, args: e.args };
            localTools.push(evt);
            setToolEvents((prev) => [...prev, evt]);
            if (debugOnb)
              logDebugEvent({ source: 'llm', label: e.name, ok: null, detail: { args: e.args } });
            break;
          }
          case 'tool_result': {
            if (debugOnb) {
              const t = localTools.find((x) => x.id === e.id);
              logDebugEvent({
                source: 'llm',
                label: t?.name ?? 'tool_result',
                ok: e.ok,
                code: e.ok ? null : 'tool_failed',
                detail: { result: e.result },
              });
            }
            const idx = localTools.findIndex((t) => t.id === e.id);
            if (idx >= 0) {
              const updated: LLMToolEvent = {
                ...localTools[idx],
                result: { ok: e.ok, payload: e.result },
              };
              localTools[idx] = updated;
            }
            setToolEvents((prev) =>
              prev.map((t) =>
                t.id === e.id ? { ...t, result: { ok: e.ok, payload: e.result } } : t,
              ),
            );
            break;
          }
          case 'done': {
            sawTerminal = true;
            flushDeltaBuffer();
            // Skip a blank assistant turn (tool-only). Truly empty (no text, no
            // tools) → fallback line so the turn never renders as silence.
            const display =
              acc.trim() === '' && localTools.length === 0 ? EMPTY_TURN_FALLBACK : acc;
            if (display.trim() !== '') {
              const assistant: LLMChatMessage = {
                id: makeId(idCounterRef.current),
                role: 'assistant',
                content: display,
                toolEvents: localTools.length > 0 ? [...localTools] : undefined,
              };
              setMessages((prev) => [...prev, assistant]);
            }
            setResponse('');
            setToolEvents([]);
            setStatus('done');
            try {
              logEvent(
                'llm_call',
                {
                  screen_id: screenId,
                  mode: opts.mode,
                  latency_ms: e.latency_ms,
                  total_tokens: e.total_tokens,
                  tool_rounds: e.tool_rounds,
                },
                screenId,
              );
            } catch {
              // ignore logging failures
            }
            break;
          }
          case 'error': {
            sawTerminal = true;
            flushDeltaBuffer();
            if (debugOnb)
              logDebugEvent({
                source: 'llm',
                label: 'llm_error',
                ok: false,
                code: e.code,
                detail: { message: e.message },
              });
            if (opts.surfaceErrors) {
              setStatus('error');
              setError(new Error(`${e.code}: ${e.message}`));
            } else {
              setStatus('idle');
            }
            controller.abort();
            break;
          }
        }
      };

      try {
        const recent_events = useSessionLogStore.getState().getDeltaSince(null);

        await streamLLM(
          {
            session_id: sessionId,
            screen_id: screenId,
            user_message: opts.text,
            coaching_style: coachingStyle,
            mode: opts.mode,
            chat_session_id: chatSessionId,
            user_turn_id: userTurnId ?? undefined,
            recent_events,
            ...(inputModeRef.current ? { input_mode: inputModeRef.current } : {}),
            ...(opts.mode === 'chat'
              ? { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }
              : {}),
          },
          onEvent,
          controller.signal,
        );
      } catch (err) {
        const wasAborted =
          controller.signal.aborted || (err instanceof DOMException && err.name === 'AbortError');
        if (wasAborted) {
          setStatus((prev) => (prev === 'error' ? 'error' : 'idle'));
        } else if (opts.surfaceErrors) {
          setStatus('error');
          setError(err instanceof Error ? err : new Error(String(err)));
        } else {
          setStatus('idle');
        }
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
        inFlightRef.current = false;
        // Stream ended with no done/error frame (truncated/killed) — clear the
        // stuck 'streaming' status, else every later send is gated to noop.
        if (!sawTerminal && !controller.signal.aborted) {
          if (opts.surfaceErrors) {
            setError((prev) => prev ?? new Error('connection ended unexpectedly'));
            setStatus((prev) => (prev === 'streaming' ? 'error' : prev));
          } else {
            setStatus((prev) => (prev === 'streaming' ? 'idle' : prev));
          }
        }
      }
    },
    [sessionId, screenId, coachingStyle, logEvent, chatSessionId],
  );

  const sendMessage = useCallback(
    (text: string) => {
      if (!chatSessionId) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[useLLM] sendMessage called without chatSessionId; no-op');
        }
        return Promise.resolve();
      }
      return runStream({ mode: 'chat', text, surfaceErrors: true });
    },
    [runStream, chatSessionId],
  );

  const sendOpener = useCallback(
    () => runStream({ mode: 'opener', text: '', surfaceErrors: false }),
    [runStream],
  );

  // Re-answer the LAST user turn WITHOUT adding a new message — used to guarantee
  // the coach replies to a turn whose reply got dropped/aborted/interrupted.
  const regenerate = useCallback(() => {
    const lu = lastUserRef.current;
    // No prior user turn (e.g. the coach's opener got interrupted) → re-issue a
    // coach-led message instead of no-op'ing into silence.
    if (!lu) return runStream({ mode: 'opener', text: '', surfaceErrors: false });
    return runStream({ mode: 'chat', text: lu.content, surfaceErrors: true, reuseTurnId: lu.id });
  }, [runStream]);

  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
      if (flushTimerRef.current !== null) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      deltaBufferRef.current = '';
      inFlightRef.current = false;
    };
  }, []);

  // Seed once per chatSessionId; initialMessages ref churns are ignored.
  // assumes chatSessionId + initialMessages co-render (React 18 batches useChatSession setStates)
  useEffect(() => {
    if (!chatSessionId) return;
    if (seededFor === chatSessionId) return;
    setSeededFor(chatSessionId);
    setMessages(initialMessages ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatSessionId]);

  return {
    sendMessage,
    sendOpener,
    prependMessages,
    messages,
    response,
    toolEvents,
    status,
    isStreaming: status === 'streaming',
    error,
    reset,
    cancel,
    regenerate,
  };
}
