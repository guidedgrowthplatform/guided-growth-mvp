import { describe, expect, it, vi } from 'vitest';
import { runState3Loop, shouldStartState3 } from '../useState3VoiceInput';

describe('shouldStartState3', () => {
  it('false when inactive', () => {
    expect(shouldStartState3(false, 'idle')).toBe(false);
    expect(shouldStartState3(false, null)).toBe(false);
  });
  it('false while Vapi is active or connecting', () => {
    expect(shouldStartState3(true, 'active')).toBe(false);
    expect(shouldStartState3(true, 'connecting')).toBe(false);
  });
  it('true on idle/ended/error/null when active', () => {
    expect(shouldStartState3(true, 'idle')).toBe(true);
    expect(shouldStartState3(true, 'ended')).toBe(true);
    expect(shouldStartState3(true, 'error')).toBe(true);
    expect(shouldStartState3(true, null)).toBe(true);
    expect(shouldStartState3(true, undefined)).toBe(true);
  });
});

function makeDeps(overrides: Partial<Parameters<typeof runState3Loop>[0]> = {}) {
  const abort = new AbortController();
  return {
    abort,
    setListening: vi.fn(),
    onTranscript: vi.fn(),
    isCancelled: vi.fn(() => false),
    isStillActive: vi.fn(() => true),
    startRecording: vi.fn(async () => {}),
    stopAndTranscribe: vi.fn(async () => ''),
    stopRecording: vi.fn(() => {}),
    signal: abort.signal,
    ...overrides,
  };
}

describe('runState3Loop', () => {
  it('emits non-empty transcript once', async () => {
    const deps = makeDeps({ stopAndTranscribe: vi.fn(async () => 'hello world  ') });
    await runState3Loop(deps);
    expect(deps.onTranscript).toHaveBeenCalledTimes(1);
    expect(deps.onTranscript).toHaveBeenCalledWith('hello world');
  });

  it('does not emit empty transcript', async () => {
    const deps = makeDeps({ stopAndTranscribe: vi.fn(async () => '   ') });
    await runState3Loop(deps);
    expect(deps.onTranscript).not.toHaveBeenCalled();
  });

  it('bails early when cancelled before start', async () => {
    const deps = makeDeps({ isCancelled: vi.fn(() => true) });
    await runState3Loop(deps);
    expect(deps.startRecording).not.toHaveBeenCalled();
    expect(deps.onTranscript).not.toHaveBeenCalled();
  });

  it('returns silently on AbortError from transcribe', async () => {
    const deps = makeDeps({
      stopAndTranscribe: vi.fn(async () => {
        throw new DOMException('aborted', 'AbortError');
      }),
    });
    await runState3Loop(deps);
    expect(deps.onTranscript).not.toHaveBeenCalled();
  });

  it('swallows non-Abort transcribe errors and still calls setListening(false)', async () => {
    const deps = makeDeps({
      stopAndTranscribe: vi.fn(async () => {
        throw new Error('STT 500');
      }),
    });
    await runState3Loop(deps);
    expect(deps.onTranscript).not.toHaveBeenCalled();
    expect(deps.setListening).toHaveBeenCalledWith(false);
  });

  it('drops transcript when cancellation arrives between transcribe and onTranscript', async () => {
    let cancelled = false;
    const deps = makeDeps({
      isCancelled: () => cancelled,
      stopAndTranscribe: vi.fn(async () => {
        cancelled = true;
        return 'late';
      }),
    });
    await runState3Loop(deps);
    expect(deps.onTranscript).not.toHaveBeenCalled();
  });
});
