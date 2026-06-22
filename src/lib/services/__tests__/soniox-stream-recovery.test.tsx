/** @vitest-environment jsdom */
// #206 / #229 — a mic track ending (iOS background, device steal, app resume)
// must route through opts.onError with a RECOVERABLE reason so useVoiceInCapture
// auto-restarts a fresh getUserMedia + AudioContext, NOT terminally fail.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isRecoverableVoiceError } from '@/hooks/useVoiceInCapture';
import { startSonioxBrowserSession } from '@/lib/services/soniox-stream';

// Keep the key mint pending forever: the recovery paths fire from the track
// lifecycle, independent of any socket actually opening.
vi.mock('@/lib/services/soniox-temp-key-cache', () => ({
  takeTempKey: () => new Promise(() => {}),
}));
vi.mock('@/stores/audioMetricsStore', () => ({
  useAudioMetricsStore: { getState: () => ({ pushChunkRms: () => {}, reset: () => {} }) },
}));

interface FakeTrack {
  kind: 'audio';
  readyState: 'live' | 'ended';
  onended: (() => void) | null;
  stop: () => void;
  end: () => void;
}

function makeTrack(): FakeTrack {
  const t: FakeTrack = {
    kind: 'audio',
    readyState: 'live',
    onended: null,
    stop: vi.fn(),
    end() {
      this.readyState = 'ended';
      this.onended?.();
    },
  };
  return t;
}

let currentTrack: FakeTrack;

class FakeAudioWorklet {
  async addModule() {}
}
class FakeAudioContext {
  state = 'running';
  sampleRate = 48000;
  audioWorklet = new FakeAudioWorklet();
  destination = {};
  async resume() {}
  async close() {}
  createMediaStreamSource() {
    return { connect: vi.fn(), disconnect: vi.fn() };
  }
  createGain() {
    return { gain: { value: 0 }, connect: vi.fn(), disconnect: vi.fn() };
  }
  createScriptProcessor() {
    return { connect: vi.fn(), disconnect: vi.fn(), onaudioprocess: null };
  }
}

class FakeAudioWorkletNode {
  port = { onmessage: null, postMessage: vi.fn(), close: vi.fn() };
  connect = vi.fn();
  disconnect = vi.fn();
}

function installBrowserMocks() {
  currentTrack = makeTrack();
  const stream = {
    getTracks: () => [currentTrack],
    getAudioTracks: () => [currentTrack],
  };
  vi.stubGlobal('navigator', {
    mediaDevices: { getUserMedia: vi.fn(async () => stream) },
  });
  vi.stubGlobal('AudioContext', FakeAudioContext as unknown as typeof AudioContext);
  vi.stubGlobal('AudioWorkletNode', FakeAudioWorkletNode as unknown as typeof AudioWorkletNode);
  vi.stubGlobal('URL', {
    createObjectURL: () => 'blob:fake',
    revokeObjectURL: () => {},
  });
  vi.stubGlobal('Blob', class {});
  vi.stubGlobal('performance', { now: () => Date.now() });
  vi.stubGlobal('WebSocket', class {} as unknown as typeof WebSocket);
}

// boot() is async (getUserMedia + worklet addModule). Let microtasks drain.
async function settle() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

beforeEach(() => {
  installBrowserMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.dispatchEvent(new Event('visibilitychange')); // flush any handler refs
});

describe('startSonioxBrowserSession — #206/#229 track-ended recovery', () => {
  it('routes a track "ended" event to onError with a recoverable reason (triggers restart, not terminal)', async () => {
    const onError = vi.fn();
    startSonioxBrowserSession({
      onInterim: vi.fn(),
      onFinal: vi.fn(),
      onStateChange: vi.fn(),
      onError,
    });
    await settle();
    expect(currentTrack.onended).toBeTypeOf('function');

    currentTrack.end(); // OS ends the mic track

    expect(onError).toHaveBeenCalledTimes(1);
    const reason = onError.mock.calls[0][0] as string;
    expect(reason).toBe('microphone track ended');
    // The whole point of #232/#206: this reason is recoverable → auto-restart.
    expect(isRecoverableVoiceError(reason)).toBe(true);
  });

  it('recovery latches once per boot — a second track end does not re-fire onError', async () => {
    const onError = vi.fn();
    startSonioxBrowserSession({
      onInterim: vi.fn(),
      onFinal: vi.fn(),
      onStateChange: vi.fn(),
      onError,
    });
    await settle();

    currentTrack.end();
    currentTrack.onended?.(); // simulate a duplicate ended firing
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('visibilitychange with an already-ended track routes to a recoverable onError', async () => {
    const onError = vi.fn();
    startSonioxBrowserSession({
      onInterim: vi.fn(),
      onFinal: vi.fn(),
      onStateChange: vi.fn(),
      onError,
    });
    await settle();

    // Track ended while backgrounded (its onended is detached so it doesn't
    // fire the per-track path); the visibility handler must catch it on resume.
    currentTrack.readyState = 'ended';
    currentTrack.onended = null;
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(onError).toHaveBeenCalledTimes(1);
    const reason = onError.mock.calls[0][0] as string;
    expect(reason).toBe('voice connection lost');
    expect(isRecoverableVoiceError(reason)).toBe(true);
  });
});
