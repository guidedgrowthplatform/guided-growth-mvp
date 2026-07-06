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
import type { VoiceMessage } from '@/contexts/useOnboardingVoiceSession';
import { getOrCreateOnboardingChatSessionId } from '@/lib/onboarding/onboardingChatSession';
import { queryKeys } from '@/lib/query';
import { useAuthStore } from '@/stores/authStore';
import type { LLMStreamEvent, LLMToolEvent } from '@gg/shared/types/llm';
import { useChatToolEvents } from '../useChatToolEvents';
import {
  useOnboardingChat,
  type UseOnboardingChatArgs,
  type UseOnboardingChatReturn,
} from '../useOnboardingChat';

vi.mock('@/api/chat', () => ({
  createOrResumeChatSession: vi.fn(async () => ({ chat_session_id: 'sess-1', messages: [] })),
}));
vi.mock('@/api/context', () => ({
  fetchScreenRoutes: vi.fn(async () => ({ routes: [] })),
}));
vi.mock('@/lib/onboarding/onboardingChatSession', async (orig) => {
  const actual = await orig<typeof import('@/lib/onboarding/onboardingChatSession')>();
  return {
    ...actual,
    getOrCreateOnboardingChatSessionId: vi.fn(actual.getOrCreateOnboardingChatSessionId),
  };
});

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
const noopStartThread: UseOnboardingChatArgs['startThread'] = () => {};
interface BridgeProps {
  screenId?: string;
  enabled?: boolean;
  appendMessage?: (m: VoiceMessage) => void;
  onAdvance?: () => void;
  startThread?: UseOnboardingChatArgs['startThread'];
  chatNative?: boolean;
}
function Bridge({
  screenId = 'ONBOARD-FORK--FORM',
  enabled = true,
  appendMessage = vi.fn(),
  onAdvance = vi.fn(),
  startThread = noopStartThread,
  chatNative,
}: BridgeProps) {
  const v = useOnboardingChat({
    screenId,
    enabled,
    orbState: 'voice_in_only',
    coachingStyle: 'warm',
    appendMessage,
    startThread,
    emitAssistant: vi.fn(),
    onVoiceAction: vi.fn(),
    onAdvance,
    chatNative,
  });
  useEffect(() => {
    hookRef = v;
  });
  return null;
}

// Pull (screenId, openerId, mode) out of a captured startThread call.
function startThreadCall(spy: ReturnType<typeof vi.fn>, i: number) {
  const [screenId, initial, mode] = spy.mock.calls[i] as [
    string,
    { id: string }[],
    string | undefined,
  ];
  return { screenId, openerId: initial[0]?.id, mode };
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

    // Buffering needs the legacy async session: an authed, non-onboarding screen
    // (authed onboarding now takes the stable path, which mints its id synchronously).
    let resolveSession!: (v: { chat_session_id: string; messages: [] }) => void;
    (createOrResumeChatSession as ReturnType<typeof vi.fn>).mockImplementationOnce(
      () => new Promise((r) => (resolveSession = r)),
    );

    act(() => {
      root.render(
        <Wrapper>
          <Bridge screenId="CHAT" />
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

function advanceStepStream(): Response {
  return mockSSE([
    { type: 'tool_call', id: 'tc-1', name: 'advance_step', args: { target_step: 2 } },
    {
      type: 'tool_result',
      id: 'tc-1',
      ok: true,
      result: { ok: true, result: { current_step: 2 } },
    },
    { type: 'delta', content: 'great, all set' },
    { type: 'done', latency_ms: 1, total_tokens: 1, tool_rounds: 1 },
  ]);
}

function advanceEvt(id = 'tc-1', currentStep = 2): LLMToolEvent {
  return {
    id,
    name: 'advance_step',
    args: { target_step: currentStep },
    result: { ok: true, payload: { ok: true, result: { current_step: currentStep } } },
  };
}

describe('useChatToolEvents — latch keeps advance alive when enabled is false (Bug 2)', () => {
  type ToolBridgeProps = { events: LLMToolEvent[]; active: boolean; resetKey: string | null };
  function ToolBridge(props: ToolBridgeProps) {
    useChatToolEvents({
      toolEvents: props.events,
      active: props.active,
      routes: [],
      onVoiceAction: vi.fn(),
      resetKey: props.resetKey,
    });
    return null;
  }
  const renderTool = (p: ToolBridgeProps) =>
    act(() => {
      root.render(
        <Wrapper>
          <ToolBridge {...p} />
        </Wrapper>,
      );
    });
  const seed = (step: number) =>
    qc.setQueryData(queryKeys.onboarding.state, {
      current_step: step,
      data: {},
      path: null,
    } as never);
  const step = () =>
    (qc.getQueryData(queryKeys.onboarding.state) as { current_step?: number } | undefined)
      ?.current_step;

  it('advance bumps current_step when active stays true though enabled is false', () => {
    seed(1);
    renderTool({ events: [advanceEvt('tc-1', 2)], active: true, resetKey: 'ONBOARD-FORK--FORM' });
    expect(step()).toBe(2);
  });

  it('does not re-fire the same advance event id after a screen (resetKey) change', () => {
    seed(1);
    renderTool({ events: [advanceEvt('tc-1', 2)], active: true, resetKey: 'ONBOARD-FORK--FORM' });
    expect(step()).toBe(2);
    // Same id, higher step, same resetKey → deduped, no further merge.
    renderTool({ events: [advanceEvt('tc-1', 9)], active: true, resetKey: 'ONBOARD-FORK--FORM' });
    expect(step()).toBe(2);
    // New id under a new resetKey → merges.
    renderTool({ events: [advanceEvt('tc-2', 3)], active: true, resetKey: 'ONBOARD-GOAL--FORM' });
    expect(step()).toBe(3);
  });
});

describe('useOnboardingChat — final message mirrors after enabled flips false (Bug 2)', () => {
  it('final assistant message still appends after enabled flips false post-send', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(advanceStepStream()));
    const appended: VoiceMessage[] = [];
    const appendMessage = (m: VoiceMessage) => appended.push(m);

    act(() => {
      root.render(
        <Wrapper>
          <Bridge enabled appendMessage={appendMessage} />
        </Wrapper>,
      );
    });
    await flush();

    await act(async () => {
      hookRef!.sendUserTurn('done with this');
    });
    act(() => {
      root.render(
        <Wrapper>
          <Bridge enabled={false} appendMessage={appendMessage} />
        </Wrapper>,
      );
    });
    await flush();

    expect(appended.some((m) => m.role === 'ai' && m.text === 'great, all set')).toBe(true);
  });
});

const STABLE_ID = '11111111-2222-3333-4444-555555555555';

// chat_session_id flows into the /api/llm request body — read it back from the fetch stub.
function llmChatSessionIds(fetchMock: ReturnType<typeof vi.fn>): string[] {
  return fetchMock.mock.calls
    .filter((c) => String(c[0]).includes('/api/llm'))
    .map((c) => {
      const body = (c[1] as { body?: string } | undefined)?.body;
      return body ? (JSON.parse(body) as { chat_session_id?: string }).chat_session_id : undefined;
    })
    .filter((id): id is string => typeof id === 'string');
}

describe('stable onboarding session', () => {
  beforeEach(() => {
    (getOrCreateOnboardingChatSessionId as ReturnType<typeof vi.fn>).mockReturnValue(STABLE_ID);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('routes a user turn through useLLM with the stable chatSessionId (not useChatSession)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        mockSSE([{ type: 'done', latency_ms: 1, total_tokens: 1, tool_rounds: 0 }]),
      );
    vi.stubGlobal('fetch', fetchMock);

    act(() => {
      root.render(
        <Wrapper>
          <Bridge screenId="ONBOARD-FORK--FORM" />
        </Wrapper>,
      );
    });
    await flush();

    await act(async () => {
      hookRef!.sendUserTurn('i already have habits');
    });
    await flush();

    const ids = llmChatSessionIds(fetchMock);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.every((id) => id === STABLE_ID)).toBe(true);
    // Stable path ignores any legacy session — only the fixed id is ever used.
    expect(ids).not.toContain('sess-1');
  });

  it('keeps the same stable id across an onboarding screen change', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        mockSSE([{ type: 'done', latency_ms: 1, total_tokens: 1, tool_rounds: 0 }]),
      );
    vi.stubGlobal('fetch', fetchMock);

    act(() => {
      root.render(
        <Wrapper>
          <Bridge screenId="ONBOARD-FORK--FORM" />
        </Wrapper>,
      );
    });
    await flush();
    await act(async () => {
      hookRef!.sendUserTurn('first screen turn');
    });
    await flush();

    act(() => {
      root.render(
        <Wrapper>
          <Bridge screenId="ONBOARD-GOAL--FORM" />
        </Wrapper>,
      );
    });
    await flush();
    await act(async () => {
      hookRef!.sendUserTurn('second screen turn');
    });
    await flush();

    const ids = llmChatSessionIds(fetchMock);
    expect(ids.length).toBeGreaterThanOrEqual(2);
    expect(ids.every((id) => id === STABLE_ID)).toBe(true);
  });
});

describe('continuous thread (Phase 2, stable ON)', () => {
  beforeEach(() => {
    (getOrCreateOnboardingChatSessionId as ReturnType<typeof vi.fn>).mockReturnValue(STABLE_ID);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    qc.setQueryData(queryKeys.onboarding.state, null);
  });

  it('appends a unique opener per screen with mode "append" (no per-screen wipe)', async () => {
    const startThread = vi.fn();

    act(() => {
      root.render(
        <Wrapper>
          <Bridge screenId="ONBOARD-FORK--FORM" startThread={startThread} />
        </Wrapper>,
      );
    });
    await flush();

    act(() => {
      root.render(
        <Wrapper>
          <Bridge screenId="ONBOARD-BEGINNER-01" startThread={startThread} />
        </Wrapper>,
      );
    });
    await flush();

    expect(startThread).toHaveBeenCalledTimes(2);
    const a = startThreadCall(startThread, 0);
    const b = startThreadCall(startThread, 1);
    expect(a.mode).toBe('append');
    expect(b.mode).toBe('append');
    expect(a.openerId).toBe('opener-ONBOARD-FORK--FORM-0');
    expect(b.openerId).toBe('opener-ONBOARD-BEGINNER-01-1');
  });

  it('back-nav appends a distinct revisit opener (no React key collision)', async () => {
    qc.setQueryData(queryKeys.onboarding.state, { path: 'simple', data: {} } as never);
    const startThread = vi.fn();
    const render = (screenId: string) =>
      act(() => {
        root.render(
          <Wrapper>
            <Bridge screenId={screenId} startThread={startThread} />
          </Wrapper>,
        );
      });

    render('ONBOARD-FORK--FORM');
    await flush();
    render('ONBOARD-BEGINNER-01');
    await flush();
    render('ONBOARD-FORK--FORM');
    await flush();

    expect(startThread).toHaveBeenCalledTimes(3);
    const firstA = startThreadCall(startThread, 0);
    const revisitA = startThreadCall(startThread, 2);
    expect(revisitA.screenId).toBe('ONBOARD-FORK--FORM');
    expect(revisitA.mode).toBe('append');
    expect(revisitA.openerId).not.toBe(firstA.openerId);
    expect(revisitA.openerId).toBe('opener-ONBOARD-FORK--FORM-2');
  });
});

describe('legacy thread (unauthed)', () => {
  it('replaces per screen with the default mode (pre-login behavior)', async () => {
    useAuthStore.setState({ user: null });
    const startThread = vi.fn();

    act(() => {
      root.render(
        <Wrapper>
          <Bridge screenId="ONBOARD-FORK--FORM" startThread={startThread} />
        </Wrapper>,
      );
    });
    await flush();

    const call = startThreadCall(startThread, 0);
    expect(call.mode).toBeUndefined();
    expect(call.openerId).toBe('opener-ONBOARD-FORK--FORM');
  });
});

describe('suppresses a prior screen trailing coach line after navigation', () => {
  beforeEach(() => {
    (getOrCreateOnboardingChatSessionId as ReturnType<typeof vi.fn>).mockReturnValue(STABLE_ID);
  });

  it('drops the fork turn trailing line that lands after advancing to category', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const encoder = new TextEncoder();
    const gated = new Response(
      new ReadableStream<Uint8Array>({
        async start(controller) {
          const send = (e: LLMStreamEvent) =>
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
          send({ type: 'delta', content: 'The fact that you are here means something.' });
          await gate;
          send({ type: 'done', latency_ms: 1, total_tokens: 1, tool_rounds: 0 });
          controller.close();
        },
      }),
      { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
    );
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(gated));
    const appended: VoiceMessage[] = [];
    const appendMessage = (m: VoiceMessage) => appended.push(m);

    act(() => {
      root.render(
        <Wrapper>
          <Bridge screenId="ONBOARD-FORK--FORM" appendMessage={appendMessage} />
        </Wrapper>,
      );
    });
    await flush();
    await act(async () => {
      hookRef!.sendUserTurn('No I have not');
    });
    await flush();

    act(() => {
      root.render(
        <Wrapper>
          <Bridge screenId="ONBOARD-BEGINNER-01" appendMessage={appendMessage} />
        </Wrapper>,
      );
    });
    await flush();

    await act(async () => {
      release();
      await flush();
    });
    await flush();

    expect(appended.some((m) => m.text.includes('The fact that you are here'))).toBe(false);
  });

  it('renders the next coach reply after a suppression (one-shot, no leak)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockSSE([
          { type: 'delta', content: 'Got it, added that habit.' },
          { type: 'done', latency_ms: 1, total_tokens: 1, tool_rounds: 0 },
        ]),
      ),
    );
    const appended: VoiceMessage[] = [];
    const appendMessage = (m: VoiceMessage) => appended.push(m);

    // Land on a fresh screen → suppression armed by the opener-seed effect.
    act(() => {
      root.render(
        <Wrapper>
          <Bridge screenId="ONBOARD-BEGINNER-03" appendMessage={appendMessage} />
        </Wrapper>,
      );
    });
    await flush();

    await act(async () => {
      hookRef!.sendUserTurn('add a daily walk');
    });
    await flush();

    expect(appended.some((m) => m.role === 'ai' && m.text.includes('added that habit'))).toBe(true);
  });
});

describe('advance dispatch survives mid-stream mic-off end-to-end (Bug 2)', () => {
  it('advance_step still bumps current_step when the mic drops mid-stream', async () => {
    let releaseToolResult!: () => void;
    const gate = new Promise<void>((r) => (releaseToolResult = r));
    const encoder = new TextEncoder();
    const gatedStream = new Response(
      new ReadableStream<Uint8Array>({
        async start(controller) {
          const send = (e: LLMStreamEvent) =>
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
          send({ type: 'tool_call', id: 'tc-1', name: 'advance_step', args: { target_step: 3 } });
          await gate;
          send({
            type: 'tool_result',
            id: 'tc-1',
            ok: true,
            result: { ok: true, result: { current_step: 3 } },
          });
          controller.close();
        },
      }),
      { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
    );
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(gatedStream));
    qc.setQueryData(queryKeys.onboarding.state, {
      current_step: 2,
      data: {},
      path: null,
    } as never);
    const step = () =>
      (qc.getQueryData(queryKeys.onboarding.state) as { current_step?: number } | undefined)
        ?.current_step;

    act(() => {
      root.render(
        <Wrapper>
          <Bridge enabled />
        </Wrapper>,
      );
    });
    await flush();
    await act(async () => {
      hookRef!.sendUserTurn('done — let’s move on');
    });
    await flush();

    // Mic drops mid-stream → enabled flips false; the streamActiveRef latch keeps
    // toolActive true so the tool_result still dispatches.
    act(() => {
      root.render(
        <Wrapper>
          <Bridge enabled={false} />
        </Wrapper>,
      );
    });
    await flush();
    expect(step()).toBe(2);

    await act(async () => {
      releaseToolResult();
      await flush();
    });
    await flush();
    expect(step()).toBe(3);
  });
});

describe('revisit "move on" shortcut (already-complete screen)', () => {
  it('affirming on a complete revisited screen fires onAdvance directly (no stream)', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    // FORK with a chosen path → getOnboardingRevisitOpener marks it complete.
    qc.setQueryData(queryKeys.onboarding.state, {
      current_step: 2,
      data: {},
      path: 'simple',
    } as never);
    const onAdvance = vi.fn();

    act(() => {
      root.render(
        <Wrapper>
          <Bridge enabled screenId="ONBOARD-FORK--FORM" onAdvance={onAdvance} />
        </Wrapper>,
      );
    });
    await flush();

    await act(async () => {
      hookRef!.sendUserTurn('yes');
    });
    await flush();

    expect(onAdvance).toHaveBeenCalledTimes(1);
    // No LLM round-trip for the revisit shortcut.
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes('/api/llm'))).toBe(false);
  });
});

describe('LLM failure resilience: silent auto-retry then friendly bubble (B11)', () => {
  function errorStream(code = 'incomplete_response'): Response {
    return mockSSE([{ type: 'error', code, message: 'response truncated — please retry' }]);
  }

  it('retries a retryable error once, then lands ONE friendly bubble (never the raw code)', async () => {
    const appendMessage = vi.fn();
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(errorStream()));
    vi.stubGlobal('fetch', fetchMock);

    act(() => {
      root.render(
        <Wrapper>
          <Bridge appendMessage={appendMessage} />
        </Wrapper>,
      );
    });
    await flush();

    await act(async () => {
      hookRef!.sendUserTurn('every weekday at 7');
    });
    await flush();
    await flush();

    // First attempt + exactly one silent retry.
    const llmCalls = fetchMock.mock.calls.filter((c) => String(c[0]).includes('/api/llm'));
    expect(llmCalls.length).toBe(2);

    const bubbles = appendMessage.mock.calls.map((c) => c[0] as VoiceMessage);
    const errBubbles = bubbles.filter((b) => String(b.id).startsWith('llm-error-'));
    expect(errBubbles.length).toBe(1);
    expect(errBubbles[0].text).toBe("Something didn't work on my end. Mind saying that again?");
    expect(errBubbles[0].text).not.toMatch(/incomplete_response/);
  });

  it('a retry that succeeds produces no error bubble', async () => {
    const appendMessage = vi.fn();
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => Promise.resolve(errorStream('llm_timeout')))
      .mockImplementation(() =>
        Promise.resolve(
          mockSSE([
            { type: 'delta', content: 'all set' },
            { type: 'done', latency_ms: 1, total_tokens: 1, tool_rounds: 0 },
          ]),
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    act(() => {
      root.render(
        <Wrapper>
          <Bridge appendMessage={appendMessage} />
        </Wrapper>,
      );
    });
    await flush();

    await act(async () => {
      hookRef!.sendUserTurn('every weekday at 7');
    });
    await flush();
    await flush();

    const bubbles = appendMessage.mock.calls.map((c) => c[0] as VoiceMessage);
    expect(bubbles.some((b) => String(b.id).startsWith('llm-error-'))).toBe(false);
    expect(bubbles.some((b) => b.role === 'ai' && b.text === 'all set')).toBe(true);
  });

  it('a fresh user turn after a failed episode re-arms the retry (not permanently spent)', async () => {
    const appendMessage = vi.fn();
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(errorStream()));
    vi.stubGlobal('fetch', fetchMock);

    act(() => {
      root.render(
        <Wrapper>
          <Bridge appendMessage={appendMessage} />
        </Wrapper>,
      );
    });
    await flush();

    await act(async () => {
      hookRef!.sendUserTurn('first try');
    });
    await flush();
    await flush();
    const callsAfterFirst = fetchMock.mock.calls.filter((c) =>
      String(c[0]).includes('/api/llm'),
    ).length;
    expect(callsAfterFirst).toBe(2); // original + one retry

    await act(async () => {
      hookRef!.sendUserTurn('second try');
    });
    await flush();
    await flush();
    const callsAfterSecond = fetchMock.mock.calls.filter((c) =>
      String(c[0]).includes('/api/llm'),
    ).length;
    expect(callsAfterSecond).toBe(4); // another original + retry pair
  });
});

describe('scripted opener (B48): seeded verbatim, never LLM-generated + liveness', () => {
  beforeEach(() => {
    (getOrCreateOnboardingChatSessionId as ReturnType<typeof vi.fn>).mockReturnValue(STABLE_ID);
  });

  afterEach(() => {
    qc.setQueryData(queryKeys.onboarding.state, null);
  });

  it('a beat with an authored opener seeds it verbatim with the name substituted, with zero /api/llm calls', async () => {
    qc.setQueryData(queryKeys.onboarding.state, {
      current_step: 1,
      data: { nickname: 'Yonas' },
      path: null,
    } as never);
    const startThread = vi.fn();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    act(() => {
      root.render(
        <Wrapper>
          <Bridge screenId="ONBOARD-01--FORM" startThread={startThread} chatNative />
        </Wrapper>,
      );
    });
    await flush();
    await flush();

    // The scripted opener is seeded directly (no generation call in between).
    expect(fetchMock.mock.calls.filter((c) => String(c[0]).includes('/api/llm'))).toHaveLength(0);
    const call = startThreadCall(startThread, 0);
    expect(call.screenId).toBe('ONBOARD-01--FORM');
    const [, initial] = startThread.mock.calls[0] as [string, VoiceMessage[]];
    expect(initial[0]?.text).toContain('Yonas');
    expect(initial[0]?.text).not.toContain('{name}');
  });

  it('a genuine user turn on the same beat still dispatches to /api/llm (not a dead beat)', async () => {
    qc.setQueryData(queryKeys.onboarding.state, {
      current_step: 1,
      data: { nickname: 'Yonas' },
      path: null,
    } as never);
    const startThread = vi.fn();
    const appendMessage = vi.fn();
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        mockSSE([
          { type: 'delta', content: 'got it' },
          { type: 'done', latency_ms: 1, total_tokens: 1, tool_rounds: 0 },
        ]),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    act(() => {
      root.render(
        <Wrapper>
          <Bridge
            screenId="ONBOARD-01--FORM"
            startThread={startThread}
            appendMessage={appendMessage}
            chatNative
          />
        </Wrapper>,
      );
    });
    await flush();
    await flush();

    // No LLM call yet — the opener was seeded, not generated.
    expect(fetchMock.mock.calls.filter((c) => String(c[0]).includes('/api/llm'))).toHaveLength(0);

    await act(async () => {
      hookRef!.sendUserTurn('Yonas');
    });
    await flush();
    await flush();

    const llmCalls = fetchMock.mock.calls.filter((c) => String(c[0]).includes('/api/llm'));
    // The live user-turn call hits /api/llm — the beat is not dead just
    // because the opener never called the LLM.
    expect(llmCalls.length).toBeGreaterThanOrEqual(1);
    expect(
      appendMessage.mock.calls
        .map((c) => c[0] as VoiceMessage)
        .some((m) => m.role === 'ai' && m.text === 'got it'),
    ).toBe(true);
  });
});
