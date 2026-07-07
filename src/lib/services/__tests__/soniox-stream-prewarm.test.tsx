/** @vitest-environment jsdom */
// Verifies startSonioxBrowserSession's socket-open step claims a prewarmed
// socket (SONIOX_PREWARM on) instead of cold-opening a new WebSocket, and
// falls back cleanly when there's nothing to claim (flag off / expired).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const voiceConfigMock = vi.hoisted(() => ({ SONIOX_PREWARM: false, SONIOX_V5: false }));
vi.mock('@/config/voiceConfig', () => voiceConfigMock);

import { __resetSonioxPrewarmForTest, setPrewarmSocketOpener } from '@/lib/services/soniox-prewarm';
import { startSonioxBrowserSession, type SonioxSocket } from '@/lib/services/soniox-stream';

vi.mock('@/lib/services/soniox-temp-key-cache', () => ({
  takeTempKey: vi.fn(async () => ({ apiKey: 'test-key', cached: false })),
}));
vi.mock('@/stores/audioMetricsStore', () => ({
  useAudioMetricsStore: { getState: () => ({ pushChunkRms: () => {}, reset: () => {} }) },
}));

class FakeSocket implements SonioxSocket {
  sent: Array<string | ArrayBufferLike> = [];
  closed = false;
  // Mirrors real WebSocket readyState semantics: once open, ALWAYS open —
  // matches wrapWebSocket's contract that onOpen(cb) fires immediately (not
  // silently dropped) when registered after the socket already opened. A
  // claimed prewarmed socket relies on exactly this to fire its config send.
  isOpen = false;
  private openCb?: () => void;
  private msgCb?: (data: string) => void;
  private errCb?: (e: unknown) => void;
  private closeCb?: (code?: number) => void;
  send(data: string | ArrayBufferLike): void {
    this.sent.push(data);
  }
  close(): void {
    this.closed = true;
  }
  onOpen(cb: () => void): void {
    if (this.isOpen) {
      queueMicrotask(cb);
      return;
    }
    this.openCb = cb;
  }
  onMessage(cb: (data: string) => void): void {
    this.msgCb = cb;
  }
  onError(cb: (e: unknown) => void): void {
    this.errCb = cb;
  }
  onClose(cb: (code?: number) => void): void {
    this.closeCb = cb;
  }
  emitOpen(): void {
    this.isOpen = true;
    this.openCb?.();
  }
}

interface FakeTrack {
  kind: 'audio';
  readyState: 'live' | 'ended';
  onended: (() => void) | null;
  stop: () => void;
}

function makeTrack(): FakeTrack {
  return { kind: 'audio', readyState: 'live', onended: null, stop: vi.fn() };
}

class FakeAudioWorklet {
  async addModule() {}
}
class FakeAudioContext {
  state = 'running';
  sampleRate = 16000;
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
  port: {
    onmessage: ((e: { data: Float32Array }) => void) | null;
    postMessage: () => void;
    close: () => void;
  } = {
    onmessage: null,
    postMessage: vi.fn(),
    close: vi.fn(),
  };
  connect = vi.fn();
  disconnect = vi.fn();
}

function installBrowserMocks() {
  const track = makeTrack();
  const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
  vi.stubGlobal('navigator', {
    mediaDevices: { getUserMedia: vi.fn(async () => stream) },
    onLine: true,
  });
  vi.stubGlobal('AudioContext', FakeAudioContext as unknown as typeof AudioContext);
  vi.stubGlobal('AudioWorkletNode', FakeAudioWorkletNode as unknown as typeof AudioWorkletNode);
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:fake', revokeObjectURL: () => {} });
  vi.stubGlobal('Blob', class {});
}

async function settle() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

// Feeds loud frames across real elapsed time (VAD_OPEN_SUSTAIN_MS = 150ms)
// so shouldOpenSocket() latches and openSocket() actually runs.
async function speakUntilSocketOpens(workletNode: FakeAudioWorkletNode) {
  const loud = new Float32Array(64).fill(0.5);
  for (let i = 0; i < 10; i++) {
    workletNode.port.onmessage?.({ data: loud });
    await vi.advanceTimersByTimeAsync(30);
  }
}

describe('startSonioxBrowserSession — prewarmed socket claim', () => {
  let capturedWorkletNode: FakeAudioWorkletNode | null = null;

  beforeEach(() => {
    voiceConfigMock.SONIOX_PREWARM = false;
    capturedWorkletNode = null;
    installBrowserMocks();
    vi.stubGlobal('performance', { now: () => Date.now() });
    // Capture the worklet node the module constructs so tests can drive frames.
    const OriginalNode = FakeAudioWorkletNode;
    vi.stubGlobal(
      'AudioWorkletNode',
      class extends OriginalNode {
        constructor() {
          super();
          // eslint-disable-next-line @typescript-eslint/no-this-alias -- capturing the constructed node for test frame-driving is the point
          capturedWorkletNode = this;
        }
      } as unknown as typeof AudioWorkletNode,
    );
    __resetSonioxPrewarmForTest();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  });

  afterEach(() => {
    __resetSonioxPrewarmForTest();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('flag off: never asks the prewarm module for a socket (byte-identical to before)', async () => {
    voiceConfigMock.SONIOX_PREWARM = false;
    const opener = vi.fn(() => new FakeSocket());
    setPrewarmSocketOpener(opener);

    startSonioxBrowserSession({
      onInterim: vi.fn(),
      onFinal: vi.fn(),
      onStateChange: vi.fn(),
      onError: vi.fn(),
    });
    await settle();
    expect(capturedWorkletNode).not.toBeNull();

    await speakUntilSocketOpens(capturedWorkletNode!);

    // Prewarm opener never invoked — session opened its own socket via `new WebSocket`.
    expect(opener).not.toHaveBeenCalled();
  });

  it('flag on + a fresh prewarmed socket pending: session claims it instead of opening its own', async () => {
    voiceConfigMock.SONIOX_PREWARM = true;
    const prewarmed = new FakeSocket();
    prewarmed.emitOpen(); // already OPEN by the time the real session looks for it
    // Manually seed the pending slot the same way prewarmSocket() would.
    setPrewarmSocketOpener(() => prewarmed);
    const { prewarmSoniox } = await import('@/lib/services/soniox-prewarm');
    prewarmSoniox();
    await settle();
    prewarmed.emitOpen();

    const onConnected = vi.fn();
    startSonioxBrowserSession({
      onInterim: vi.fn(),
      onFinal: vi.fn(),
      onStateChange: vi.fn(),
      onError: vi.fn(),
      onConnected,
    });
    await settle();

    await speakUntilSocketOpens(capturedWorkletNode!);
    await settle();

    expect(onConnected).toHaveBeenCalledTimes(1);
    const metrics = onConnected.mock.calls[0][0];
    expect(metrics.prewarmed).toBe(true);
    expect(metrics.ws_ms).toBe(0);
  });

  it('flag on but nothing pending: falls back to a cold open (prewarmed:false)', async () => {
    voiceConfigMock.SONIOX_PREWARM = true;
    setPrewarmSocketOpener(null); // no prior prewarmSoniox() call → nothing pending to claim

    // A real cold-open WebSocket, so the fallback path can actually complete
    // and prove it took the "open my own socket" branch, not just no-op'd.
    class FakeWebSocket {
      static OPEN = 1;
      readyState = 0;
      binaryType = '';
      onopen: (() => void) | null = null;
      onmessage: ((e: MessageEvent) => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      onclose: ((e: CloseEvent) => void) | null = null;
      constructor(public url: string) {
        queueMicrotask(() => {
          this.readyState = FakeWebSocket.OPEN;
          this.onopen?.();
        });
      }
      send() {}
      close() {}
    }
    vi.stubGlobal('WebSocket', FakeWebSocket as unknown as typeof WebSocket);

    const onConnected = vi.fn();
    startSonioxBrowserSession({
      onInterim: vi.fn(),
      onFinal: vi.fn(),
      onStateChange: vi.fn(),
      onError: vi.fn(),
      onConnected,
    });
    await settle();

    await speakUntilSocketOpens(capturedWorkletNode!);
    await settle();

    expect(onConnected).toHaveBeenCalledTimes(1);
    const metrics = onConnected.mock.calls[0][0];
    expect(metrics.prewarmed).toBe(false);
  });
});
