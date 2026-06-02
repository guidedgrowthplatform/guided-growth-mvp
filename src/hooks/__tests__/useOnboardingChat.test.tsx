/** @vitest-environment jsdom */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createOrResumeChatSession } from '@/api/chat';
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
    startThread: vi.fn(),
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

beforeEach(() => {
  hookRef = null;
  // useChatSession requires an authed user id to mint a session.
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

describe('useOnboardingChat', () => {
  it('sendUserTurn on an onboarding screen reaches /api/llm once the session is ready', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
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
    // let useChatSession resolve so useLLM has a chatSessionId
    await flush();

    await act(async () => {
      hookRef!.sendUserTurn('i already have habits');
    });
    await flush();

    const llmCalled = fetchMock.mock.calls.some((c) => String(c[0]).includes('/api/llm'));
    expect(llmCalled).toBe(true);
  });

  it('buffers a voice-in turn sent before the session lands, flushing on ready', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        mockSSE([{ type: 'done', latency_ms: 1, total_tokens: 1, tool_rounds: 0 }]),
      );
    vi.stubGlobal('fetch', fetchMock);

    // Hold the session mint open so chatSessionId is null when the user speaks.
    let resolveSession!: (v: { chat_session_id: string; messages: [] }) => void;
    (createOrResumeChatSession as ReturnType<typeof vi.fn>).mockImplementationOnce(
      () => new Promise((r) => (resolveSession = r)),
    );

    act(() => {
      root.render(
        <Wrapper>
          <Bridge />
        </Wrapper>,
      );
    });
    await flush();

    // Session not ready → the turn is held, not sent.
    await act(async () => {
      hookRef!.sendUserTurn('opening words');
    });
    await flush();
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes('/api/llm'))).toBe(false);

    // Session lands → buffered turn flushes to the LLM.
    await act(async () => {
      resolveSession({ chat_session_id: 'sess-2', messages: [] });
    });
    await flush();
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes('/api/llm'))).toBe(true);
  });
});
