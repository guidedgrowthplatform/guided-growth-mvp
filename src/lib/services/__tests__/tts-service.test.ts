/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isVoiceOutEnabled } from '../voiceGate';

vi.mock('../voiceGate', () => ({ isVoiceOutEnabled: vi.fn(() => true) }));

let wsOnWord: ((idx: number, word: string) => void) | null = null;
vi.mock('../cartesia-ws', () => ({
  wsTtsAvailable: vi.fn(() => true),
  wsWarm: vi.fn(),
  wsBegin: vi.fn((cb: { onWord?: (idx: number, word: string) => void }) => {
    wsOnWord = cb.onWord ?? null;
  }),
  wsPush: vi.fn(),
  wsFinish: vi.fn(),
  wsCancel: vi.fn(),
}));

// Short-circuit Supabase auth — keeps getAuthHeaders() off a real client.
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
    },
  },
  sessionReady: Promise.resolve(),
}));

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('tts-service: stale speak() never overlaps with the latest one', () => {
  let audioInstances: HTMLAudioElement[];
  let pauseSpies: Array<ReturnType<typeof vi.fn>>;
  let blobResolvers: Array<(blob: Blob) => void>;
  let originalAudio: typeof Audio;
  let originalFetch: typeof fetch;
  let originalCreateObjectURL: typeof URL.createObjectURL;
  let originalRevokeObjectURL: typeof URL.revokeObjectURL;

  beforeEach(() => {
    vi.mocked(isVoiceOutEnabled).mockReturnValue(true);
    audioInstances = [];
    pauseSpies = [];
    blobResolvers = [];

    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => 'blob:fake');
    URL.revokeObjectURL = vi.fn();

    originalFetch = global.fetch;
    global.fetch = vi.fn(async () => {
      const blobPromise = new Promise<Blob>((resolve) => {
        blobResolvers.push(resolve);
      });
      return {
        ok: true,
        status: 200,
        blob: () => blobPromise,
      } as Response;
    });

    originalAudio = global.Audio;
    const RealAudio = originalAudio;
    const MockAudio = vi.fn().mockImplementation((src?: string) => {
      const a = new RealAudio(src);
      vi.spyOn(a, 'play').mockResolvedValue();
      const pauseSpy = vi.fn();
      Object.defineProperty(a, 'pause', { value: pauseSpy, configurable: true });
      audioInstances.push(a);
      pauseSpies.push(pauseSpy);
      return a;
    });
    global.Audio = MockAudio as unknown as typeof Audio;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    global.Audio = originalAudio;
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it('pauses the first audio before the second speak() reaches playback', async () => {
    const { speak } = await import('../tts-service');

    speak('first');
    await flush();
    // first fetch should be in-flight and awaiting blob
    expect(blobResolvers).toHaveLength(1);

    // resolve the first blob so audio_a starts playing
    blobResolvers[0](new Blob([new Uint8Array(8)]));
    await flush();
    await flush();
    expect(audioInstances).toHaveLength(1);

    // second speak() — stopTTS() inside speak() should pause audio_a
    speak('second');
    await flush();
    expect(pauseSpies[0]).toHaveBeenCalled();

    // second fetch should now be awaiting its blob
    expect(blobResolvers).toHaveLength(2);
    blobResolvers[1](new Blob([new Uint8Array(8)]));
    await flush();
    await flush();
    expect(audioInstances).toHaveLength(2);
  });

  it('stale fetch bails after blob resolves if a newer speak() has superseded it', async () => {
    const { speak } = await import('../tts-service');

    speak('first');
    await flush();
    speak('second');
    await flush();
    // both fetches awaiting their respective blobs
    expect(blobResolvers).toHaveLength(2);

    // resolve the SECOND blob first — audio_b is created
    blobResolvers[1](new Blob([new Uint8Array(8)]));
    await flush();
    await flush();
    expect(audioInstances).toHaveLength(1);

    // now resolve the stale FIRST blob — generation check inside
    // playAudioFromResponse must bail before creating an Audio
    blobResolvers[0](new Blob([new Uint8Array(8)]));
    await flush();
    await flush();
    expect(audioInstances).toHaveLength(1);
  });
});

describe('tts-service: speak() Promise lifecycle (PR-0b)', () => {
  let audioInstances: HTMLAudioElement[];
  let blobResolvers: Array<(blob: Blob) => void>;
  let originalAudio: typeof Audio;
  let originalFetch: typeof fetch;
  let originalCreateObjectURL: typeof URL.createObjectURL;
  let originalRevokeObjectURL: typeof URL.revokeObjectURL;

  beforeEach(() => {
    vi.mocked(isVoiceOutEnabled).mockReturnValue(true);
    audioInstances = [];
    blobResolvers = [];

    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => 'blob:fake');
    URL.revokeObjectURL = vi.fn();

    originalFetch = global.fetch;
    global.fetch = vi.fn(async () => {
      const blobPromise = new Promise<Blob>((resolve) => {
        blobResolvers.push(resolve);
      });
      return { ok: true, status: 200, blob: () => blobPromise } as Response;
    });

    originalAudio = global.Audio;
    const RealAudio = originalAudio;
    const MockAudio = vi.fn().mockImplementation((src?: string) => {
      const a = new RealAudio(src);
      vi.spyOn(a, 'play').mockResolvedValue();
      Object.defineProperty(a, 'pause', { value: vi.fn(), configurable: true });
      audioInstances.push(a);
      return a;
    });
    global.Audio = MockAudio as unknown as typeof Audio;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    global.Audio = originalAudio;
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it('resolves immediately when voice output is disabled', async () => {
    vi.mocked(isVoiceOutEnabled).mockReturnValue(false);
    const { speak } = await import('../tts-service');

    let resolved = false;
    void speak('hello').then(() => {
      resolved = true;
    });
    await flush();
    expect(resolved).toBe(true);
    // No fetch should have been made
    expect(blobResolvers).toHaveLength(0);
  });

  it('does not resolve until audio.onended fires', async () => {
    const { speak } = await import('../tts-service');

    let resolved = false;
    void speak('hello').then(() => {
      resolved = true;
    });
    await flush();
    expect(blobResolvers).toHaveLength(1);

    // Resolve the blob → audio is created and play() called
    blobResolvers[0](new Blob([new Uint8Array(8)]));
    await flush();
    await flush();
    expect(audioInstances).toHaveLength(1);
    expect(resolved).toBe(false); // still playing

    // Fire onended → the speak() promise resolves
    const onended = audioInstances[0].onended as
      | ((this: GlobalEventHandlers, ev: Event) => unknown)
      | null;
    onended?.call(audioInstances[0], new Event('ended'));
    await flush();
    expect(resolved).toBe(true);
  });

  it('stopTTS during playback resolves the speak() promise', async () => {
    const { speak, stopTTS } = await import('../tts-service');

    let resolved = false;
    void speak('hello').then(() => {
      resolved = true;
    });
    await flush();
    blobResolvers[0](new Blob([new Uint8Array(8)]));
    await flush();
    await flush();
    expect(audioInstances).toHaveLength(1);
    expect(resolved).toBe(false);

    stopTTS();
    await flush();
    expect(resolved).toBe(true);
  });

  it('resolves quickly when fetch returns non-ok (Cartesia failure)', async () => {
    const { speak } = await import('../tts-service');

    // Override fetch to return a 500 once
    global.fetch = vi.fn(async () => {
      return { ok: false, status: 500, blob: async () => new Blob() } as Response;
    });

    let resolved = false;
    void speak('hello').then(() => {
      resolved = true;
    });
    await flush();
    await flush();
    expect(resolved).toBe(true);
    expect(audioInstances).toHaveLength(0);
  });
});

describe('tts-service: ws karaoke reveal (spoken-form accumulation)', () => {
  beforeEach(() => {
    vi.mocked(isVoiceOutEnabled).mockReturnValue(true);
    wsOnWord = null;
  });

  it('emits progressive onReveal from Cartesia word strings', async () => {
    const { beginSpeechTurn } = await import('../tts-service');
    const reveals: string[] = [];
    beginSpeechTurn({ onReveal: (t) => reveals.push(t) });
    expect(wsOnWord).toBeTypeOf('function');

    wsOnWord?.(0, "It's");
    wsOnWord?.(1, 'nine');
    wsOnWord?.(2, 'a');
    wsOnWord?.(3, 'm');
    expect(reveals).toEqual(["It's", "It's nine", "It's nine a", "It's nine a m"]);
  });

  it('resets the accumulator on a new turn (barge-in)', async () => {
    const { beginSpeechTurn } = await import('../tts-service');
    const reveals: string[] = [];
    beginSpeechTurn({ onReveal: (t) => reveals.push(t) });
    wsOnWord?.(0, 'hello');

    beginSpeechTurn({ onReveal: (t) => reveals.push(t) });
    wsOnWord?.(0, 'fresh');
    expect(reveals).toEqual(['hello', 'fresh']);
  });
});
