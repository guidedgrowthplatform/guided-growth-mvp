import { afterEach, describe, expect, it, vi } from 'vitest';

// Keep the module graph light + deterministic in node env.
vi.mock('@/lib/services/voiceGate', () => ({ isVoiceOutEnabled: vi.fn(() => true) }));

import { parseSse, pcmS16leToFloat32, synthChunk } from '../cartesiaVoice';

// LE bytes for Int16 [0, 16384, -16384, 32767].
const S16_BYTES = new Uint8Array([0, 0, 0, 64, 0, 192, 255, 127]);

function sse(events: object[]): string {
  return events.map((e) => `data: ${JSON.stringify(e)}`).join('\n\n');
}

describe('pcmS16leToFloat32', () => {
  it('decodes little-endian s16 to normalized floats', () => {
    const out = pcmS16leToFloat32([S16_BYTES]);
    expect(out.length).toBe(4);
    expect(out[0]).toBeCloseTo(0, 5);
    expect(out[1]).toBeCloseTo(0.5, 4);
    expect(out[2]).toBeCloseTo(-0.5, 4);
    expect(out[3]).toBeCloseTo(0.99997, 4);
  });
  it('concatenates chunk parts in order', () => {
    const out = pcmS16leToFloat32([S16_BYTES.slice(0, 4), S16_BYTES.slice(4)]);
    expect(out.length).toBe(4);
    expect(out[3]).toBeCloseTo(0.99997, 4);
  });
});

describe('parseSse', () => {
  const b64 = Buffer.from(S16_BYTES).toString('base64');

  it('merges chunk audio + word timestamps across events', () => {
    const body = sse([
      { type: 'chunk', data: b64 },
      {
        type: 'timestamps',
        word_timestamps: { words: ['hi', 'there'], start: [0, 0.5], end: [0.4, 0.9] },
      },
      { type: 'done' },
    ]);
    const r = parseSse(body);
    expect(r).not.toBeNull();
    expect(r!.samples.length).toBe(4);
    expect(r!.words).toEqual(['hi', 'there']);
    expect(r!.starts).toEqual([0, 0.5]);
  });

  it('returns null on an error event', () => {
    const body = sse([{ type: 'error', message: 'boom' }]);
    expect(parseSse(body)).toBeNull();
  });

  it('returns null when no audio chunks present', () => {
    const body = sse([
      { type: 'timestamps', word_timestamps: { words: ['x'], start: [0], end: [1] } },
      { type: 'done' },
    ]);
    expect(parseSse(body)).toBeNull();
  });
});

describe('synthChunk: QA cost guard (VITE_QA_STUB_TTS)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('never calls fetch and returns a placeholder chunk when the stub flag is on', async () => {
    vi.stubEnv('VITE_QA_STUB_TTS', 'true');
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const chunk = await synthChunk('hello there', 1);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(chunk).not.toBeNull();
    expect(chunk!.samples.length).toBeGreaterThan(0);
    expect(chunk!.words).toEqual([]);
    expect(chunk!.starts).toEqual([]);
  });

  it('falls through to the live fetch when the stub flag is off', async () => {
    vi.stubEnv('VITE_QA_STUB_TTS', 'false');
    const fetchSpy = vi.fn(async (_url: string) => ({
      ok: false,
      status: 500,
      text: async () => '',
    }));
    vi.stubGlobal('fetch', fetchSpy);

    // gen 0 matches the module's initial `generation` value so the assertion
    // below exercises the !res.ok branch, not the stale-generation guard.
    const chunk = await synthChunk('hello there', 0);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0][0])).toContain('/api/cartesia-tts-sse');
    expect(chunk).toBeNull();
  });
});
