/** @vitest-environment jsdom */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  TURN_AGGREGATION_MS,
  TURN_PAUSE_COMPLETE_MS,
  TURN_PAUSE_INCOMPLETE_MS,
} from '@/config/voiceConfig';
import { useCoachChat } from '../useCoachChat';

// ─── Capture the voice-in callbacks so the test can drive Soniox finals/interims ──
let captured: {
  onTranscript?: (t: string) => void;
  onInterim?: (t: string) => void;
} = {};
vi.mock('@/hooks/useVoiceInCapture', () => ({
  useVoiceInCapture: (opts: {
    onTranscript?: (t: string) => void;
    onInterim?: (t: string) => void;
  }) => {
    captured.onTranscript = opts.onTranscript;
    captured.onInterim = opts.onInterim;
    return { isListening: false };
  },
}));

// ─── LLM stub: spy on sendMessage, idle (not streaming) so submitTurn fires it directly ──
const sendMessageMock = vi.fn(() => Promise.resolve());
vi.mock('@/hooks/useLLM', () => ({
  useLLM: () => ({
    sendMessage: sendMessageMock,
    sendOpener: vi.fn(() => Promise.resolve()),
    messages: [],
    response: '',
    toolEvents: [],
    toolFailures: [],
    status: 'idle',
    isStreaming: false,
    error: null,
    reset: vi.fn(),
    cancel: vi.fn(),
    prependMessages: vi.fn(() => 0),
  }),
}));

vi.mock('@/hooks/useChatSession', () => ({
  useChatSession: () => ({ chatSessionId: 'sess-1', initialMessages: [], status: 'ready' }),
}));

// Linear history must report 'ready' (not the real hook's jsdom error) so
// chatSessionId unblocks and submitTurn can fire (MR#1 gates error out).
vi.mock('@/hooks/useChatHistory', () => ({
  useChatHistory: () => ({
    initialMessages: [],
    loadOlder: vi.fn(() => Promise.resolve([])),
    hasMore: false,
    loadingOlder: false,
    status: 'ready',
  }),
}));

vi.mock('@/hooks/useVoice', () => ({
  useVoice: () => ({
    acquireRealtime: vi.fn(() => null),
    releaseToken: vi.fn(),
    setStatus: vi.fn(),
  }),
}));

vi.mock('@/hooks/useDualButtonControls', () => ({
  useDualButtonControls: () => ({ micOn: true }),
}));

vi.mock('@/hooks/useUserPreferences', () => ({
  useUserPreferences: () => ({ preferences: { voiceMode: 'text', micEnabled: true } }),
}));

vi.mock('@/hooks/useCoachChatToolEvents', () => ({
  useCoachChatToolEvents: () => null,
}));

// ─── voiceStore: setInterim selector ──
vi.mock('@/stores/voiceStore', () => ({
  useVoiceStore: (sel: (s: { setInterim: () => void }) => unknown) => sel({ setInterim: vi.fn() }),
}));

// ─── tts-service: stopTTS spy; useTtsPlaybackStore selector stub ──
const stopTTSMock = vi.fn();
vi.mock('@/lib/services/tts-service', () => ({
  stopTTS: () => stopTTSMock(),
  speak: vi.fn(() => Promise.resolve()),
  beginSpeechTurn: vi.fn(),
  endSpeechTurn: vi.fn(() => Promise.resolve()),
  pushSpeechChunk: vi.fn(),
  isAudioUnlocked: () => true,
  subscribeAudioUnlock: () => () => {},
  useTtsPlaybackStore: (sel: (s: { isSpeaking: boolean }) => unknown) => sel({ isSpeaking: false }),
}));

vi.mock('@/lib/services/soniox-temp-key-cache', () => ({
  startKeyWarmLoop: vi.fn(),
  stopKeyWarmLoop: vi.fn(),
}));

function Bridge() {
  useCoachChat('HOME-CHECKIN', { enabled: true });
  return null;
}

let container: HTMLDivElement;
let root: Root;

function render() {
  act(() => {
    root.render(<Bridge />);
  });
  return {
    unmount: () =>
      act(() => {
        root.unmount();
      }),
  };
}

beforeEach(() => {
  captured = {};
  sendMessageMock.mockReset();
  stopTTSMock.mockReset();
  vi.useFakeTimers();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  try {
    act(() => root.unmount());
  } catch {
    // already unmounted
  }
  container.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useCoachChat — #209 turn aggregation', () => {
  it('(a) aggregates consecutive finals into ONE turn after the quiet gap', () => {
    render();
    expect(captured.onTranscript).toBeTypeOf('function');

    act(() => captured.onTranscript!('first'));
    act(() => {
      vi.advanceTimersByTime(TURN_AGGREGATION_MS - 500); // < quiet gap
    });
    act(() => captured.onTranscript!('second'));

    // Still buffering — not flushed yet.
    expect(sendMessageMock).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(TURN_AGGREGATION_MS); // past the quiet gap from the 2nd final
    });

    expect(sendMessageMock).toHaveBeenCalledTimes(1);
    expect(sendMessageMock).toHaveBeenCalledWith('first second');
  });

  it('(b) a non-empty interim restarts the quiet timer; an empty interim does not', () => {
    render();

    act(() => captured.onTranscript!('hello'));
    act(() => {
      vi.advanceTimersByTime(TURN_AGGREGATION_MS - 400);
    });
    act(() => captured.onInterim!('still talking'));
    act(() => {
      vi.advanceTimersByTime(TURN_AGGREGATION_MS - 400); // only (gap-400) since interim reset
    });

    // Timer was reset by the interim — not flushed yet.
    expect(sendMessageMock).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(TURN_AGGREGATION_MS); // now past the quiet gap since the interim
    });
    expect(sendMessageMock).toHaveBeenCalledTimes(1);
    expect(sendMessageMock).toHaveBeenCalledWith('hello');

    // Empty interim must NOT defer the flush.
    sendMessageMock.mockReset();
    act(() => captured.onTranscript!('again'));
    act(() => {
      vi.advanceTimersByTime(TURN_AGGREGATION_MS - 500);
    });
    act(() => captured.onInterim!('')); // empty — no reset
    act(() => {
      vi.advanceTimersByTime(500); // full gap since the final → flush fires on schedule
    });
    expect(sendMessageMock).toHaveBeenCalledTimes(1);
    expect(sendMessageMock).toHaveBeenCalledWith('again');
  });

  it('(d) extends the quiet gap when the utterance sounds unfinished', () => {
    render();

    act(() => captured.onTranscript!('I want to talk about my goals and'));
    // Base window elapses, but this is an INCOMPLETE utterance → still waiting.
    act(() => {
      vi.advanceTimersByTime(TURN_AGGREGATION_MS);
    });
    expect(sendMessageMock).not.toHaveBeenCalled();

    // Past the longer incomplete window → now it flushes.
    act(() => {
      vi.advanceTimersByTime(TURN_PAUSE_INCOMPLETE_MS - TURN_AGGREGATION_MS);
    });
    expect(sendMessageMock).toHaveBeenCalledTimes(1);
    expect(sendMessageMock).toHaveBeenCalledWith('I want to talk about my goals and');
  });

  it('(e) flushes sooner when the utterance sounds finished', () => {
    render();

    act(() => captured.onTranscript!('Okay I am done.'));
    // The short "complete" window suffices — no need to wait the full base gap.
    act(() => {
      vi.advanceTimersByTime(TURN_PAUSE_COMPLETE_MS);
    });
    expect(sendMessageMock).toHaveBeenCalledTimes(1);
    expect(sendMessageMock).toHaveBeenCalledWith('Okay I am done.');
  });

  // Keep LAST: the in-test unmount + fake-timer advance leaves React's scheduler
  // in a state that breaks a subsequent synchronous mount in this file.
  it('(f) cleanup: after unmount, advancing timers does NOT flush', () => {
    const { unmount } = render();

    act(() => captured.onTranscript!('pending turn'));
    expect(sendMessageMock).not.toHaveBeenCalled();

    act(() => unmount());
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(sendMessageMock).not.toHaveBeenCalled();
  });
});
