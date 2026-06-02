import { Capacitor } from '@capacitor/core';
import { sessionReady, supabase } from '@/lib/supabase';
import type { LLMRequest, LLMStreamEvent } from '@gg/shared/types/llm';

export type { LLMRequest, LLMStreamEvent } from '@gg/shared/types/llm';

function getApiUrl(): string {
  if (Capacitor.isNativePlatform()) {
    if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  }
  return '';
}

const VALID_TYPES = new Set(['delta', 'tool_call', 'tool_result', 'done', 'error']);

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
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
  };

  if (Capacitor.isNativePlatform()) {
    await sessionReady;
  }
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
  } catch {
    // continue without auth — server will 401
  }

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
    throw new Error(message);
  }

  if (!response.body) {
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
        if (evt) onEvent(evt);
      }
    }
    buffer += decoder.decode();
    if (buffer.trim().length > 0) {
      const evt = parseEventBlock(buffer);
      if (evt) onEvent(evt);
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // ignore
    }
  }
}
