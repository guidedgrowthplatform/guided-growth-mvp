/** @vitest-environment jsdom */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { type ReactNode, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseBrainDump } from '@/api/parseHabits';
import { SessionLogContext, type SessionLogContextValue } from '@/contexts/SessionLogContext';
import { useParseHabits, type ParseResult } from '../useParseHabits';

vi.mock('@/api/parseHabits', () => ({ parseBrainDump: vi.fn() }));

const sessionCtx = { sessionId: 'sess-test-id' } as unknown as SessionLogContextValue;

function wrap(children: ReactNode) {
  return <SessionLogContext.Provider value={sessionCtx}>{children}</SessionLogContext.Provider>;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  root = createRoot(container);
  vi.clearAllMocks();
});

afterEach(() => {
  act(() => root.unmount());
});

function renderParse(): { call: () => Promise<ParseResult> } {
  const ref: { call: () => Promise<ParseResult> } = {
    call: async () => ({ habits: [], source: 'llm' }),
  };
  function Probe() {
    const { parse } = useParseHabits();
    useEffect(() => {
      ref.call = () => parse('sleep earlier and work out three times a week');
    }, [parse]);
    return null;
  }
  act(() => root.render(wrap(<Probe />)));
  return ref;
}

describe('useParseHabits', () => {
  it('returns llm habits on success', async () => {
    vi.mocked(parseBrainDump).mockResolvedValue([{ name: 'Sleep earlier', frequency: 'daily' }]);
    const ref = renderParse();
    let result: ParseResult | undefined;
    await act(async () => {
      result = await ref.call();
    });
    expect(result?.source).toBe('llm');
    expect(result?.habits).toHaveLength(1);
  });

  it('falls back to regex on API error', async () => {
    vi.mocked(parseBrainDump).mockRejectedValue(new Error('network'));
    const ref = renderParse();
    let result: ParseResult | undefined;
    await act(async () => {
      result = await ref.call();
    });
    expect(result?.source).toBe('regex_fallback');
    expect(result?.habits.length).toBeGreaterThan(0);
  });

  it('does NOT regex-fallback on a genuine empty llm result', async () => {
    vi.mocked(parseBrainDump).mockResolvedValue([]);
    const ref = renderParse();
    let result: ParseResult | undefined;
    await act(async () => {
      result = await ref.call();
    });
    expect(result?.source).toBe('llm');
    expect(result?.habits).toHaveLength(0);
  });

  it('falls back to regex on abort/timeout', async () => {
    vi.mocked(parseBrainDump).mockRejectedValue(new DOMException('aborted', 'AbortError'));
    const ref = renderParse();
    let result: ParseResult | undefined;
    await act(async () => {
      result = await ref.call();
    });
    expect(result?.source).toBe('regex_fallback');
    expect(result?.habits.length).toBeGreaterThan(0);
  });

  it('aborts at the timeout and falls back to regex', async () => {
    vi.useFakeTimers();
    vi.mocked(parseBrainDump).mockImplementation(
      (_t, _s, signal) =>
        new Promise((_res, rej) => {
          signal?.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')));
        }),
    );
    const ref = renderParse();
    let pending: Promise<ParseResult>;
    await act(async () => {
      pending = ref.call();
    });
    let result: ParseResult | undefined;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
      result = await pending;
    });
    expect(result?.source).toBe('regex_fallback');
    vi.useRealTimers();
  });

  it('aborts the prior controller on a concurrent parse', async () => {
    const signals: AbortSignal[] = [];
    vi.mocked(parseBrainDump).mockImplementation(
      (_t, _s, signal) =>
        new Promise((_res, rej) => {
          signals.push(signal as AbortSignal);
          signal?.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')));
        }),
    );
    const ref = renderParse();
    await act(async () => {
      void ref.call();
      void ref.call();
    });
    expect(signals).toHaveLength(2);
    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);
  });

  it('unmount mid-flight does not throw or warn on setState', async () => {
    let resolveParse: (h: never[]) => void = () => {};
    vi.mocked(parseBrainDump).mockReturnValue(
      new Promise((res) => {
        resolveParse = res as (h: never[]) => void;
      }),
    );
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {});
    const ref = renderParse();
    let pending: Promise<ParseResult>;
    act(() => {
      pending = ref.call();
    });
    act(() => root.unmount());
    await act(async () => {
      resolveParse([]);
      await pending;
    });
    expect(warn.mock.calls.some(([m]) => String(m).includes('unmounted'))).toBe(false);
    warn.mockRestore();
  });
});
