/** @vitest-environment jsdom */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * B40: useBeatOpenerMp3's beatAudioOwner integration. Proves the hook itself
 * (not just the pure registry) honors a denied claim: no Audio element is
 * ever constructed, no play() is ever called, and the hook settles as done
 * with no audio - the double-arm shape from the live evidence (a beat
 * transition where the narration driver's segment and the legacy opener path
 * both tried to speak the same beat).
 */
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { claimBeatAudio, resetBeatAudioOwnerForTests } from '../beatAudioOwner';
import { resetOpenerPreloadPool } from '../openerPreloadPool';
import { useBeatOpenerMp3, type BeatOpenerMp3State } from '../useBeatOpenerMp3';

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
    return new Promise<void>(() => {
      /* never resolves in this suite - we only assert it's never CALLED */
    });
  }
  addEventListener(type: string, fn: () => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(fn);
  }
  removeEventListener(type: string, fn: () => void) {
    this.listeners.get(type)?.delete(fn);
  }
  load() {}
}

let container: HTMLDivElement;
let root: Root;
let state: BeatOpenerMp3State | null = null;

function Probe({
  src,
  active,
  beatId,
  owner,
}: {
  src: string | null;
  active: boolean;
  beatId: string;
  owner: 'narration-driver' | 'opener-mp3';
}) {
  state = useBeatOpenerMp3(src, active, 0, { beatId, owner });
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
  resetBeatAudioOwnerForTests();
  vi.stubGlobal('Audio', FakeAudio);
  if (typeof globalThis.requestAnimationFrame === 'undefined') {
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16) as unknown as number,
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
  resetBeatAudioOwnerForTests();
});

describe('useBeatOpenerMp3 beatAudioOwner integration (B40)', () => {
  it('a denied claim never creates an Audio element or calls play() - settles done with no audio', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Something else (the narration driver, in this scenario) already owns
    // this beat's audio - exactly the live-evidence shape: the previous
    // beat's opener claimed and hadn't settled when the next beat's legacy
    // opener path armed for the SAME screenId during a fast transition.
    claimBeatAudio('ONBOARD-STATE-CHECK', 'narration-driver');

    await render(
      <Probe
        src="/voice/ob/onboard_state_check_1.wav"
        active
        beatId="ONBOARD-STATE-CHECK"
        owner="opener-mp3"
      />,
    );

    // The whole point of the claim: no element, no play() call, ever.
    expect(FakeAudio.instances.length).toBe(0);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('ONBOARD-STATE-CHECK');

    // The beat still advances (never dead-ends): done with no audio, exactly
    // the same shape as a normal failed clip.
    expect(state!.done).toBe(true);
    expect(state!.playing).toBe(false);
    expect(state!.progress).toBe(1);
  });

  it('claim granted plays normally (baseline: ownership does not change the happy path)', async () => {
    await render(
      <Probe src="/voice/ob/onboard_state_check_1.wav" active beatId="ONBOARD-BEGINNER-01" owner="opener-mp3" />,
    );
    expect(FakeAudio.instances.length).toBe(1);
    expect(FakeAudio.instances[0].playCalls).toBe(1);
    expect(state!.done).toBe(false);
  });

  it('release on beat exit (deactivation) frees the claim for the next owner', async () => {
    await render(
      <Probe src="/voice/x.mp3" active beatId="ONBOARD-BEGINNER-02" owner="opener-mp3" />,
    );
    expect(FakeAudio.instances.length).toBe(1);

    // Beat exits.
    await render(
      <Probe src="/voice/x.mp3" active={false} beatId="ONBOARD-BEGINNER-02" owner="opener-mp3" />,
    );

    // The claim must be gone: a fresh owner on the SAME beat id can now claim.
    expect(claimBeatAudio('ONBOARD-BEGINNER-02', 'narration-driver')).toBe(true);
  });
});
