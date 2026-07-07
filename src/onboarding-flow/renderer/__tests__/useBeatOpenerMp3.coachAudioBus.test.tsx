/** @vitest-environment jsdom */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Bug fix regression: "left orb reacts to MP3 coach playback, not only
 * Cartesia" (Mint report). The B51 MR wired useBeatOpenerMp3 to call
 * registerCoachAudioElement/unregisterCoachAudioElement around the MP3
 * element's real playback lifecycle — this test proves that wiring directly,
 * mocking coachAudioBus so the assertions are exact call-in/call-out checks
 * rather than inferred from amplitude. The actual reported bug turned out to
 * be downstream of this registration (see orbState.test.ts's
 * resolveActiveRings suite + useCoachVoiceActivity.test.tsx), but this file
 * closes the gap the task called out explicitly: no existing test asserted
 * useBeatOpenerMp3 ever calls into coachAudioBus at all.
 */
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const registerCoachAudioElement = vi.fn();
const unregisterCoachAudioElement = vi.fn();

vi.mock('@/lib/audio/coachAudioBus', () => ({
  registerCoachAudioElement: (...args: unknown[]) => registerCoachAudioElement(...args),
  unregisterCoachAudioElement: (...args: unknown[]) => unregisterCoachAudioElement(...args),
}));

// Import after the mock so the hook picks up the mocked module.
const { useBeatOpenerMp3 } = await import('../useBeatOpenerMp3');
type BeatOpenerMp3State = Awaited<ReturnType<typeof useBeatOpenerMp3>>;
const { resetOpenerPreloadPool } = await import('../openerPreloadPool');

class FakeAudio {
  static instances: FakeAudio[] = [];
  static reset() {
    FakeAudio.instances = [];
  }

  src: string;
  preload = '';
  muted = false;
  currentTime = 0;
  duration = 10;
  paused = true;
  error: MediaError | null = null;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  playCalls = 0;
  private listeners = new Map<string, Set<() => void>>();

  constructor(src?: string) {
    this.src = src ?? '';
    FakeAudio.instances.push(this);
  }

  play(): Promise<void> {
    this.playCalls += 1;
    this.paused = false;
    return Promise.resolve();
  }
  addEventListener(type: string, fn: () => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(fn);
  }
  removeEventListener(type: string, fn: () => void) {
    this.listeners.get(type)?.delete(fn);
  }
  dispatch(type: string) {
    for (const fn of [...(this.listeners.get(type) ?? [])]) fn();
  }
  load() {}
}

let container: HTMLDivElement;
let root: Root;
let state: BeatOpenerMp3State | null = null;

function Probe({ src, active }: { src: string | null; active: boolean }) {
  state = useBeatOpenerMp3(src, active);
  return null;
}

async function render(ui: React.ReactElement) {
  await act(async () => {
    root.render(ui);
  });
}

beforeEach(() => {
  FakeAudio.reset();
  resetOpenerPreloadPool();
  registerCoachAudioElement.mockClear();
  unregisterCoachAudioElement.mockClear();
  vi.stubGlobal('Audio', FakeAudio);
  if (typeof globalThis.requestAnimationFrame === 'undefined') {
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback) =>
        setTimeout(() => cb(performance.now()), 16) as unknown as number,
    );
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
  }
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  state = null;
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useBeatOpenerMp3 registers its playing element with coachAudioBus', () => {
  it('calls registerCoachAudioElement with the real element once playback starts', async () => {
    await render(<Probe src="/voice/ob/mic_permission_1.wav" active />);

    expect(registerCoachAudioElement).toHaveBeenCalledTimes(1);
    expect(registerCoachAudioElement).toHaveBeenCalledWith(FakeAudio.instances[0]);
    expect(unregisterCoachAudioElement).not.toHaveBeenCalled();
  });

  it('calls unregisterCoachAudioElement with the same element when the clip ends', async () => {
    await render(<Probe src="/voice/ob/mic_permission_1.wav" active />);
    const el = FakeAudio.instances[0];
    registerCoachAudioElement.mockClear();

    await act(async () => {
      el.onended?.();
    });

    expect(state!.done).toBe(true);
    expect(unregisterCoachAudioElement).toHaveBeenCalledWith(el);
  });

  it('calls unregisterCoachAudioElement with the same element on beat deactivation', async () => {
    await render(<Probe src="/voice/ob/mic_permission_1.wav" active />);
    const el = FakeAudio.instances[0];

    await render(<Probe src="/voice/ob/mic_permission_1.wav" active={false} />);

    expect(unregisterCoachAudioElement).toHaveBeenCalledWith(el);
  });

  it('a pooled (reused) element is re-registered on its next activation', async () => {
    const { preloadOpenerClips } = await import('../openerPreloadPool');
    preloadOpenerClips(['/voice/ob/pooled.wav']);
    const pooledEl = FakeAudio.instances[0];
    pooledEl.dispatch?.('canplaythrough');

    await render(<Probe src="/voice/ob/pooled.wav" active />);
    expect(registerCoachAudioElement).toHaveBeenCalledWith(pooledEl);

    await act(async () => {
      pooledEl.onended?.();
    });
    registerCoachAudioElement.mockClear();

    // Deactivate then reactivate the same clip (e.g. a retry/back nav) —
    // the SAME pooled element must be re-registered, not silently dropped.
    await render(<Probe src={null} active={false} />);
    await render(<Probe src="/voice/ob/pooled.wav" active />);
    expect(registerCoachAudioElement).toHaveBeenCalledWith(pooledEl);
  });
});
