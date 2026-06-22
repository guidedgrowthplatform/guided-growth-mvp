import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const scheduled: Array<{ idx: number; at: number; word: string }> = [];

vi.mock('../pcmPlayer', () => ({
  pcmBegin: vi.fn(),
  pcmEnqueue: vi.fn(),
  pcmFinish: vi.fn(),
  pcmScheduleWord: vi.fn((idx: number, at: number, word: string) =>
    scheduled.push({ idx, at, word }),
  ),
  pcmStop: vi.fn(),
  pcmSupported: vi.fn(() => true),
  unlockPcmAudio: vi.fn(),
}));

vi.mock('../cartesia-token-cache', () => ({
  takeAccessToken: vi.fn(async () => ({ accessToken: 'tok' })),
}));

vi.mock('@/config/voiceConfig', () => ({ COACH_VOICE_ID: 'v' }));

interface FakeSocket {
  readyState: number;
  onopen: (() => void) | null;
  onerror: (() => void) | null;
  onmessage: ((ev: { data: string }) => void) | null;
  onclose: (() => void) | null;
  send: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
}

let lastSocket: FakeSocket | null = null;

function makeSocketCtor() {
  const Ctor = vi.fn(() => {
    const s: FakeSocket = {
      readyState: 0,
      onopen: null,
      onerror: null,
      onmessage: null,
      onclose: null,
      send: vi.fn(),
      close: vi.fn(),
    };
    lastSocket = s;
    setTimeout(() => {
      s.readyState = 1;
      s.onopen?.();
    }, 0);
    return s;
  }) as unknown as typeof WebSocket;
  (Ctor as unknown as { OPEN: number; CONNECTING: number }).OPEN = 1;
  (Ctor as unknown as { OPEN: number; CONNECTING: number }).CONNECTING = 0;
  return Ctor;
}

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

function emitTimestamps(words: string[], start: number[], end: number[], ctx?: string): void {
  lastSocket?.onmessage?.({
    data: JSON.stringify({
      type: 'timestamps',
      ...(ctx ? { context_id: ctx } : {}),
      word_timestamps: { words, start, end },
    }),
  });
}

describe('cartesia-ws timestamps scheduling', () => {
  beforeEach(() => {
    scheduled.length = 0;
    lastSocket = null;
    vi.stubGlobal('WebSocket', makeSocketCtor());
    vi.stubGlobal('crypto', { randomUUID: () => 'uuid' });
    vi.stubGlobal('atob', (s: string) => s);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  async function beginTurn() {
    const mod = await import('../cartesia-ws');
    mod.wsBegin({ onWord: vi.fn() });
    await flush();
    await flush();
    await flush();
    return mod;
  }

  it('schedules idx/at/word per onset within one frame', async () => {
    await beginTurn();
    emitTimestamps(["It's", 'nine'], [0, 0.5], [0.5, 1.0]);
    expect(scheduled).toEqual([
      { idx: 0, at: 0, word: "It's" },
      { idx: 1, at: 0.5, word: 'nine' },
    ]);
  });

  it('accumulates idx cumulatively across two frames in one generation', async () => {
    await beginTurn();
    emitTimestamps(['a', 'b'], [0, 0.5], [0.5, 1.0]);
    emitTimestamps(['c', 'd'], [1.0, 1.5], [1.5, 2.0]);
    expect(scheduled.map((s) => s.idx)).toEqual([0, 1, 2, 3]);
    expect(scheduled.map((s) => s.word)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('backward start[] rebases onset time but does NOT reset the global index', async () => {
    await beginTurn();
    emitTimestamps(['a', 'b'], [0, 0.5], [0.5, 1.0]);
    // per-generation reset: start jumps back to 0
    emitTimestamps(['c', 'd'], [0, 0.5], [0.5, 1.0]);
    expect(scheduled.map((s) => s.idx)).toEqual([0, 1, 2, 3]);
    // rebased onto previous tail (1.0)
    expect(scheduled.slice(2).map((s) => s.at)).toEqual([1.0, 1.5]);
  });

  it('wsBegin resets turn index/time state', async () => {
    const mod = await beginTurn();
    emitTimestamps(['a', 'b'], [0, 0.5], [0.5, 1.0]);
    mod.wsBegin({ onWord: vi.fn() });
    await flush();
    scheduled.length = 0;
    emitTimestamps(['x'], [0], [0.4]);
    expect(scheduled).toEqual([{ idx: 0, at: 0, word: 'x' }]);
  });

  it('ignores frames for a stale context', async () => {
    await beginTurn();
    emitTimestamps(['a'], [0], [0.5], 'stale-ctx');
    expect(scheduled).toHaveLength(0);
  });
});
