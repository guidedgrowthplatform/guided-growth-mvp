/** @vitest-environment jsdom */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionLogContext, type SessionLogContextValue } from '@/contexts/SessionLogContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { queryKeys } from '@/lib/query/keys';
import { useCheckinFlowPersistence } from './checkinPersistence';
import type { FlowPersistence } from './persistence';

const recordCheckinTool = vi.fn();
const completeHabitTool = vi.fn();
const logReflectionTool = vi.fn();
vi.mock('@/api/checkinTool', () => ({
  recordCheckinTool: (...a: unknown[]) => recordCheckinTool(...a),
  completeHabitTool: (...a: unknown[]) => completeHabitTool(...a),
  logReflectionTool: (...a: unknown[]) => logReflectionTool(...a),
}));

const captureException = vi.fn();
vi.mock('@/lib/sentry', () => ({
  Sentry: { captureException: (...a: unknown[]) => captureException(...a) },
}));

const logEvent = vi.fn();
const sessionCtx: SessionLogContextValue = {
  sessionId: 'test-session',
  logEvent,
  startVoice: vi.fn(() => 'a'),
  endVoice: vi.fn(),
};

let container: HTMLDivElement;
let root: Root;
let qc: QueryClient;
let captured: FlowPersistence;

function Probe() {
  captured = useCheckinFlowPersistence();
  return null;
}
function render() {
  act(() => {
    root.render(
      <QueryClientProvider client={qc}>
        <ToastProvider>
          <SessionLogContext.Provider value={sessionCtx}>
            <Probe />
          </SessionLogContext.Provider>
        </ToastProvider>
      </QueryClientProvider>,
    );
  });
}
async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  render();
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('useCheckinFlowPersistence.saveTool', () => {
  it('flattens checkin and calls record_checkin, then logs the event', async () => {
    recordCheckinTool.mockResolvedValue({ ok: true, result: {} });
    act(() => {
      captured.saveTool?.('record_checkin', {
        checkin: { sleep: 4, mood: 3, energy: 5, stress: 2 },
      });
    });
    await flush();
    expect(recordCheckinTool).toHaveBeenCalledWith({ sleep: 4, mood: 3, energy: 5, stress: 2 });
    expect(logEvent).toHaveBeenCalledWith(
      'checkin_completed',
      expect.objectContaining({ type: 'morning', via: 'tap', mood: 3 }),
    );
  });

  it('handles a partial check-in', async () => {
    recordCheckinTool.mockResolvedValue({ ok: true, result: {} });
    act(() => {
      captured.saveTool?.('record_checkin', { checkin: { mood: 4 } });
    });
    await flush();
    expect(recordCheckinTool).toHaveBeenCalledWith({ mood: 4 });
  });

  it('on save failure: does not throw, reports to Sentry + toast', async () => {
    recordCheckinTool.mockRejectedValue(new Error('save down'));
    expect(() =>
      act(() => {
        captured.saveTool?.('record_checkin', { checkin: { mood: 3 } });
      }),
    ).not.toThrow();
    await flush();
    expect(captureException).toHaveBeenCalled();
  });

  it('complete_habit: fires once per done habit, skips missed/pending', async () => {
    completeHabitTool.mockResolvedValue({ ok: true });
    act(() => {
      captured.saveTool?.('complete_habit', {
        habitStatuses: { h1: 'done', h2: 'missed', h3: 'done', h4: 'pending' },
      } as never);
    });
    await flush();
    expect(completeHabitTool).toHaveBeenCalledTimes(2);
    expect(completeHabitTool).toHaveBeenCalledWith('h1');
    expect(completeHabitTool).toHaveBeenCalledWith('h3');
  });

  it('complete_habit: no done habits → no call', async () => {
    act(() => {
      captured.saveTool?.('complete_habit', { habitStatuses: { h1: 'pending' } } as never);
    });
    await flush();
    expect(completeHabitTool).not.toHaveBeenCalled();
  });

  it('log_reflection: posts the text and logs completion', async () => {
    logReflectionTool.mockResolvedValue({ ok: true });
    act(() => {
      captured.saveTool?.('log_reflection', { reflectionText: 'grateful today' } as never);
    });
    await flush();
    expect(logReflectionTool).toHaveBeenCalledWith('grateful today');
    expect(logEvent).toHaveBeenCalledWith(
      'checkin_completed',
      expect.objectContaining({ type: 'morning', via: 'tap' }),
    );
  });

  it('complete_habit: success invalidates the habits cache', async () => {
    completeHabitTool.mockResolvedValue({ ok: true });
    const invalidate = vi.spyOn(qc, 'invalidateQueries');
    act(() => {
      captured.saveTool?.('complete_habit', { habitStatuses: { h1: 'done' } } as never);
    });
    await flush();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.habits.all });
  });

  it('complete_habit: a failed call still invalidates and reports', async () => {
    completeHabitTool.mockRejectedValue(new Error('save down'));
    const invalidate = vi.spyOn(qc, 'invalidateQueries');
    act(() => {
      captured.saveTool?.('complete_habit', { habitStatuses: { h1: 'done' } } as never);
    });
    await flush();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.habits.all });
    expect(captureException).toHaveBeenCalled();
  });

  it('log_reflection: on save failure reports to Sentry, does not throw', async () => {
    logReflectionTool.mockRejectedValue(new Error('save down'));
    expect(() =>
      act(() => {
        captured.saveTool?.('log_reflection', { reflectionText: 'today' } as never);
      }),
    ).not.toThrow();
    await flush();
    expect(captureException).toHaveBeenCalled();
  });

  it('log_reflection: empty text → no call', async () => {
    act(() => {
      captured.saveTool?.('log_reflection', { reflectionText: '   ' } as never);
    });
    await flush();
    expect(logReflectionTool).not.toHaveBeenCalled();
  });

  it('reports an unmapped tool to Sentry and does not dispatch', async () => {
    act(() => {
      captured.saveTool?.('delete_habit', { name: 'x' } as never);
    });
    await flush();
    expect(recordCheckinTool).not.toHaveBeenCalled();
    expect(captureException).toHaveBeenCalled();
  });
});
