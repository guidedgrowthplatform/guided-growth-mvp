import { Capacitor } from '@capacitor/core';
import { isTraceOn, startTurnTrace } from '@/lib/debug/traceConsole';
import { getAuthHeaders } from '@/lib/services/api-auth';
import type { LLMRequest, LLMStreamEvent } from '@gg/shared/types/llm';

export type { LLMRequest, LLMStreamEvent } from '@gg/shared/types/llm';

function getApiUrl(): string {
  if (Capacitor.isNativePlatform()) {
    if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  }
  return '';
}

const VALID_TYPES = new Set(['delta', 'tool_call', 'tool_result', 'tool_failed', 'done', 'error']);

function parseEventBlock(block: string): LLMStreamEvent | null {
  const lines = block.split('\n');
  const dataLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).replace(/^ /, ''));
    }
  }
  if (dataLines.length === 0) return null;
  const raw = dataLines.join('\n');
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === 'object' &&
      'type' in parsed &&
      typeof (parsed as { type: unknown }).type === 'string' &&
      VALID_TYPES.has((parsed as { type: string }).type)
    ) {
      return parsed as LLMStreamEvent;
    }
  } catch {
    // ignore malformed frame
  }
  return null;
}

export async function streamLLM(
  req: LLMRequest,
  onEvent: (e: LLMStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  // Dev-only trace of this turn. No-op unless ?debug=1 / localStorage gg_debug=1.
  const tracing = isTraceOn();
  const trace = tracing
    ? startTurnTrace(`llm · ${req.screen_id}`, {
        screen_id: req.screen_id,
        user_message: req.user_message,
        ...(req.mode ? { mode: req.mode } : {}),
        ...(req.coaching_style ? { coaching_style: req.coaching_style } : {}),
      })
    : null;
  let assembledText = '';
  let deltaCount = 0;
  const handleEvent = (evt: LLMStreamEvent): void => {
    if (tracing && trace) {
      switch (evt.type) {
        case 'delta':
          deltaCount += 1;
          assembledText += evt.content;
          break;
        case 'tool_call':
          trace.event(`tool_call → ${evt.name}`, evt.args);
          break;
        case 'tool_result':
          trace.event(`tool_result ← ${evt.id} ok=${evt.ok}`, evt.result);
          break;
        case 'tool_failed':
          trace.event(`tool_failed ← ${evt.name} · ${evt.error}`, evt.message);
          break;
        case 'done':
          trace.event(
            `assistant text (${deltaCount} chunk${deltaCount === 1 ? '' : 's'})`,
            assembledText,
          );
          trace.event('server summary', {
            latency_ms: evt.latency_ms,
            total_tokens: evt.total_tokens,
            tool_rounds: evt.tool_rounds,
          });
          break;
        case 'error':
          trace.event(`error · ${evt.code}`, evt.message);
          break;
      }
    }
    onEvent(evt);
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
  };

  Object.assign(headers, await getAuthHeaders());

  const response = await fetch(`${getApiUrl()}/api/llm`, {
    method: 'POST',
    credentials: 'include',
    headers,
    body: JSON.stringify(req),
    signal,
  });

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as { message?: string; error?: string };
      message = body.message ?? body.error ?? message;
    } catch {
      try {
        const text = await response.text();
        if (text) message = text;
      } catch {
        // ignore
      }
    }
    trace?.event(`http_error · ${response.status}`, message);
    trace?.end();
    throw new Error(message);
  }

  if (!response.body) {
    trace?.event('no_response_body');
    trace?.end();
    throw new Error('Response has no body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: false });
  let buffer = '';

  // Normalize CR/CRLF to LF so a single split handles all three SSE terminators.
  const splitOff = (): string | null => {
    const normalized = buffer.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const idx = normalized.indexOf('\n\n');
    if (idx === -1) {
      buffer = normalized;
      return null;
    }
    const block = normalized.slice(0, idx);
    buffer = normalized.slice(idx + 2);
    return block;
  };

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let block: string | null;
      while ((block = splitOff()) !== null) {
        const evt = parseEventBlock(block);
        if (evt) handleEvent(evt);
      }
    }
    buffer += decoder.decode();
    if (buffer.trim().length > 0) {
      const evt = parseEventBlock(buffer);
      if (evt) handleEvent(evt);
    }
  } finally {
    trace?.end();
    try {
      reader.releaseLock();
    } catch {
      // ignore
    }
  }
}
