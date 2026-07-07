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

  it('B56a: inserts a space when a confirmation sentence is glued to the next sentence', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockSSE([
        { type: 'delta', content: 'Your habit is set for weekdays.' },
        { type: 'delta', content: "Now, let's set your time." },
        { type: 'done', latency_ms: 90, total_tokens: 20, tool_rounds: 0 },
      ]),
    );
    vi.stubGlobal('fetch', fetchMock);

    mount();
    await act(async () => {
      await hookRef!.sendMessage('every day');
    });
    await flush();

    expect(hookRef!.messages[1]).toMatchObject({
      role: 'assistant',
      content: "Your habit is set for weekdays. Now, let's set your time.",
    });
  });

  it('B56a: repairs a glued seam across a tool round; streamed response equals final content', async () => {
    const pending = pendingSSE();
    const fetchMock = vi.fn().mockResolvedValue(pending.response);
    vi.stubGlobal('fetch', fetchMock);

    mount();
    let sendPromise!: Promise<void>;
    act(() => {
      sendPromise = hookRef!.sendMessage('every day');
    });
    await flush();

    // Round 1 text ends with terminal punctuation, no trailing space.
    act(() => {
      pending.emit({ type: 'delta', content: 'Your habit is set for weekdays.' });
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 60)); // let the 40ms coalescer flush
    });
    const streamedFirst = hookRef!.response;

    // Tool round between the two text segments.
    act(() => {
      pending.emit({ type: 'tool_call', id: 't1', name: 'add_habit', args: {} });
      pending.emit({ type: 'tool_result', id: 't1', ok: true, result: {} });
      // Round 2 opens glued to round 1 (model supplied no separator).
      pending.emit({ type: 'delta', content: "Now, let's set your time." });
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 60));
    });
    const streamedAll = hookRef!.response;

    act(() => {
      pending.emit({ type: 'done', latency_ms: 1, total_tokens: 1, tool_rounds: 1 });
      pending.close();
    });
    await act(async () => {
      await sendPromise;
    });
    await flush();

    const assistant = hookRef!.messages[1];
    // Exactly one space at the join.
    expect(assistant.content).toBe("Your habit is set for weekdays. Now, let's set your time.");
    // Invariant: what streamed (TTS chunker input) is byte-identical to the
    // final message content, so sentence-chunk offsets stay aligned.
    expect(streamedFirst).toBe('Your habit is set for weekdays.');
    expect(streamedAll).toBe(assistant.content);
  });

  it('B56a: no false positive on a mid-word delta split or lowercase continuation', async () => {
    const pending = pendingSSE();
    const fetchMock = vi.fn().mockResolvedValue(pending.response);
    vi.stubGlobal('fetch', fetchMock);

    mount();
    let sendPromise!: Promise<void>;
    act(() => {
      sendPromise = hookRef!.sendMessage('hi');
    });
    await flush();

    act(() => {
      pending.emit({ type: 'delta', content: 'Set for wee' });
      pending.emit({ type: 'delta', content: 'kdays. It ends.' });
      pending.emit({ type: 'delta', content: ' and more' });
      pending.emit({ type: 'done', latency_ms: 1, total_tokens: 1, tool_rounds: 0 });
      pending.close();
    });
    await act(async () => {
      await sendPromise;
    });
    await flush();

    expect(hookRef!.messages[1].content).toBe('Set for weekdays. It ends. and more');
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

  it('idle watchdog: a silent stream errors out with llm_timeout instead of stalling', async () => {
    vi.useFakeTimers();
    try {
      const pending = pendingSSE();
      const fetchMock = vi.fn().mockImplementation((_url, init?: RequestInit) => {
        init?.signal?.addEventListener('abort', () => {
          try {
            pending.close();
          } catch {
            // ignore
          }
        });
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

      await act(async () => {
        vi.advanceTimersByTime(30_000);
      });
      await act(async () => {
        await sendPromise;
      });
      await flush();

      expect(hookRef!.status).toBe('error');
      expect(hookRef!.error?.message).toMatch(/^llm_timeout/);
    } finally {
      vi.useRealTimers();
    }
  });

  it('idle watchdog: events re-arm the timer, so a slow multi-round stream is untouched', async () => {
    vi.useFakeTimers();
    try {
      const pending = pendingSSE();
      const fetchMock = vi.fn().mockImplementation((_url, init?: RequestInit) => {
        init?.signal?.addEventListener('abort', () => {
          try {
            pending.close();
          } catch {
            // ignore
          }
        });
        return Promise.resolve(pending.response);
      });
      vi.stubGlobal('fetch', fetchMock);

      mount();
      let sendPromise!: Promise<void>;
      act(() => {
        sendPromise = hookRef!.sendMessage('hi');
      });
      await flush();

      // 20s of silence, then progress, then 20s more — never a 30s gap.
      await act(async () => {
        vi.advanceTimersByTime(20_000);
      });
      act(() => {
        pending.emit({ type: 'delta', content: 'still ' });
      });
      await flush();
      await act(async () => {
        vi.advanceTimersByTime(20_000);
      });
      act(() => {
        pending.emit({ type: 'delta', content: 'here' });
        pending.emit({ type: 'done', latency_ms: 1, total_tokens: 1, tool_rounds: 0 });
        pending.close();
      });
      await act(async () => {
        await sendPromise;
      });
      await flush();

      expect(hookRef!.status).toBe('done');
      expect(hookRef!.error).toBeNull();
    } finally {
      vi.useRealTimers();
    }
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

  it('tool_failed: captured in toolFailures and survives the done event', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockSSE([
        { type: 'tool_call', id: 'w1', name: 'create_habit', args: { name: 'm' } },
        { type: 'tool_result', id: 'w1', ok: false, result: { error: 'handler_error' } },
        {
          type: 'tool_failed',
          id: 'w1',
          name: 'create_habit',
          error: 'handler_error',
          message: 'db exploded',
        },
        { type: 'delta', content: "couldn't save" },
        { type: 'done', latency_ms: 10, total_tokens: 5, tool_rounds: 1 },
      ]),
    );
    vi.stubGlobal('fetch', fetchMock);

    mount();
    await act(async () => {
      await hookRef!.sendMessage('add m');
    });
    await flush();

    expect(hookRef!.status).toBe('done');
    // toolEvents cleared on done; toolFailures must survive.
    expect(hookRef!.toolEvents).toHaveLength(0);
    expect(hookRef!.toolFailures).toHaveLength(1);
    expect(hookRef!.toolFailures[0]).toMatchObject({
      id: 'w1',
      name: 'create_habit',
      error: 'handler_error',
      message: 'db exploded',
    });
  });

  it('tool_failed: cleared at the next runStream start', async () => {
    const failing = mockSSE([
      { type: 'tool_call', id: 'w1', name: 'create_habit', args: {} },
      { type: 'tool_result', id: 'w1', ok: false, result: {} },
      { type: 'tool_failed', id: 'w1', name: 'create_habit', error: 'handler_error' },
      { type: 'done', latency_ms: 1, total_tokens: 1, tool_rounds: 1 },
    ]);
    const clean = mockSSE([
      { type: 'delta', content: 'done' },
      { type: 'done', latency_ms: 1, total_tokens: 1, tool_rounds: 0 },
    ]);
    const fetchMock = vi.fn().mockResolvedValueOnce(failing).mockResolvedValueOnce(clean);
    vi.stubGlobal('fetch', fetchMock);

    mount();
    await act(async () => {
      await hookRef!.sendMessage('first');
    });
    await flush();
    expect(hookRef!.toolFailures).toHaveLength(1);

    await act(async () => {
      await hookRef!.sendMessage('second');
    });
    await flush();
    expect(hookRef!.toolFailures).toHaveLength(0);
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

  it('seedOpener sends prior_opener on the next chat send, once, then clears it', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        mockSSE([{ type: 'done', latency_ms: 1, total_tokens: 1, tool_rounds: 0 }]),
      );
    vi.stubGlobal('fetch', fetchMock);

    mount();
    act(() => {
      hookRef!.seedOpener('Good morning. Ready to check in?', {
        id: 'op-1',
        name: 'query_checkin',
        args: {},
        result: { ok: true, payload: { result: {} } },
      });
    });

    await act(async () => {
      await hookRef!.sendMessage('slept ok');
    });
    await flush();
    const body1 = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
    expect(body1.prior_opener).toBe('Good morning. Ready to check in?');

    await act(async () => {
      await hookRef!.sendMessage('mood good');
    });
    await flush();
    const body2 = JSON.parse((fetchMock.mock.calls[1][1] as { body: string }).body);
    expect(body2.prior_opener).toBeUndefined();

    expect(
      hookRef!.messages.some(
        (m) => m.role === 'assistant' && m.content === 'Good morning. Ready to check in?',
      ),
    ).toBe(true);
  });
});
