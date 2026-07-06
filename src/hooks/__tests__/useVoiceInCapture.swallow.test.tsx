/** @vitest-environment jsdom */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StartBrowserSttOpts } from '@/lib/services/soniox-stream';
import { useVoiceInCapture } from '../useVoiceInCapture';

// VOICE_IN_ENABLED is env-gated (defaults false in test); force it on so the
// session effect actually boots and wires the callbacks we want to drive.
vi.mock('@/lib/config/voice', () => ({ VOICE_IN_ENABLED: true }));

const trackMock = vi.fn();
vi.mock('@/analytics/posthog', () => ({ track: (...a: unknown[]) => trackMock(...a) }));

// Capture the opts the hook passes into startSonioxBrowserSession so the test
// can fire onFinal / onError manually. The returned handle is a stub.
let capturedOpts: StartBrowserSttOpts | null = null;
const stopMock = vi.fn();
const setRespondingMock = vi.fn();
vi.mock('@/lib/services/soniox-stream', () => ({
  startSonioxBrowserSession: (opts: StartBrowserSttOpts) => {
    capturedOpts = opts;
    return { setResponding: setRespondingMock, stop: stopMock };
  },
}));

interface BridgeProps {
  onTranscript?: (t: string) => void;
  onError?: (m: string) => void;
}
function Bridge({ onTranscript = vi.fn(), onError = vi.fn() }: BridgeProps) {
  useVoiceInCapture({ active: true, vapiStatus: 'idle', onTranscript, onError });
  return null;
}

let container: HTMLDivElement;
let root: Root;

function mount(props: BridgeProps) {
  act(() => {
    root.render(<Bridge {...props} />);
  });
}

function fireFinal(text: string) {
  act(() => {
    capturedOpts!.onFinal(text);
  });
}

function fireError(msg: string) {
  act(() => {
    capturedOpts!.onError(msg);
  });
}

// MAX_AUTO_RESTARTS=3 in a 60s window. Three recoverable errors are absorbed as
// restarts (each bumps the restart nonce, re-running the session effect and
// re-capturing opts); the 4th is the one that's past budget and reaches the gate.
function exhaustBudget() {
  for (let i = 0; i < 3; i++) fireError('voice connection lost');
}

beforeEach(() => {
  trackMock.mockReset();
  stopMock.mockReset();
  setRespondingMock.mockReset();
  capturedOpts = null;
  vi.useFakeTimers();
  vi.setSystemTime(0);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  try {
    act(() => root.unmount());
  } catch {
    // ignore
  }
  container.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useVoiceInCapture — #232 swallow gate (hook behavior)', () => {
  it('(a) swallows the bubble: budget-exhausted recoverable error AFTER a final does NOT call onError', () => {
    const onError = vi.fn();
    const onTranscript = vi.fn();
    mount({ onError, onTranscript });
    expect(capturedOpts).not.toBeNull();

    fireFinal('the quick brown fox');
    expect(onTranscript).toHaveBeenCalledWith('the quick brown fox', undefined);

    exhaustBudget(); // 3 recoverable errors → 3 restarts consume the budget
    fireError('voice connection lost'); // 4th: past budget, but a final was heard

    expect(onError).not.toHaveBeenCalled();
    expect(trackMock).toHaveBeenCalledWith(
      'voice_in_recoverable_error_swallowed',
      expect.objectContaining({ msg: 'voice connection lost' }),
    );
  });

  it('(b) surfaces the bubble: budget-exhausted recoverable error with NO prior final DOES call onError', () => {
    const onError = vi.fn();
    mount({ onError });
    expect(capturedOpts).not.toBeNull();

    exhaustBudget();
    fireError('voice connection lost'); // 4th, no final ever heard

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith('voice connection lost');
  });

  it('(c) terminal error ALWAYS surfaces, even after a final was heard (never swallowed)', () => {
    const onError = vi.fn();
    mount({ onError });

    fireFinal('i said something');
    fireError('NotAllowedError: permission denied');

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith('NotAllowedError: permission denied');
    // Terminal errors are not eligible for the swallow path.
    expect(trackMock).not.toHaveBeenCalledWith(
      'voice_in_recoverable_error_swallowed',
      expect.anything(),
    );
  });

  it('a single recoverable error within budget is absorbed as a restart (no surface, no swallow track)', () => {
    const onError = vi.fn();
    mount({ onError });

    fireFinal('heard this');
    fireError('voice connection lost'); // 1st → restart, well within budget

    expect(onError).not.toHaveBeenCalled();
    expect(trackMock).not.toHaveBeenCalledWith(
      'voice_in_recoverable_error_swallowed',
      expect.anything(),
    );
  });
});
