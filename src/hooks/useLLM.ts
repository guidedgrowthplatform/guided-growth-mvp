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

export interface UseLLMReturn {
  sendMessage: (text: string) => Promise<void>;
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

export function useLLM(screenId: string, opts?: { coachingStyle?: CoachingStyle }): UseLLMReturn {
  const { sessionId, logEvent } = useSessionLog();
  const coachingStyle = opts?.coachingStyle ?? 'warm';

  const [messages, setMessages] = useState<LLMChatMessage[]>([]);
  const [response, setResponse] = useState('');
  const [toolEvents, setToolEvents] = useState<LLMToolEvent[]>([]);
  const [status, setStatus] = useState<LLMStatus>('idle');
  const [error, setError] = useState<Error | null>(null);

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

  const sendMessage = useCallback(
    async (text: string) => {
      // Sync guard: blocks back-to-back calls before React re-renders.
      if (inFlightRef.current) return;
      inFlightRef.current = true;

      const userMsg: LLMChatMessage = {
        id: makeId(idCounterRef.current),
        role: 'user',
        content: text,
      };
      setMessages((prev) => [...prev, userMsg]);
      setResponse('');
      setToolEvents([]);
      setError(null);
      setStatus('streaming');

      const controller = new AbortController();
      abortRef.current = controller;

      let acc = '';
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
            const assistant: LLMChatMessage = {
              id: makeId(idCounterRef.current),
              role: 'assistant',
              content: acc,
              toolEvents: localTools.length > 0 ? [...localTools] : undefined,
            };
            setMessages((prev) => [...prev, assistant]);
            setResponse('');
            setToolEvents([]);
            setStatus('done');
            try {
              logEvent(
                'llm_call',
                {
                  screen_id: screenId,
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
            setStatus('error');
            setError(new Error(`${e.code}: ${e.message}`));
            // Stop reading; any follow-up frames would overwrite error state.
            controller.abort();
            break;
          }
        }
      };

      try {
        // Pass the optimistic local delta so the backend doesn't race a
        // pending /api/session_log POST. Filter out llm_call rows server-side
        // anyway, but trimming here keeps the body small.
        const recent_events = useSessionLogStore.getState().getDeltaSince(null);

        await streamLLM(
          {
            session_id: sessionId,
            screen_id: screenId,
            user_message: text,
            coaching_style: coachingStyle,
            recent_events,
          },
          onEvent,
          controller.signal,
        );
      } catch (err) {
        // Trust the controller's own signal for abort detection; per-call,
        // can't be poisoned by a sibling sendMessage.
        const wasAborted =
          controller.signal.aborted || (err instanceof DOMException && err.name === 'AbortError');
        if (wasAborted) {
          // If we already surfaced an error via SSE 'error' frame, keep that.
          // Otherwise this is a user/unmount cancel — fall back to idle.
          setStatus((prev) => (prev === 'error' ? 'error' : 'idle'));
        } else {
          setStatus('error');
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
        inFlightRef.current = false;
      }
    },
    [sessionId, screenId, coachingStyle, logEvent],
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

  return {
    sendMessage,
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
