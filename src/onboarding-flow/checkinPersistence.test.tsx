/** @vitest-environment jsdom */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionLogContext, type SessionLogContextValue } from '@/contexts/SessionLogContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { useCheckinFlowPersistence } from './checkinPersistence';
import type { FlowPersistence } from './persistence';

const recordCheckinTool = vi.fn();
vi.mock('@/api/checkinTool', () => ({
  recordCheckinTool: (...a: unknown[]) => recordCheckinTool(...a),
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

  it('reports an unmapped tool to Sentry and does not dispatch', async () => {
    act(() => {
      captured.saveTool?.('delete_habit', { name: 'x' } as never);
    });
    await flush();
    expect(recordCheckinTool).not.toHaveBeenCalled();
    expect(captureException).toHaveBeenCalled();
  });
});
