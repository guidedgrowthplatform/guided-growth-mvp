/** @vitest-environment jsdom */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionLogContext, type SessionLogContextValue } from '@/contexts/SessionLogContext';
import { useAuthStore } from '@/stores/authStore';
import type { LLMStreamEvent } from '@gg/shared/types/llm';
import { useOnboardingChat, type UseOnboardingChatReturn } from '../useOnboardingChat';

vi.mock('@/api/chat', () => ({
  createOrResumeChatSession: vi.fn(async () => ({ chat_session_id: 'sess-1', messages: [] })),
}));
vi.mock('@/api/context', () => ({
  fetchScreenRoutes: vi.fn(async () => ({ routes: [] })),
}));

const sessionCtx: SessionLogContextValue = {
  sessionId: 'test-session-id-1234567890',
  logEvent: vi.fn(),
  startVoice: vi.fn(() => 'anchor'),
  endVoice: vi.fn(),
};

function mockSSE(events: LLMStreamEvent[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const e of events) controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

let hookRef: UseOnboardingChatReturn | null = null;
function Bridge() {
  const v = useOnboardingChat({
    screenId: 'ONBOARD-FORK--FORM',
    enabled: true,
    orbState: 'voice_in_only',
    coachingStyle: 'warm',
    appendMessage: vi.fn(),
    startThread: () => {},
    emitAssistant: vi.fn(),
    onVoiceAction: vi.fn(),
    onAdvance: vi.fn(),
  });
  useEffect(() => {
    hookRef = v;
  });
  return null;
}

let container: HTMLDivElement;
let root: Root;
const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <SessionLogContext.Provider value={sessionCtx}>{children}</SessionLogContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

// user_message of every POST /api/llm, in dispatch order
function dispatchedUserMessages(fetchMock: ReturnType<typeof vi.fn>): string[] {
  return fetchMock.mock.calls
    .filter((c) => String(c[0]).includes('/api/llm'))
    .map((c) => {
      try {
        return (JSON.parse((c[1] as RequestInit).body as string) as { user_message?: string })
          .user_message;
      } catch {
        return undefined;
      }
    })
    .filter((m): m is string => typeof m === 'string' && m.length > 0);
}

beforeEach(() => {
  hookRef = null;
  useAuthStore.setState({ user: { id: 'u1' } as never });
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

describe('useOnboardingChat — repeated identical turns (C5 voice silence)', () => {
  const TURN = 'i run three times a week';

  async function sendTurns(texts: string[]): Promise<string[]> {
    const fetchMock = vi.fn().mockImplementation(async () =>
      mockSSE([
        { type: 'delta', content: 'okay, noted.' },
        { type: 'done', latency_ms: 1, total_tokens: 1, tool_rounds: 0 },
      ]),
    );
    vi.stubGlobal('fetch', fetchMock);

    act(() => {
      root.render(
        <Wrapper>
          <Bridge />
        </Wrapper>,
      );
    });
    await flush();

    for (const text of texts) {
      await act(async () => {
        hookRef!.sendUserTurn(text);
      });
      // let the mock stream drain fully so the next turn starts idle
      await flush();
      await flush();
    }
    return dispatchedUserMessages(fetchMock);
  }

  it('five identical consecutive turns each dispatch to /api/llm', async () => {
    const sent = await sendTurns([TURN, TURN, TURN, TURN, TURN]);
    expect(sent).toEqual([TURN, TURN, TURN, TURN, TURN]);
  });

  it('alternating turns each dispatch to /api/llm (control)', async () => {
    const texts = ['first thing', 'second thing', 'first thing', 'second thing', 'first thing'];
    const sent = await sendTurns(texts);
    expect(sent).toEqual(texts);
  });

  it('a repeat landing while the reply is still streaming is queued, not dropped', async () => {
    // First call: a stream held open until released. Later calls: instant done.
    let releaseFirst!: () => void;
    const encoder = new TextEncoder();
    const heldStream = new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'delta', content: 'thinking…' })}\n\n`),
          );
          releaseFirst = () => {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: 'done', latency_ms: 1, total_tokens: 1, tool_rounds: 0 })}\n\n`,
              ),
            );
            controller.close();
          };
        },
      }),
      { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
    );
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async () => heldStream)
      .mockImplementation(async () =>
        mockSSE([{ type: 'done', latency_ms: 1, total_tokens: 1, tool_rounds: 0 }]),
      );
    vi.stubGlobal('fetch', fetchMock);

    act(() => {
      root.render(
        <Wrapper>
          <Bridge />
        </Wrapper>,
      );
    });
    await flush();

    await act(async () => {
      hookRef!.sendUserTurn(TURN);
    });
    await flush();
    expect(dispatchedUserMessages(fetchMock)).toEqual([TURN]);

    // Reply to turn 1 still streaming — the user repeats themselves.
    await act(async () => {
      hookRef!.sendUserTurn(TURN);
    });
    await flush();
    await act(async () => {
      releaseFirst();
    });
    await flush();
    await flush();

    // The repeat must reach the LLM once the first stream settles.
    expect(dispatchedUserMessages(fetchMock)).toEqual([TURN, TURN]);
  });
});
