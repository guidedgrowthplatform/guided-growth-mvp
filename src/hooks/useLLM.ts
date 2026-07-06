import { useCallback, useEffect, useRef, useState } from 'react';
import { track } from '@/analytics';
import { streamLLM } from '@/api/llm';
import { isOnboardingScreen, logDebugEvent } from '@/lib/debug/onboardingDebug';
import { emitLatencySpan } from '@/lib/telemetry/latencySpans';
import { fixSentenceJoinSpacing } from '@/lib/text/sentenceJoinSpacing';
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

// Idle watchdog: abort a stream that produces NO event for this long. Bounds
// the "indefinite thinking stall" (B11) — a wedged serverless function or a
// half-open socket otherwise leaves status 'streaming' forever. Real progress
// (deltas, tool_call/tool_result between rounds) resets the timer, so slow
// multi-round turns are unaffected; only a genuinely dead stream trips it.
const STREAM_IDLE_TIMEOUT_MS = 30_000;

export interface LLMToolFailure {
  id: string;
  name: string;
  error: string;
  message?: string;
}

export interface UseLLMReturn {
  sendMessage: (text: string) => Promise<void>;
  sendOpener: (timeoutMs?: number) => Promise<boolean>;
  seedOpener: (content: string, toolEvent: LLMToolEvent) => void;
  prependMessages: (older: LLMChatMessage[]) => number;
  messages: LLMChatMessage[];
  response: string;
  toolEvents: LLMToolEvent[];
  // Write-tool crashes for the current turn. Survives `done` (unlike toolEvents);
  // cleared at the next runStream start.
  toolFailures: LLMToolFailure[];
  status: LLMStatus;
  isStreaming: boolean;
  // Live (non-render) in-flight check. `isStreaming` is render-state and can
  // be one render stale inside a promise continuation (a microtask beats
  // React's re-render), so callers that must distinguish "sendOpener no-oped
  // because another stream is running" from "the stream ran and failed" read
  // this instead: on a real failure the in-flight flag is already cleared
  // before the promise resolves, while a busy no-op leaves the other
  // stream's flag up.
  isBusy: () => boolean;
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
  const [toolFailures, setToolFailures] = useState<LLMToolFailure[]>([]);
  const [status, setStatus] = useState<LLMStatus>('idle');
  const [error, setError] = useState<Error | null>(null);
  const [seededFor, setSeededFor] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const inFlightRef = useRef(false);
  const lastUserRef = useRef<{ id: string; content: string } | null>(null);
  const priorOpenerRef = useRef<string | null>(null);
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
    priorOpenerRef.current = null;
    lastUserRef.current = null;
    setMessages([]);
    setResponse('');
    setToolEvents([]);
    setToolFailures([]);
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

  const seedOpener = useCallback((content: string, toolEvent: LLMToolEvent) => {
    const id = makeId(idCounterRef.current);
    setMessages((prev) => [...prev, { id, role: 'assistant', content, toolEvents: [toolEvent] }]);
    priorOpenerRef.current = content;
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
      timeoutMs?: number;
      reuseTurnId?: string;
    }): Promise<boolean> => {
      if (inFlightRef.current) return false;
      inFlightRef.current = true;

      let userTurnId: string | null = null;
      if (opts.mode === 'chat') {
        if (opts.reuseTurnId) {
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
      setToolFailures([]);
      setError(null);
      setStatus('streaming');

      const controller = new AbortController();
      abortRef.current = controller;
      const timeoutId =
        opts.timeoutMs != null ? setTimeout(() => controller.abort(), opts.timeoutMs) : null;

      let acc = '';
      let sawTerminal = false;
      let succeeded = false;
      const localTools: LLMToolEvent[] = [];

      // Idle watchdog — any received event proves the stream is alive and
      // re-arms it; a stream that goes silent past the window is aborted and
      // surfaced as a retryable timeout error (never an endless spinner).
      let idleTimedOut = false;
      let idleTimerId: ReturnType<typeof setTimeout> | null = null;
      const armIdleWatchdog = () => {
        if (idleTimerId !== null) clearTimeout(idleTimerId);
        idleTimerId = setTimeout(() => {
          idleTimedOut = true;
          controller.abort();
        }, STREAM_IDLE_TIMEOUT_MS);
      };

      // Direct-LLM (Path 2/3) tap — onboarding only; same console timeline as Vapi.
      const debugOnb = isOnboardingScreen(screenId);

      const onEvent = (e: LLMStreamEvent) => {
        armIdleWatchdog();
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
          case 'tool_failed': {
            setToolFailures((prev) => [
              ...prev,
              { id: e.id, name: e.name, error: e.error, message: e.message },
            ]);
            break;
          }
          case 'done': {
            sawTerminal = true;
            succeeded = true;
            flushDeltaBuffer();
            // Skip a blank assistant turn (tool-only). Truly empty (no text, no
            // tools) → fallback line so the turn never renders as silence.
            // B56a: the model's own turn text sometimes glues a confirmation
            // sentence directly onto the next sentence with no separating
            // space (e.g. "for weekdays.Now, let's set..."). Fixed once here,
            // at the single point the turn's full text is finalized, so every
            // downstream consumer (chat bubble, TTS, persistence) sees it.
            const display = fixSentenceJoinSpacing(
              acc.trim() === '' && localTools.length === 0 ? EMPTY_TURN_FALLBACK : acc,
            );
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
            // Backend-reported total LLM round-trip (end-of-stream), not TTFT.
            track('coach_llm_latency', {
              screen_id: screenId,
              mode: opts.mode,
              latency_ms: e.latency_ms,
            });
            // Latency lane T1: server-leg TTFT measured on the API function
            // (request start -> first delta), shipped on the done event.
            if (typeof e.ttft_ms === 'number') {
              emitLatencySpan('llm_ttft_ms', e.ttft_ms, {
                leg: 'server',
                screen_id: screenId,
                mode: opts.mode,
              });
            }
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

        const priorOpener = opts.mode === 'chat' ? priorOpenerRef.current : null;
        if (priorOpener) priorOpenerRef.current = null;

        armIdleWatchdog();
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
            ...(priorOpener ? { prior_opener: priorOpener } : {}),
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
          // Watchdog aborts (idleTimedOut) are surfaced in `finally`, which
          // also covers the no-throw path where the abort closes the stream
          // cleanly. User cancels keep the old idle/error behavior.
          if (!idleTimedOut) setStatus((prev) => (prev === 'error' ? 'error' : 'idle'));
        } else if (opts.surfaceErrors) {
          setStatus('error');
          setError(err instanceof Error ? err : new Error(String(err)));
        } else {
          setStatus('idle');
        }
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
        if (idleTimerId !== null) clearTimeout(idleTimerId);
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
        inFlightRef.current = false;
        if (idleTimedOut && !sawTerminal) {
          // Watchdog fired — a dead stream, not a user cancel. Retryable error.
          if (opts.surfaceErrors) {
            setError((prev) => prev ?? new Error('llm_timeout: the coach stopped responding'));
            setStatus('error');
          } else {
            setStatus((prev) => (prev === 'streaming' ? 'idle' : prev));
          }
        } else if (!sawTerminal && !controller.signal.aborted) {
          // Stream ended with no done/error frame (truncated/killed) — clear the
          // stuck 'streaming' status, else every later send is gated to noop.
          if (opts.surfaceErrors) {
            setError((prev) => prev ?? new Error('connection ended unexpectedly'));
            setStatus((prev) => (prev === 'streaming' ? 'error' : prev));
          } else {
            setStatus((prev) => (prev === 'streaming' ? 'idle' : prev));
          }
        }
      }
      return succeeded;
    },
    [sessionId, screenId, coachingStyle, logEvent, chatSessionId],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      if (!chatSessionId) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[useLLM] sendMessage called without chatSessionId; no-op');
        }
        return;
      }
      await runStream({ mode: 'chat', text, surfaceErrors: true });
    },
    [runStream, chatSessionId],
  );

  const sendOpener = useCallback(
    (timeoutMs?: number) =>
      runStream({ mode: 'opener', text: '', surfaceErrors: false, timeoutMs }),
    [runStream],
  );

  const regenerate = useCallback(async () => {
    const lu = lastUserRef.current;
    if (!lu) {
      await runStream({ mode: 'opener', text: '', surfaceErrors: false });
      return;
    }
    await runStream({ mode: 'chat', text: lu.content, surfaceErrors: true, reuseTurnId: lu.id });
  }, [runStream]);

  // Live in-flight read (see UseLLMReturn.isBusy). runStream clears the flag
  // in its finally before resolving, so a resolved-false send with isBusy()
  // false is a real failure, never a busy no-op.
  const isBusy = useCallback(() => inFlightRef.current, []);

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
    seedOpener,
    prependMessages,
    messages,
    response,
    toolEvents,
    toolFailures,
    status,
    isStreaming: status === 'streaming',
    isBusy,
    error,
    reset,
    cancel,
    regenerate,
  };
}
