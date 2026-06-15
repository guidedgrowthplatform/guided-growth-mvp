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
