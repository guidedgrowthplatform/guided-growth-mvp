import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createSonioxSession,
  type SonioxCoreDeps,
  type SonioxSocket,
  type SonioxState,
} from '@/lib/services/soniox-stream';

// FakeSocket records sent frames and exposes emit* to drive the core.
class FakeSocket implements SonioxSocket {
  sent: Array<string | ArrayBufferLike> = [];
  closed = false;
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
    this.openCb?.();
  }
  emitMessage(obj: unknown): void {
    this.msgCb?.(JSON.stringify(obj));
  }
  emitRaw(raw: string): void {
    this.msgCb?.(raw);
  }
  emitError(e?: unknown): void {
    this.errCb?.(e);
  }
  emitClose(code?: number): void {
    this.closeCb?.(code);
  }

  jsonSent(): Array<Record<string, unknown>> {
    return this.sent
      .filter((s): s is string => typeof s === 'string')
      .map((s) => JSON.parse(s) as Record<string, unknown>);
  }
}

// Manual fake timer — stores the latest scheduled fn so tests can fire it.
interface ScheduledTimer {
  fn: () => void;
  ms: number;
  cleared: boolean;
}

function makeHarness(overrides?: Partial<SonioxCoreDeps>) {
  const sockets: FakeSocket[] = [];
  const timers: ScheduledTimer[] = [];
  const interim = vi.fn<(text: string) => void>();
  const final = vi.fn<(text: string) => void>();
  const stateChanges: SonioxState[] = [];
  const error = vi.fn<(msg: string) => void>();
  let keyCount = 0;

  const deps: SonioxCoreDeps = {
    url: 'wss://test',
    openSocket: () => {
      const s = new FakeSocket();
      sockets.push(s);
      return s;
    },
    getTempKey: vi.fn(async () => {
      keyCount += 1;
      return `temp-key-${keyCount}`;
    }),
    onInterim: interim,
    onFinal: final,
    onStateChange: (s) => stateChanges.push(s),
    onError: error,
    now: () => Date.now(),
    setTimer: (fn, ms) => {
      const t: ScheduledTimer = { fn, ms, cleared: false };
      timers.push(t);
      return t;
    },
    clearTimer: (h) => {
      (h as ScheduledTimer).cleared = true;
    },
    ...overrides,
  };

  const session = createSonioxSession(deps);

  // Wait for getTempKey() microtask chain to resolve.
  const flush = () => new Promise<void>((r) => setTimeout(r, 0));

  return {
    session,
    sockets,
    timers,
    interim,
    final,
    error,
    stateChanges,
    deps,
    flush,
    keyCount: () => keyCount,
    fireKeepAlive: () => {
      const live = timers.filter((t) => !t.cleared);
      live[live.length - 1]?.fn();
    },
  };
}

describe('createSonioxSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. start() mints key, opens socket, sends config frame, connecting -> listening', async () => {
    const h = makeHarness();
    h.session.start();
    expect(h.stateChanges).toContain('connecting');
    await h.flush();

    expect(h.deps.getTempKey).toHaveBeenCalledTimes(1);
    expect(h.sockets).toHaveLength(1);

    h.sockets[0].emitOpen();
    const firstFrame = h.sockets[0].jsonSent()[0];
    expect(firstFrame.model).toBe('stt-rt-v4');
    expect(firstFrame.enable_endpoint_detection).toBe(true);
    expect(firstFrame.audio_format).toBe('pcm_s16le');
    expect(firstFrame.api_key).toBe('temp-key-1');
    expect(h.session.getState()).toBe('listening');
    expect(h.stateChanges).toEqual(['connecting', 'listening']);
  });

  it('2. non-final tokens -> onInterim cumulative, no onFinal', async () => {
    const h = makeHarness();
    h.session.start();
    await h.flush();
    h.sockets[0].emitOpen();

    h.sockets[0].emitMessage({ tokens: [{ text: 'hello ', is_final: false }] });
    h.sockets[0].emitMessage({ tokens: [{ text: 'hello world', is_final: false }] });

    expect(h.interim).toHaveBeenLastCalledWith('hello world');
    expect(h.final).not.toHaveBeenCalled();
  });

  it('3. is_final tokens accumulate; <end> flushes onFinal once, clears buffers', async () => {
    const h = makeHarness();
    h.session.start();
    await h.flush();
    h.sockets[0].emitOpen();

    h.sockets[0].emitMessage({ tokens: [{ text: 'turn ', is_final: true }] });
    h.sockets[0].emitMessage({ tokens: [{ text: 'one', is_final: true }] });
    h.sockets[0].emitMessage({ tokens: [{ text: '<end>', is_final: true }] });

    expect(h.final).toHaveBeenCalledTimes(1);
    expect(h.final).toHaveBeenCalledWith('turn one');
    expect(h.session.getState()).toBe('listening');

    // Buffers cleared: a fresh interim starts empty.
    h.sockets[0].emitMessage({ tokens: [{ text: 'next', is_final: false }] });
    expect(h.interim).toHaveBeenLastCalledWith('next');
  });

  it('4. multi-turn: two <end>-terminated utterances, socket not closed between', async () => {
    const h = makeHarness();
    h.session.start();
    await h.flush();
    h.sockets[0].emitOpen();

    h.sockets[0].emitMessage({ tokens: [{ text: 'first utterance', is_final: true }] });
    h.sockets[0].emitMessage({ tokens: [{ text: '<end>', is_final: true }] });
    h.sockets[0].emitMessage({ tokens: [{ text: 'second utterance', is_final: true }] });
    h.sockets[0].emitMessage({ tokens: [{ text: '<end>', is_final: true }] });

    expect(h.final).toHaveBeenCalledTimes(2);
    expect(h.final).toHaveBeenNthCalledWith(1, 'first utterance');
    expect(h.final).toHaveBeenNthCalledWith(2, 'second utterance');
    expect(h.sockets[0].closed).toBe(false);
  });

  it('5. keepalive: firing the timer sends a keepalive frame', async () => {
    const h = makeHarness();
    h.session.start();
    await h.flush();
    h.sockets[0].emitOpen();

    h.sockets[0].sent = [];
    h.fireKeepAlive();

    const frames = h.sockets[0].jsonSent();
    expect(frames.some((f) => f.type === 'keepalive')).toBe(true);
  });

  it('6. feedAudio dropped while responding, sent while listening', async () => {
    const h = makeHarness();
    h.session.start();
    await h.flush();
    h.sockets[0].emitOpen();
    h.sockets[0].sent = [];

    h.session.setResponding(true);
    h.session.feedAudio(new Int16Array([1, 2, 3]));
    expect(h.sockets[0].sent).toHaveLength(0);

    h.session.setResponding(false);
    h.session.feedAudio(new Int16Array([4, 5, 6]));
    expect(h.sockets[0].sent).toHaveLength(1);
  });

  it('7. finalize() sends finalize, next final flushes onFinal, socket closed', async () => {
    const h = makeHarness();
    h.session.start();
    await h.flush();
    h.sockets[0].emitOpen();

    h.sockets[0].emitMessage({ tokens: [{ text: 'goodbye', is_final: true }] });
    h.session.finalize();
    expect(h.sockets[0].jsonSent().some((f) => f.type === 'finalize')).toBe(true);

    h.sockets[0].emitMessage({ tokens: [{ text: '<end>', is_final: true }] });
    expect(h.final).toHaveBeenCalledWith('goodbye');
    expect(h.sockets[0].closed).toBe(true);
  });

  it('8. dispose() closes socket, clears keepalive, suppresses later callbacks; idempotent', async () => {
    const h = makeHarness();
    h.session.start();
    await h.flush();
    h.sockets[0].emitOpen();

    const liveTimersBefore = h.timers.filter((t) => !t.cleared);
    expect(liveTimersBefore.length).toBeGreaterThan(0);

    h.session.dispose();
    expect(h.sockets[0].closed).toBe(true);
    expect(h.timers.every((t) => t.cleared)).toBe(true);

    h.final.mockClear();
    h.interim.mockClear();
    h.sockets[0].emitMessage({ tokens: [{ text: 'late', is_final: true }] });
    h.sockets[0].emitMessage({ tokens: [{ text: '<end>', is_final: true }] });
    expect(h.final).not.toHaveBeenCalled();
    expect(h.interim).not.toHaveBeenCalled();

    expect(() => h.session.dispose()).not.toThrow();
  });

  it('9. reconnect re-mints key + reopens; a healthy reconnect resets the budget', async () => {
    const h = makeHarness({ maxReconnects: 1 });
    h.session.start();
    await h.flush();
    h.sockets[0].emitOpen();
    expect(h.keyCount()).toBe(1);

    // Drop #1 -> schedule reconnect -> reopen with a fresh key.
    h.sockets[0].emitClose(1006);
    h.timers.filter((t) => !t.cleared).pop()?.fn();
    await h.flush();
    expect(h.keyCount()).toBe(2);
    expect(h.sockets).toHaveLength(2);
    h.sockets[1].emitOpen();
    expect(h.sockets[1].jsonSent()[0].api_key).toBe('temp-key-2');

    // Drop #2 AFTER a healthy reconnect: budget reset on open -> reconnects again, no error.
    h.sockets[1].emitClose(1006);
    expect(h.error).not.toHaveBeenCalled();
    expect(h.session.getState()).not.toBe('error');
    expect(h.timers.filter((t) => !t.cleared).length).toBeGreaterThan(0);
  });

  it('9b. consecutive failures with no successful open exhaust the budget -> onError + error', async () => {
    let calls = 0;
    const h = makeHarness({
      maxReconnects: 1,
      getTempKey: vi.fn(async () => {
        calls += 1;
        if (calls === 1) return 'temp-key-1';
        throw new Error('mint failed');
      }),
    });
    h.session.start();
    await h.flush();
    h.sockets[0].emitOpen();

    h.sockets[0].emitClose(1006); // drop #1 -> schedule reconnect
    h.timers.filter((t) => !t.cleared).pop()?.fn(); // reconnect: getTempKey rejects -> no open
    await h.flush();

    expect(h.error).toHaveBeenCalledWith('voice connection lost');
    expect(h.session.getState()).toBe('error');
  });

  it('10. manual finalize: <fin> terminal flushes onFinal once, excludes the marker, closes', async () => {
    const h = makeHarness();
    h.session.start();
    await h.flush();
    h.sockets[0].emitOpen();

    h.sockets[0].emitMessage({ tokens: [{ text: 'all done', is_final: true }] });
    h.session.finalize();
    expect(h.sockets[0].jsonSent().some((f) => f.type === 'finalize')).toBe(true);

    h.sockets[0].emitMessage({ tokens: [{ text: '<fin>', is_final: true }] });
    expect(h.final).toHaveBeenCalledTimes(1);
    expect(h.final).toHaveBeenCalledWith('all done');
    expect(h.sockets[0].closed).toBe(true);
  });

  it('11. finalize watchdog: no terminal token -> force flush + dispose', async () => {
    const h = makeHarness();
    h.session.start();
    await h.flush();
    h.sockets[0].emitOpen();

    h.sockets[0].emitMessage({ tokens: [{ text: 'pending words', is_final: true }] });
    h.session.finalize();
    // No terminal token arrives; fire the watchdog timer (last scheduled).
    h.timers.filter((t) => !t.cleared).pop()?.fn();
    expect(h.final).toHaveBeenCalledWith('pending words');
    expect(h.sockets[0].closed).toBe(true);
  });

  it('12. keepalive suppressed when audio was sent within the window', async () => {
    const h = makeHarness({ now: () => 1000 });
    h.session.start();
    await h.flush();
    h.sockets[0].emitOpen();

    h.session.feedAudio(new Int16Array([1, 2, 3])); // lastAudioAt = 1000
    h.sockets[0].sent = [];
    h.fireKeepAlive();

    expect(h.sockets[0].jsonSent().some((f) => f.type === 'keepalive')).toBe(false);
  });

  it('13. exhausting the reconnect budget flushes trailing text before erroring', async () => {
    const h = makeHarness({ maxReconnects: 0 });
    h.session.start();
    await h.flush();
    h.sockets[0].emitOpen();

    h.sockets[0].emitMessage({ tokens: [{ text: 'half a sentence', is_final: true }] });
    h.sockets[0].emitClose(1006); // no budget -> give up

    expect(h.final).toHaveBeenCalledWith('half a sentence');
    expect(h.error).toHaveBeenCalledWith('voice connection lost');
    expect(h.session.getState()).toBe('error');
  });

  it('14. gives up after the lifetime cap despite healthy reopens (no infinite flap)', async () => {
    const h = makeHarness({ maxReconnects: 5, maxLifetimeReconnects: 2 });
    h.session.start();
    await h.flush();
    h.sockets[0].emitOpen();

    // Each drop reopens and resets the consecutive budget, but the lifetime count climbs.
    for (let i = 0; i < 2; i++) {
      h.sockets[i].emitClose(1006);
      h.timers.filter((t) => !t.cleared).pop()?.fn(); // fire reconnect
      await h.flush();
      h.sockets[i + 1].emitOpen();
    }
    expect(h.error).not.toHaveBeenCalled();

    // Third drop hits the lifetime cap -> error, no further reconnect.
    h.sockets[2].emitClose(1006);
    expect(h.error).toHaveBeenCalledWith('voice connection lost');
    expect(h.session.getState()).toBe('error');
  });
});
