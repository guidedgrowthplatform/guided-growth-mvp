/** @vitest-environment jsdom */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * B58: useOnboardingChat's reply speech (send-opener-speech) must never race a
 * beat that another audio path already owns (M1/M2), and a beat advance mid-
 * turn must release the CAPTURED claim, not whatever screen the ref has
 * drifted to by release time (M5). Covers the double-arm shape from the QA
 * walks: 60-75 "backed off" warns, most of them repeats on the same beat.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionLogContext, type SessionLogContextValue } from '@/contexts/SessionLogContext';
import type { VoiceMessage } from '@/contexts/useOnboardingVoiceSession';
import {
  claimBeatAudio,
  peekBeatAudioOwner,
  resetBeatAudioOwnerForTests,
} from '@/onboarding-flow/renderer/beatAudioOwner';
import { useAuthStore } from '@/stores/authStore';
import type { LLMStreamEvent } from '@gg/shared/types/llm';
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

const beginSpeechTurnMock = vi.fn((_opts?: { onReveal?: (text: string) => void }) => 1);
const endSpeechTurnMock = vi.fn(() => Promise.resolve());
const pushSpeechChunkMock = vi.fn((_text: string, _opts?: { volume?: number }) => {});
const speakMock = vi.fn(
  (_text: string, _opts?: { rate?: number; pitch?: number; volume?: number }) => Promise.resolve(),
);
const stopTTSMock = vi.fn();
vi.mock('@/lib/services/tts-service', () => ({
  beginSpeechTurn: (opts?: { onReveal?: (text: string) => void }) => beginSpeechTurnMock(opts),
  endSpeechTurn: () => endSpeechTurnMock(),
  pushSpeechChunk: (text: string, opts?: { volume?: number }) => pushSpeechChunkMock(text, opts),
  speak: (text: string, opts?: { rate?: number; pitch?: number; volume?: number }) =>
    speakMock(text, opts),
  stopTTS: () => stopTTSMock(),
  ttsKaraokeActive: () => false,
  useTtsPlaybackStore: { getState: () => ({ isSpeaking: false }) },
}));

// Spy-wrap (not replace) the real registry so tests can assert call counts
// (the M2 latch) while still exercising the real claim/release/peek logic.
vi.mock('@/onboarding-flow/renderer/beatAudioOwner', async (orig) => {
  const actual = await orig<typeof import('@/onboarding-flow/renderer/beatAudioOwner')>();
  return {
    ...actual,
    peekBeatAudioOwner: vi.fn(actual.peekBeatAudioOwner),
    claimBeatAudio: vi.fn(actual.claimBeatAudio),
  };
});

const sessionCtx: SessionLogContextValue = {
  sessionId: 'test-session-id-1234567890',
  logEvent: vi.fn(),
  startVoice: vi.fn(() => 'anchor'),
  endVoice: vi.fn(),
};

// A stream whose first delta sends immediately; every subsequent delta, and
// finally 'done', wait on their own gate - so a test can inspect state after
// EACH response update (not just once everything is bundled together).
function stagedSSE(deltas: string[]) {
  const releases: Array<() => void> = [];
  const gates: Promise<void>[] = deltas.map(() => new Promise<void>((r) => releases.push(r)));
  const encoder = new TextEncoder();
  const response = new Response(
    new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (e: LLMStreamEvent) =>
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
        send({ type: 'delta', content: deltas[0] });
        for (let i = 1; i < deltas.length; i++) {
          await gates[i - 1];
          send({ type: 'delta', content: deltas[i] });
        }
        await gates[deltas.length - 1];
        send({ type: 'done', latency_ms: 1, total_tokens: 1, tool_rounds: 0 });
        controller.close();
      },
    }),
    { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
  );
  return { response, release: (i: number) => releases[i]() };
}

let hookRef: UseOnboardingChatReturn | null = null;
// Stable references (not recreated per render) - a fresh closure per render
// would make the streamed-TTS effect's dep array churn on every re-render,
// an artifact of the test harness, not of real callers (theirs are memoized).
const noopStartThread: UseOnboardingChatArgs['startThread'] = () => {};
const noopAppendMessage = () => {};
const noopEmitAssistant = () => {};
const noopVoiceAction = () => {};
const noopAdvance = () => {};
interface BridgeProps {
  screenId: string;
  speakReplies?: boolean;
  appendMessage?: (m: VoiceMessage) => void;
}
function Bridge({ screenId, speakReplies = true, appendMessage = noopAppendMessage }: BridgeProps) {
  const v = useOnboardingChat({
    screenId,
    enabled: true,
    orbState: 'voice_out_only',
    coachingStyle: 'warm',
    appendMessage,
    startThread: noopStartThread,
    emitAssistant: noopEmitAssistant,
    onVoiceAction: noopVoiceAction,
    onAdvance: noopAdvance,
    speakReplies,
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
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
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

// useLLM coalesces deltas behind a real 40ms setTimeout (DELTA_COALESCE_MS) -
// a mid-stream delta needs real time to pass, not just drained microtasks.
async function flushDelta() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 60));
  });
}

function render(props: BridgeProps) {
  act(() => {
    root.render(
      <Wrapper>
        <Bridge {...props} />
      </Wrapper>,
    );
  });
}

beforeEach(() => {
  hookRef = null;
  useAuthStore.setState({ user: { id: 'u1' } as never });
  resetBeatAudioOwnerForTests();
  beginSpeechTurnMock.mockClear();
  endSpeechTurnMock.mockClear();
  pushSpeechChunkMock.mockClear();
  speakMock.mockClear();
  stopTTSMock.mockClear();
  (peekBeatAudioOwner as ReturnType<typeof vi.fn>).mockClear();
  (claimBeatAudio as ReturnType<typeof vi.fn>).mockClear();
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
  vi.unstubAllGlobals();
  resetBeatAudioOwnerForTests();
});

describe('B58: a beat already held by narration-driver denies reply speech silently', () => {
  it('no warn, no TTS chunk, text still lands, latched across chunks, then speaks once freed', async () => {
    const BEAT = 'ONBOARD-BEGINNER-01';
    // The narration driver already owns this beat's audio (mid-script).
    claimBeatAudio(BEAT, 'narration-driver');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const appended: VoiceMessage[] = [];
    const appendMessage = (m: VoiceMessage) => appended.push(m);
    const { response: gated, release } = stagedSSE(['Hi there. ', 'How are you today my friend? ']);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(gated));

    render({ screenId: BEAT, appendMessage });
    await flush();

    await act(async () => {
      hookRef!.sendUserTurn('hey');
    });
    await flush();
    await flushDelta();

    // First chunk boundary: peeked, denied (different owner), skipped silently.
    expect(warn).not.toHaveBeenCalled();
    expect(pushSpeechChunkMock).not.toHaveBeenCalled();
    expect(beginSpeechTurnMock).not.toHaveBeenCalled();
    const peeksAfterFirstChunk = (peekBeatAudioOwner as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(peeksAfterFirstChunk).toBeGreaterThan(0);

    // Second delta lands mid-stream (still no 'done'): the M2 latch must not
    // re-peek per chunk.
    await act(async () => {
      release(0);
    });
    await flush();
    await flushDelta();
    expect(warn).not.toHaveBeenCalled();
    expect(pushSpeechChunkMock).not.toHaveBeenCalled();
    expect((peekBeatAudioOwner as ReturnType<typeof vi.fn>).mock.calls.length).toBe(
      peeksAfterFirstChunk,
    );

    // Turn finalizes: text still renders even though it was never spoken.
    await act(async () => {
      release(1);
    });
    await flush();
    await flushDelta();
    expect(appended.some((m) => m.role === 'ai' && m.text.includes('Hi there'))).toBe(true);
    expect(speakMock).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();

    // Free the beat (scriptDone): the NEXT turn claims and speaks normally.
    const { releaseBeatAudio } = await import('@/onboarding-flow/renderer/beatAudioOwner');
    releaseBeatAudio(BEAT, 'narration-driver');

    // Staged (not one-shot mockSSE): a delta immediately followed by 'done'
    // batches into a single render, skipping the streamed-chunk path entirely
    // and landing only via the one-shot fallback - staging gives the chunked
    // path a real intermediate render to run in, same as the first turn above.
    const { response: gated2, release: release2 } = stagedSSE(['Sure thing. ']);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(gated2));
    await act(async () => {
      hookRef!.sendUserTurn('go on');
    });
    await flush();
    await flushDelta();

    expect(pushSpeechChunkMock).toHaveBeenCalled();
    expect(beginSpeechTurnMock).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();

    await act(async () => {
      release2(0);
    });
    await flush();
    await flushDelta();
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('B58 (M5/M3): a beat advance mid-turn releases the CAPTURED sid, not the drifted one', () => {
  it('beat A claim is freed on advance to B; B claims cleanly with zero warns', async () => {
    const BEAT_A = 'ONBOARD-FORK--FORM';
    const BEAT_B = 'ONBOARD-BEGINNER-01';
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { response: gated } = stagedSSE(['Speaking now. ']);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(gated));

    render({ screenId: BEAT_A });
    await flush();

    await act(async () => {
      hookRef!.sendUserTurn('go');
    });
    await flush();
    await flushDelta();

    // Claimed and actively speaking on beat A.
    expect(pushSpeechChunkMock).toHaveBeenCalled();
    expect(peekBeatAudioOwner(BEAT_A)).toBe('send-opener-speech');

    // Beat advances (tool-driven) while the reply is still draining.
    render({ screenId: BEAT_B });
    await flush();

    expect(stopTTSMock).toHaveBeenCalled();
    expect(peekBeatAudioOwner(BEAT_A)).toBeNull();

    // A fresh narration claim on the NEW beat succeeds with zero warns.
    expect(claimBeatAudio(BEAT_B, 'narration-driver')).toBe(true);
    expect(warn).not.toHaveBeenCalled();
  });
});
