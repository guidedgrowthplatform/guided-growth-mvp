/** @vitest-environment jsdom */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { useEffect, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionLogContext, type SessionLogContextValue } from '@/contexts/SessionLogContext';
import type { LLMStreamEvent } from '@gg/shared/types/llm';
import { useLLM, type UseLLMReturn } from '../useLLM';

const logEventMock = vi.fn();
const sessionCtx: SessionLogContextValue = {
  sessionId: 'test-session-id-1234567890',
  logEvent: logEventMock,
  startVoice: vi.fn(() => 'anchor'),
  endVoice: vi.fn(),
};

function Wrapper({ children }: { children: ReactNode }) {
  return <SessionLogContext.Provider value={sessionCtx}>{children}</SessionLogContext.Provider>;
}

let hookRef: UseLLMReturn | null = null;
function Bridge({
  screenId,
  chatSessionId,
  inputMode,
}: {
  screenId: string;
  chatSessionId?: string;
  inputMode?: 'voice' | 'text';
}) {
  const v = useLLM(screenId, { chatSessionId, inputMode });
  useEffect(() => {
    hookRef = v;
  });
  return null;
}

let container: HTMLDivElement;
let root: Root;

function mount(screenId = 'CHAT-DEBUG', chatSessionId: string | undefined = 'sess-test') {
  act(() => {
    root.render(
      <Wrapper>
        <Bridge screenId={screenId} chatSessionId={chatSessionId} />
      </Wrapper>,
    );
  });
}

function mockSSE(events: LLMStreamEvent[], opts?: { delay?: number }): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const e of events) {
        if (opts?.delay) {
          await new Promise((r) => setTimeout(r, opts.delay));
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

function pendingSSE(): {
  response: Response;
  emit: (e: LLMStreamEvent) => void;
  close: () => void;
} {
  const encoder = new TextEncoder();
  let ctrl!: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      ctrl = controller;
    },
  });
  return {
    response: new Response(stream, { status: 200 }),
    emit: (e: LLMStreamEvent) => ctrl.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`)),
    close: () => ctrl.close(),
  };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  logEventMock.mockReset();
  hookRef = null;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  try {
    act(() => root.unmount());
  } catch {
    // ignore
  }
  container.remove();
  vi.restoreAllMocks();
});

describe('useLLM', () => {
  it('happy path: deltas accumulate, done finalizes assistant message', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockSSE([
        { type: 'delta', content: 'Hello' },
        { type: 'delta', content: ', ' },
        { type: 'delta', content: 'world' },
        { type: 'done', latency_ms: 100, total_tokens: 42, tool_rounds: 0 },
      ]),
    );
    vi.stubGlobal('fetch', fetchMock);

    mount();
    await act(async () => {
      await hookRef!.sendMessage('hi');
    });
    await flush();

    expect(hookRef!.status).toBe('done');
    expect(hookRef!.messages).toHaveLength(2);
    expect(hookRef!.messages[0]).toMatchObject({ role: 'user', content: 'hi' });
    expect(hookRef!.messages[1]).toMatchObject({ role: 'assistant', content: 'Hello, world' });
    expect(logEventMock).toHaveBeenCalledWith(
      'llm_call',
      expect.objectContaining({ latency_ms: 100, total_tokens: 42, tool_rounds: 0 }),
      'CHAT-DEBUG',
    );
  });

  it('tool loop: tool_call/tool_result attach to assistant message', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockSSE([
        { type: 'tool_call', id: 't1', name: 'lookup', args: { q: 'x' } },
        { type: 'tool_result', id: 't1', ok: true, result: { answer: 7 } },
        { type: 'delta', content: 'Answer is 7' },
        { type: 'done', latency_ms: 80, total_tokens: 30, tool_rounds: 1 },
      ]),
    );
    vi.stubGlobal('fetch', fetchMock);

    mount();
    await act(async () => {
      await hookRef!.sendMessage('q');
    });
    await flush();

    expect(hookRef!.status).toBe('done');
    const assistant = hookRef!.messages[1];
    expect(assistant.content).toBe('Answer is 7');
    expect(assistant.toolEvents).toHaveLength(1);
    expect(assistant.toolEvents![0]).toMatchObject({
      id: 't1',
      name: 'lookup',
      result: { ok: true, payload: { answer: 7 } },
    });
    expect(hookRef!.toolEvents).toHaveLength(0);
  });

  it('error frame: status=error, no assistant message appended', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockSSE([
        { type: 'delta', content: 'partial' },
        { type: 'error', code: 'BAD', message: 'broken' },
      ]),
    );
    vi.stubGlobal('fetch', fetchMock);

    mount();
    await act(async () => {
      await hookRef!.sendMessage('hi');
    });
    await flush();

    expect(hookRef!.status).toBe('error');
    expect(hookRef!.error).toBeInstanceOf(Error);
    expect(hookRef!.error!.message).toBe('BAD: broken');
    expect(hookRef!.messages).toHaveLength(1);
    expect(hookRef!.messages[0].role).toBe('user');
  });

  it('cancel mid-stream: status=idle, no error', async () => {
    const pending = pendingSSE();
    const fetchMock = vi.fn().mockImplementation((_url, init?: RequestInit) => {
      const signal = init?.signal;
      if (signal) {
        signal.addEventListener('abort', () => {
          try {
            pending.close();
          } catch {
            // ignore
          }
        });
      }
      return Promise.resolve(pending.response);
    });
    vi.stubGlobal('fetch', fetchMock);

    mount();
    let sendPromise!: Promise<void>;
    act(() => {
      sendPromise = hookRef!.sendMessage('hi');
    });
    await flush();
    expect(hookRef!.status).toBe('streaming');

    act(() => {
      hookRef!.cancel();
    });
    await act(async () => {
      await sendPromise;
    });
    await flush();

    expect(hookRef!.status).toBe('idle');
    expect(hookRef!.error).toBeNull();
  });

  it('reset clears messages after a done turn', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockSSE([
        { type: 'delta', content: 'ok' },
        { type: 'done', latency_ms: 1, total_tokens: 1, tool_rounds: 0 },
      ]),
    );
    vi.stubGlobal('fetch', fetchMock);

    mount();
    await act(async () => {
      await hookRef!.sendMessage('hi');
    });
    await flush();
    expect(hookRef!.messages).toHaveLength(2);

    act(() => {
      hookRef!.reset();
    });
    await flush();

    expect(hookRef!.messages).toHaveLength(0);
    expect(hookRef!.status).toBe('idle');
    expect(hookRef!.response).toBe('');
  });

  it('concurrent sendMessage during streaming is a no-op', async () => {
    const pending = pendingSSE();
    const fetchMock = vi.fn().mockResolvedValue(pending.response);
    vi.stubGlobal('fetch', fetchMock);

    mount();
    let firstPromise!: Promise<void>;
    act(() => {
      firstPromise = hookRef!.sendMessage('first');
    });
    await flush();
    expect(hookRef!.status).toBe('streaming');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await hookRef!.sendMessage('second');
    });
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(hookRef!.messages.filter((m) => m.role === 'user')).toHaveLength(1);

    act(() => {
      pending.emit({ type: 'done', latency_ms: 1, total_tokens: 1, tool_rounds: 0 });
      pending.close();
    });
    await act(async () => {
      await firstPromise;
    });
  });

  it('seeds messages from initialMessages on mount without fetching history', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    let seeded: UseLLMReturn | null = null;
    function SeedBridge() {
      const v = useLLM('CHAT-DEBUG', {
        chatSessionId: 'sess-1',
        initialMessages: [
          { id: 'h1', role: 'user', content: 'earlier' },
          { id: 'h2', role: 'assistant', content: 'prior reply' },
        ],
      });
      useEffect(() => {
        seeded = v;
      });
      return null;
    }
    act(() => {
      root.render(
        <Wrapper>
          <SeedBridge />
        </Wrapper>,
      );
    });
    await flush();

    expect(seeded!.messages).toHaveLength(2);
    expect(seeded!.messages[0]).toMatchObject({ role: 'user', content: 'earlier' });
    // session endpoint already returned history — no extra mount fetch
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('seeds once per chatSessionId; same id with new initialMessages ref does not re-seed', async () => {
    vi.stubGlobal('fetch', vi.fn());

    let seeded: UseLLMReturn | null = null;
    function SeedBridge({
      initials,
    }: {
      initials: { id: string; role: 'user'; content: string }[];
    }) {
      const v = useLLM('CHAT-DEBUG', { chatSessionId: 'sess-A', initialMessages: initials });
      useEffect(() => {
        seeded = v;
      });
      return null;
    }
    act(() => {
      root.render(
        <Wrapper>
          <SeedBridge initials={[{ id: 'a', role: 'user', content: 'first' }]} />
        </Wrapper>,
      );
    });
    await flush();
    expect(seeded!.messages).toHaveLength(1);

    // Re-render with a different initialMessages ref but same chatSessionId
    act(() => {
      root.render(
        <Wrapper>
          <SeedBridge initials={[{ id: 'b', role: 'user', content: 'second' }]} />
        </Wrapper>,
      );
    });
    await flush();
    expect(seeded!.messages).toHaveLength(1);
    expect(seeded!.messages[0].content).toBe('first');
  });

  it('switching chatSessionId re-seeds', async () => {
    vi.stubGlobal('fetch', vi.fn());

    let seeded: UseLLMReturn | null = null;
    function SeedBridge({
      sid,
      initials,
    }: {
      sid: string;
      initials: { id: string; role: 'user'; content: string }[];
    }) {
      const v = useLLM('CHAT-DEBUG', { chatSessionId: sid, initialMessages: initials });
      useEffect(() => {
        seeded = v;
      });
      return null;
    }
    act(() => {
      root.render(
        <Wrapper>
          <SeedBridge sid="sess-1" initials={[{ id: 'a', role: 'user', content: 'one' }]} />
        </Wrapper>,
      );
    });
    await flush();
    expect(seeded!.messages[0].content).toBe('one');

    act(() => {
      root.render(
        <Wrapper>
          <SeedBridge sid="sess-2" initials={[{ id: 'b', role: 'user', content: 'two' }]} />
        </Wrapper>,
      );
    });
    await flush();
    expect(seeded!.messages).toHaveLength(1);
    expect(seeded!.messages[0].content).toBe('two');
  });

  it('tool-only turn (no text) appends no assistant bubble', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockSSE([
        { type: 'tool_call', id: 't1', name: 'submit_path_choice', args: { path: 'simple' } },
        { type: 'tool_result', id: 't1', ok: true, result: { path: 'simple' } },
        { type: 'done', latency_ms: 10, total_tokens: 5, tool_rounds: 1 },
      ]),
    );
    vi.stubGlobal('fetch', fetchMock);

    mount();
    await act(async () => {
      await hookRef!.sendMessage('i already have habits');
    });
    await flush();

    expect(hookRef!.status).toBe('done');
    // only the user turn; no empty assistant bubble
    expect(hookRef!.messages).toHaveLength(1);
    expect(hookRef!.messages[0].role).toBe('user');
  });

  it('truly empty turn (no text, no tools) appends a fallback assistant line', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        mockSSE([{ type: 'done', latency_ms: 10, total_tokens: 5, tool_rounds: 0 }]),
      );
    vi.stubGlobal('fetch', fetchMock);

    mount();
    await act(async () => {
      await hookRef!.sendMessage('hello?');
    });
    await flush();

    expect(hookRef!.status).toBe('done');
    expect(hookRef!.messages).toHaveLength(2);
    expect(hookRef!.messages[1].role).toBe('assistant');
    expect(hookRef!.messages[1].content.trim().length).toBeGreaterThan(0);
  });

  it('stream ends with no terminal frame: status leaves streaming (not stuck)', async () => {
    // delta then close, no done/error — simulates a truncated/killed stream
    const fetchMock = vi.fn().mockResolvedValue(mockSSE([{ type: 'delta', content: 'partial' }]));
    vi.stubGlobal('fetch', fetchMock);

    mount();
    await act(async () => {
      await hookRef!.sendMessage('hi');
    });
    await flush();

    expect(hookRef!.status).not.toBe('streaming');
    expect(hookRef!.isStreaming).toBe(false);
  });

  it('threads input_mode into the request body (text), omits it when unset', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        mockSSE([{ type: 'done', latency_ms: 1, total_tokens: 1, tool_rounds: 0 }]),
      );
    vi.stubGlobal('fetch', fetchMock);

    act(() => {
      root.render(
        <Wrapper>
          <Bridge screenId="CHAT-DEBUG" chatSessionId="sess-im" inputMode="text" />
        </Wrapper>,
      );
    });
    await act(async () => {
      await hookRef!.sendMessage('hi');
    });
    await flush();

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.input_mode).toBe('text');

    fetchMock.mockClear();
    act(() => {
      root.render(
        <Wrapper>
          <Bridge screenId="CHAT-DEBUG" chatSessionId="sess-im2" />
        </Wrapper>,
      );
    });
    await act(async () => {
      await hookRef!.sendMessage('hi');
    });
    await flush();

    const bare = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(bare.input_mode).toBeUndefined();
  });

  it('sendMessage with no chatSessionId no-ops and warns in dev', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    act(() => {
      root.render(
        <Wrapper>
          <Bridge screenId="CHAT-DEBUG" chatSessionId={undefined} />
        </Wrapper>,
      );
    });
    await act(async () => {
      await hookRef!.sendMessage('orphan');
    });
    await flush();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(hookRef!.messages).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});
