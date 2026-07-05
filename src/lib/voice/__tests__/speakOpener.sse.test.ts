// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getSession: vi.fn(async () => ({ data: { session: null } })) },
  },
  sessionReady: Promise.resolve(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => false },
}));

import { speakOpener } from '../speakOpener';

// ── SSE body: 3 display words with exact per-word onsets ────────────────────
// 'AAAAAAAA' = 8 base64 chars = 6 null bytes = 3 s16le samples (even byte count required)
const SSE_PCM_B64 = 'AAAAAAAA';
const SSE_BODY = [
  `data: {"type":"chunk","data":"${SSE_PCM_B64}"}`,
  '',
  `data: {"type":"timestamps","word_timestamps":{"words":["Hey","there","friend"],"start":[0,0.5,1.0],"end":[0.4,0.9,1.4]}}`,
  '',
  `data: {"type":"done"}`,
  '',
].join('\n');

// ── Controllable HTMLAudioElement stand-in ───────────────────────────────────
class FakeAudio {
  static instances: FakeAudio[] = [];
  static reset(): void {
    FakeAudio.instances = [];
  }

  src: string;
  volume = 1;
  currentTime = 0;
  duration = 3; // finite (WAV path default)
  paused = true;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(src?: string) {
    this.src = src ?? '';
    FakeAudio.instances.push(this);
  }

  play(): Promise<void> {
    this.paused = false;
    return Promise.resolve();
  }

  pause(): void {
    this.paused = true;
  }
}

// ── RAF queue: drain manually per-tick ──────────────────────────────────────
const rafCallbacks = new Map<number, FrameRequestCallback>();
let rafIdCounter = 0;

function stepRaf(now = 0): void {
  const pending = [...rafCallbacks.entries()];
  rafCallbacks.clear();
  for (const [, cb] of pending) cb(now);
}

// ── Misc helpers ─────────────────────────────────────────────────────────────
// Drains all microtasks; one event-loop tick lets every chained Promise settle.
const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

let savedFetch: typeof fetch;
let savedCreateObjectURL: typeof URL.createObjectURL;
let savedRevokeObjectURL: typeof URL.revokeObjectURL;

beforeEach(() => {
  FakeAudio.reset();
  rafCallbacks.clear();
  rafIdCounter = 0;

  vi.stubGlobal('Audio', FakeAudio);
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    const id = ++rafIdCounter;
    rafCallbacks.set(id, cb);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    rafCallbacks.delete(id);
  });

  savedFetch = global.fetch;
  savedCreateObjectURL = URL.createObjectURL;
  savedRevokeObjectURL = URL.revokeObjectURL;
  URL.createObjectURL = vi.fn(() => 'blob:fake');
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  global.fetch = savedFetch;
  URL.createObjectURL = savedCreateObjectURL;
  URL.revokeObjectURL = savedRevokeObjectURL;
});

describe('speakOpener', () => {
  it('SSE success: Audio created, onRevealWords fires with increasing counts, done resolves on ended', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(SSE_BODY),
    }) as unknown as typeof fetch;

    const onRevealWords = vi.fn();
    const onProgress = vi.fn();
    const handle = speakOpener('Hey there friend', onProgress, undefined, { onRevealWords });

    // One event-loop tick drains: getAuthHeaders → SSE fetch → parseSse → WAV blob → Audio → play()
    await flush();

    const el = FakeAudio.instances[0];
    expect(el).toBeDefined();
    expect(el.paused).toBe(false); // play() resolved

    // t=0: onset[0]=0 ≤ 0 → reveal 1 word
    el.currentTime = 0;
    stepRaf(0);
    expect(onRevealWords).toHaveBeenLastCalledWith(1);

    // t=0.6: onset[1]=0.5 ≤ 0.6 → reveal 2 words
    el.currentTime = 0.6;
    stepRaf(0.6);
    expect(onRevealWords).toHaveBeenLastCalledWith(2);

    // t=1.2: onset[2]=1.0 ≤ 1.2 → reveal 3 words
    el.currentTime = 1.2;
    stepRaf(1.2);
    expect(onRevealWords).toHaveBeenLastCalledWith(3);

    // ended: emits onRevealWords(total) + onProgress(1), done resolves
    el.onended!();
    await handle.done;

    expect(onRevealWords).toHaveBeenLastCalledWith(3);
    expect(onProgress).toHaveBeenLastCalledWith(1);
  });

  it('paused guard: rAF tick emits no onRevealWords while audio.paused is true', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(SSE_BODY),
    }) as unknown as typeof fetch;

    const onRevealWords = vi.fn();
    const handle = speakOpener('Hey there friend', undefined, undefined, { onRevealWords });

    await flush();

    const el = FakeAudio.instances[0];
    // Simulate externally paused (e.g. B4 gesture-hold scenario)
    el.paused = true;
    el.currentTime = 0;

    stepRaf(0);
    expect(onRevealWords).not.toHaveBeenCalled();

    el.onended!();
    await handle.done;
  });

  it('SSE failure fallback: fetches /api/cartesia-tts, never calls onRevealWords, onProgress fires via estimate then 1 on ended', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(new Blob([], { type: 'audio/mpeg' })),
      }) as unknown as typeof fetch;

    const onRevealWords = vi.fn();
    const onProgress = vi.fn();
    const handle = speakOpener('Hey there friend', onProgress, 2000, { onRevealWords });

    // Drains: auth → SSE (500) → blob fetch → blob() → Audio → play()
    await flush();

    expect(FakeAudio.instances).toHaveLength(1);
    const el = FakeAudio.instances[0];

    // Simulate Chrome blob-MP3 Infinity duration bug
    el.duration = Infinity;
    el.paused = false;

    // currentTime=0: estimate path requires currentTime > 0 → no fire
    el.currentTime = 0;
    stepRaf(0);
    expect(onRevealWords).not.toHaveBeenCalled();
    expect(onProgress).not.toHaveBeenCalled();

    // currentTime=1 with estimatedDurationMs=2000: estimate = 1000/2000 = 0.5
    el.currentTime = 1;
    stepRaf(1000);
    expect(onRevealWords).not.toHaveBeenCalled();
    expect(onProgress).toHaveBeenCalledWith(0.5);

    // ended: onProgress(1), onRevealWords never called (no onsets on fallback path)
    el.onended!();
    await handle.done;
    expect(onRevealWords).not.toHaveBeenCalled();
    expect(onProgress).toHaveBeenLastCalledWith(1);
  });

  it('stop() during SSE fetch: aborts before Audio is created, done resolves', async () => {
    // Never resolves — simulates slow network
    global.fetch = vi.fn(() => new Promise<Response>(() => {})) as unknown as typeof fetch;

    const handle = speakOpener('Hey there friend', undefined, undefined, {});
    // Synchronous stop() fires before any awaited microtask resolves
    handle.stop();

    await handle.done;
    expect(FakeAudio.instances).toHaveLength(0);
  });
});
