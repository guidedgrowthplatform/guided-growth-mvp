import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pcmBegin, pcmEnqueue, pcmFinish, s16leToFloat32 } from '../pcmPlayer';

function le(...samples: number[]): Uint8Array {
  const u = new Uint8Array(samples.length * 2);
  const view = new DataView(u.buffer);
  samples.forEach((s, i) => view.setInt16(i * 2, s, true));
  return u;
}

describe('s16leToFloat32', () => {
  it('maps zero to 0', () => {
    expect(Array.from(s16leToFloat32(le(0)))).toEqual([0]);
  });

  it('maps full-scale negative to -1', () => {
    expect(s16leToFloat32(le(-32768))[0]).toBeCloseTo(-1, 5);
  });

  it('maps full-scale positive to ~1', () => {
    expect(s16leToFloat32(le(32767))[0]).toBeCloseTo(1, 4);
  });

  it('decodes a multi-sample little-endian buffer in order', () => {
    const out = s16leToFloat32(le(0, 16384, -16384));
    expect(out.length).toBe(3);
    expect(out[1]).toBeCloseTo(0.5, 3);
    expect(out[2]).toBeCloseTo(-0.5, 3);
  });

  it('reads literal little-endian bytes (0x4000 → 0.5)', () => {
    // pins endianness against raw bytes, not a DataView round-trip
    const out = s16leToFloat32(new Uint8Array([0x00, 0x40, 0x7f]));
    expect(out.length).toBe(1);
    expect(out[0]).toBeCloseTo(0.5, 3);
  });

  it('honors a non-zero byteOffset (subarray view)', () => {
    const full = le(0, 16384); // [0, 0.5]
    const view = full.subarray(2); // skip first sample
    const out = s16leToFloat32(view);
    expect(out.length).toBe(1);
    expect(out[0]).toBeCloseTo(0.5, 3);
  });
});

// Suspended/interrupted AudioContext never fires src.onended — the drain
// watchdog must still release the speaking gate so the mic re-opens.
describe('drain watchdog (suspended-context latch)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    const ctx = {
      state: 'running',
      currentTime: 0,
      destination: {},
      resume: () => Promise.resolve(),
      createGain: () => ({ gain: { value: 0 }, connect: () => undefined }),
      createBuffer: (_ch: number, len: number, sr: number) => ({
        duration: len / sr,
        getChannelData: () => new Float32Array(len),
      }),
      // start()/stop() no-op; onended is NEVER invoked (suspended context).
      createBufferSource: () => ({
        buffer: null,
        connect: () => undefined,
        start: () => undefined,
        stop: () => undefined,
        onended: null,
      }),
    };
    vi.stubGlobal('window', { AudioContext: vi.fn(() => ctx) });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('drives onSpeakingChange(false) + onDrain even when onended never fires', () => {
    const onSpeakingChange = vi.fn();
    const onDrain = vi.fn();
    pcmBegin({ onSpeakingChange, onDrain });

    pcmEnqueue(new Uint8Array([0, 0, 0, 0]));
    expect(onSpeakingChange).toHaveBeenLastCalledWith(true);

    pcmFinish();
    expect(onDrain).not.toHaveBeenCalled(); // still waiting on the (dead) tail

    vi.advanceTimersByTime(2000);
    expect(onSpeakingChange).toHaveBeenLastCalledWith(false);
    expect(onDrain).toHaveBeenCalledTimes(1);
  });
});

// Karaoke word reveal: words fire as the audio clock crosses each onset.
describe('word reveal (audio-clock pump)', () => {
  let clock: { t: number };
  let rafQueue: FrameRequestCallback[];
  let srcs: Array<{ onended: (() => void) | null }>;

  function pump() {
    const q = rafQueue;
    rafQueue = [];
    q.forEach((cb) => cb(0));
  }

  beforeEach(() => {
    clock = { t: 0 };
    rafQueue = [];
    srcs = [];
    const ctx = {
      state: 'running',
      get currentTime() {
        return clock.t;
      },
      destination: {},
      resume: () => Promise.resolve(),
      createGain: () => ({ gain: { value: 0 }, connect: () => undefined }),
      createBuffer: (_ch: number, len: number, sr: number) => ({
        duration: len / sr,
        getChannelData: () => new Float32Array(len),
      }),
      createBufferSource: () => {
        const src = {
          buffer: null,
          connect: () => undefined,
          start: () => undefined,
          stop: () => undefined,
          onended: null as (() => void) | null,
        };
        srcs.push(src);
        return src;
      },
    };
    vi.stubGlobal('window', { AudioContext: vi.fn(() => ctx) });
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafQueue.push(cb);
      return rafQueue.length;
    });
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fires words in idx order with their strings as the clock crosses each onset', async () => {
    const { pcmBegin, pcmEnqueue, pcmScheduleWord } = await import('../pcmPlayer');
    const onWord = vi.fn();
    pcmBegin({ onWord });
    // audioOrigin = startAt = SCHED_LEAD_S (0.08)
    pcmEnqueue(new Uint8Array([0, 0, 0, 0]));
    pcmScheduleWord(0, 0, 'It’s');
    pcmScheduleWord(1, 0.5, 'nine');

    clock.t = 0.08;
    pump();
    expect(onWord).toHaveBeenCalledWith(0, 'It’s');
    expect(onWord).toHaveBeenCalledTimes(1);

    clock.t = 1.0;
    pump();
    expect(onWord).toHaveBeenLastCalledWith(1, 'nine');
    expect(onWord).toHaveBeenCalledTimes(2);
  });

  it('flushes a word scheduled before first audio once audioOrigin is set', async () => {
    const { pcmBegin, pcmEnqueue, pcmScheduleWord } = await import('../pcmPlayer');
    const onWord = vi.fn();
    pcmBegin({ onWord });
    pcmScheduleWord(0, 0, 'hi');
    expect(onWord).not.toHaveBeenCalled();

    pcmEnqueue(new Uint8Array([0, 0, 0, 0]));
    clock.t = 0.08;
    pump();
    expect(onWord).toHaveBeenCalledWith(0, 'hi');
  });

  it('stops the pump on finalize+drain even with a word still pending', async () => {
    const { pcmBegin, pcmEnqueue, pcmScheduleWord, pcmFinish } = await import('../pcmPlayer');
    const onWord = vi.fn();
    pcmBegin({ onWord });
    pcmEnqueue(new Uint8Array([0, 0, 0, 0]));
    pcmScheduleWord(0, 999, 'later');

    // audio finishes (source ends) before the word's onset → pump must stop, not spin.
    pcmFinish();
    srcs.forEach((s) => s.onended?.());
    clock.t = 1.0;
    pump();
    expect(onWord).not.toHaveBeenCalled();

    rafQueue = [];
    clock.t = 1000;
    pump();
    expect(rafQueue).toHaveLength(0);
    expect(onWord).not.toHaveBeenCalled();
  });
});
