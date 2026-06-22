/** @vitest-environment jsdom */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LLMChatMessage } from '@gg/shared/types/llm';
import { useCoachChat } from '../useCoachChat';

const sendOpenerMock = vi.fn(() => Promise.resolve());
const trackCheckinStartedMock = vi.fn();

// useChatHistory drives initialMessages + ready status (the empty-welcome gate).
let historyMessages: LLMChatMessage[] = [];
vi.mock('@/hooks/useChatHistory', () => ({
  useChatHistory: () => ({
    initialMessages: historyMessages,
    loadOlder: vi.fn(() => Promise.resolve([])),
    hasMore: false,
    loadingOlder: false,
    status: 'ready',
  }),
}));

vi.mock('@/analytics/coachFunnel', () => ({
  isCheckinScreen: (s: string) => s === 'MCHECK-01' || s === 'ECHECK-01',
  trackCheckinStarted: (s: string) => trackCheckinStartedMock(s),
}));

vi.mock('@/hooks/useVoiceInCapture', () => ({
  useVoiceInCapture: () => ({ isListening: false }),
}));

vi.mock('@/hooks/useLLM', () => ({
  useLLM: (_screenId: string, opts?: { initialMessages?: LLMChatMessage[] }) => ({
    sendMessage: vi.fn(() => Promise.resolve()),
    sendOpener: sendOpenerMock,
    prependMessages: vi.fn(),
    messages: opts?.initialMessages ?? [],
    response: '',
    toolEvents: [],
    status: 'idle',
    isStreaming: false,
    error: null,
    reset: vi.fn(),
    cancel: vi.fn(),
  }),
}));

vi.mock('@/hooks/useChatSession', () => ({
  useChatSession: () => ({ chatSessionId: 'sess-1', status: 'ready' }),
}));

vi.mock('@/hooks/useVoice', () => ({
  useVoice: () => ({
    acquireRealtime: vi.fn(() => null),
    releaseToken: vi.fn(),
    setStatus: vi.fn(),
  }),
}));

vi.mock('@/hooks/useDualButtonControls', () => ({
  useDualButtonControls: () => ({ micOn: false }),
}));

vi.mock('@/hooks/useUserPreferences', () => ({
  useUserPreferences: () => ({ preferences: { voiceMode: 'text', micEnabled: false } }),
}));

vi.mock('@/hooks/useCoachChatToolEvents', () => ({ useCoachChatToolEvents: () => null }));

vi.mock('@/stores/voiceStore', () => ({
  useVoiceStore: (sel: (s: { setInterim: () => void }) => unknown) => sel({ setInterim: vi.fn() }),
}));

vi.mock('@/lib/services/tts-service', () => ({
  stopTTS: vi.fn(),
  speak: vi.fn(() => Promise.resolve()),
  beginSpeechTurn: vi.fn(),
  endSpeechTurn: vi.fn(() => Promise.resolve()),
  pushSpeechChunk: vi.fn(),
  isWsTransport: () => false,
  ttsKaraokeActive: () => false,
  ttsWarm: vi.fn(),
  useTtsPlaybackStore: (sel: (s: { isSpeaking: boolean }) => unknown) => sel({ isSpeaking: false }),
}));

vi.mock('@/lib/services/cartesia-token-cache', () => ({
  startTokenWarmLoop: vi.fn(),
  stopTokenWarmLoop: vi.fn(),
}));
vi.mock('@/lib/services/soniox-temp-key-cache', () => ({
  startKeyWarmLoop: vi.fn(),
  stopKeyWarmLoop: vi.fn(),
}));

let container: HTMLDivElement;
let root: Root;

function render(screenId: string, nonce: number) {
  function Bridge() {
    useCoachChat(screenId, { enabled: true, initiateCheckinNonce: nonce });
    return null;
  }
  act(() => root.render(<Bridge />));
  return {
    rerender: (s: string, n: number) => {
      function Re() {
        useCoachChat(s, { enabled: true, initiateCheckinNonce: n });
        return null;
      }
      act(() => root.render(<Re />));
    },
  };
}

beforeEach(() => {
  historyMessages = [];
  sendOpenerMock.mockReset();
  trackCheckinStartedMock.mockReset();
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
  vi.restoreAllMocks();
});

describe('useCoachChat — explicit check-in initiation + empty welcome', () => {
  it('empty timeline, no initiate → fires ONE welcome opener', () => {
    render('HOME-CHECKIN', 0);
    expect(sendOpenerMock).toHaveBeenCalledTimes(1);
    expect(trackCheckinStartedMock).not.toHaveBeenCalled();
  });

  it('non-empty timeline, no initiate → NO auto-opener', () => {
    historyMessages = [{ id: 'm1', role: 'assistant', content: 'hi from before' }];
    render('HOME-CHECKIN', 0);
    expect(sendOpenerMock).not.toHaveBeenCalled();
  });

  it('non-empty timeline + initiate → fires opener AND tracks start_checkin', () => {
    historyMessages = [{ id: 'm1', role: 'assistant', content: 'hi from before' }];
    render('MCHECK-01', 1);
    expect(sendOpenerMock).toHaveBeenCalledTimes(1);
    expect(trackCheckinStartedMock).toHaveBeenCalledWith('MCHECK-01');
  });

  it('empty timeline + initiate → fires exactly ONE opener (no double-fire)', () => {
    render('MCHECK-01', 1);
    expect(sendOpenerMock).toHaveBeenCalledTimes(1);
  });

  it('a second nonce bump fires the opener again', () => {
    historyMessages = [{ id: 'm1', role: 'assistant', content: 'prior' }];
    const { rerender } = render('MCHECK-01', 1);
    expect(sendOpenerMock).toHaveBeenCalledTimes(1);
    rerender('MCHECK-01', 2);
    expect(sendOpenerMock).toHaveBeenCalledTimes(2);
  });
});
