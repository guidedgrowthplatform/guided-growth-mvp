// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const isNativePlatform = vi.fn(() => false);
const emitLatencySpan = vi.fn();

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => isNativePlatform() },
}));
vi.mock('@/lib/telemetry/latencySpans', () => ({
  emitLatencySpan: (...args: unknown[]) => emitLatencySpan(...args),
}));

async function load() {
  vi.resetModules();
  return import('../warmup');
}

describe('fireWarmup', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    isNativePlatform.mockReturnValue(false);
    emitLatencySpan.mockClear();
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ warm: true, db_ms: 12 }),
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fires exactly once per load, even if called multiple times', async () => {
    const { fireWarmup } = await load();
    fireWarmup();
    fireWarmup();
    fireWarmup();
    // 2 fetches per call (llm + cartesia) — only the first call's pair should fire.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('hits both the llm warmup and cartesia-tts warmup endpoints', async () => {
    const { fireWarmup } = await load();
    fireWarmup();
    const urls = fetchMock.mock.calls.map((c) => c[0] as string);
    expect(urls.some((u) => u.endsWith('/api/llm/warmup'))).toBe(true);
    expect(urls.some((u) => u.endsWith('/api/cartesia-tts'))).toBe(true);
    for (const call of fetchMock.mock.calls) {
      expect(call[1]).toMatchObject({ method: 'GET', keepalive: true });
    }
  });

  it('swallows a fetch rejection without throwing', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    const { fireWarmup } = await load();
    expect(() => fireWarmup()).not.toThrow();
    // let the rejected promises settle
    await new Promise((r) => setTimeout(r, 0));
    expect(emitLatencySpan).not.toHaveBeenCalled();
  });

  it('emits warmup_roundtrip_ms with db_ms parsed from the response on success', async () => {
    const { fireWarmup } = await load();
    fireWarmup();
    // let the resolved fetch promise chain settle
    await new Promise((r) => setTimeout(r, 0));
    expect(emitLatencySpan).toHaveBeenCalledTimes(1);
    const [span, ms, props] = emitLatencySpan.mock.calls[0];
    expect(span).toBe('warmup_roundtrip_ms');
    expect(typeof ms).toBe('number');
    expect(props).toMatchObject({ db_ms: 12 });
  });

  it('still emits the roundtrip span (without db_ms) if the response body is malformed', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => {
        throw new Error('bad json');
      },
    });
    const { fireWarmup } = await load();
    fireWarmup();
    await new Promise((r) => setTimeout(r, 0));
    expect(emitLatencySpan).toHaveBeenCalledTimes(1);
    const [span, , props] = emitLatencySpan.mock.calls[0];
    expect(span).toBe('warmup_roundtrip_ms');
    expect(props).toMatchObject({ db_ms: undefined });
  });
});
