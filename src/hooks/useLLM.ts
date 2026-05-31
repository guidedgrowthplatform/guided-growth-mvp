import { useCallback, useEffect, useRef, useState } from 'react';
import { streamLLM } from '@/api/llm';
import { useSessionLogStore } from '@/stores/sessionLogStore';
import type {
  CoachingStyle,
  LLMChatMessage,
  LLMStreamEvent,
  LLMToolEvent,
} from '@shared/types/llm';
import { useSessionLog } from './useSessionLog';

export type LLMStatus = 'idle' | 'streaming' | 'done' | 'error';

// Shown when a turn yields neither text nor a tool action — else the UI looks frozen.
const EMPTY_TURN_FALLBACK = "Sorry, I didn't quite get that — could you say it another way?";

export interface UseLLMReturn {
  sendMessage: (text: string) => Promise<void>;
  sendOpener: () => Promise<void>;
  messages: LLMChatMessage[];
  response: string;
  toolEvents: LLMToolEvent[];
  status: LLMStatus;
  isStreaming: boolean;
  error: Error | null;
  reset: () => void;
  cancel: () => void;
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
  },
): UseLLMReturn {
  const { sessionId, logEvent } = useSessionLog();
  const coachingStyle = opts?.coachingStyle ?? 'warm';
  const chatSessionId = opts?.chatSessionId;
  const initialMessages = opts?.initialMessages;

  const [messages, setMessages] = useState<LLMChatMessage[]>([]);
  const [response, setResponse] = useState('');
  const [toolEvents, setToolEvents] = useState<LLMToolEvent[]>([]);
  const [status, setStatus] = useState<LLMStatus>('idle');
  const [error, setError] = useState<Error | null>(null);
  const [seededFor, setSeededFor] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const inFlightRef = useRef(false);
  const idCounterRef = useRef({ n: 0 });

  const reset = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    inFlightRef.current = false;
    setMessages([]);
    setResponse('');
    setToolEvents([]);
    setStatus('idle');
    setError(null);
  }, []);

  const cancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
      inFlightRef.current = false;
      setStatus('idle');
    }
  }, []);

  const runStream = useCallback(
    async (opts: { mode: 'chat' | 'opener'; text: string; surfaceErrors: boolean }) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;

      let userTurnId: string | null = null;
      if (opts.mode === 'chat') {
        userTurnId = makeId(idCounterRef.current);
        const userMsg: LLMChatMessage = {
          id: userTurnId,
          role: 'user',
          content: opts.text,
        };
        setMessages((prev) => [...prev, userMsg]);
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

      const onEvent = (e: LLMStreamEvent) => {
        switch (e.type) {
          case 'delta': {
            acc += e.content;
            setResponse((prev) => prev + e.content);
            break;
          }
          case 'tool_call': {
            const evt: LLMToolEvent = { id: e.id, name: e.name, args: e.args };
            localTools.push(evt);
            setToolEvents((prev) => [...prev, evt]);
            break;
          }
          case 'tool_result': {
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

  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
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
    messages,
    response,
    toolEvents,
    status,
    isStreaming: status === 'streaming',
    error,
    reset,
    cancel,
  };
}
