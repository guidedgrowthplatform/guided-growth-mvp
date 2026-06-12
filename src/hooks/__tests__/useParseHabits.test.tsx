/** @vitest-environment jsdom */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { type ReactNode } from 'react';
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
    ref.call = () => parse('sleep earlier and work out three times a week');
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
});
