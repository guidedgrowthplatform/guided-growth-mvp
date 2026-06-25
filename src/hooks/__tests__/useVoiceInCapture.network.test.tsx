/** @vitest-environment jsdom */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StartBrowserSttOpts } from '@/lib/services/soniox-stream';
import { useVoiceInCapture, type VapiStatus } from '../useVoiceInCapture';

vi.mock('@/lib/config/voice', () => ({ VOICE_IN_ENABLED: true }));

const trackMock = vi.fn();
vi.mock('@/analytics/posthog', () => ({ track: (...a: unknown[]) => trackMock(...a) }));

let capturedOpts: StartBrowserSttOpts | null = null;
let bootCount = 0;
const stopMock = vi.fn();
const setRespondingMock = vi.fn();
vi.mock('@/lib/services/soniox-stream', () => ({
  startSonioxBrowserSession: (opts: StartBrowserSttOpts) => {
    capturedOpts = opts;
    bootCount += 1;
    return { setResponding: setRespondingMock, stop: stopMock };
  },
}));

interface BridgeProps {
  active?: boolean;
  vapiStatus?: VapiStatus;
  onTranscript?: (t: string) => void;
  onError?: (m: string) => void;
}
function Bridge({
  active = true,
  vapiStatus = 'idle',
  onTranscript = vi.fn(),
  onError = vi.fn(),
}: BridgeProps) {
  useVoiceInCapture({ active, vapiStatus, onTranscript, onError });
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
  act(() => capturedOpts!.onFinal(text));
}
function fireError(msg: string) {
  act(() => capturedOpts!.onError(msg));
}
function fireOnline() {
  act(() => window.dispatchEvent(new Event('online')));
}

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => value });
}

beforeEach(() => {
  trackMock.mockReset();
  stopMock.mockReset();
  setRespondingMock.mockReset();
  capturedOpts = null;
  bootCount = 0;
  setOnline(true);
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
  setOnline(true);
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// E4: offline recoverable error must NOT spend the restart budget (the 'online'
// listener drives recovery), but the heardAnyFinal swallow still applies.
describe('useVoiceInCapture — E4 offline onError handling', () => {
  it('offline recoverable error after a final: swallowed, no reboot', () => {
    const onError = vi.fn();
    mount({ onError });
    const bootsAfterMount = bootCount;

    fireFinal('heard offline');
    setOnline(false);
    fireError('voice connection lost');

    expect(onError).not.toHaveBeenCalled();
    expect(trackMock).toHaveBeenCalledWith(
      'voice_in_recoverable_error_swallowed',
      expect.objectContaining({ msg: 'voice connection lost' }),
    );
    // No restart-budget spend => no re-boot of the session.
    expect(bootCount).toBe(bootsAfterMount);
  });

  it('offline recoverable error with no prior final: surfaces onError, no reboot', () => {
    const onError = vi.fn();
    mount({ onError });
    const bootsAfterMount = bootCount;

    setOnline(false);
    fireError('voice connection lost');

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith('voice connection lost');
    expect(bootCount).toBe(bootsAfterMount);
  });
});

// E3: a window 'online' event reboots the session — but only when voice should be
// running AND no live session is held.
describe('useVoiceInCapture — E3 online reboot', () => {
  it('does NOT reboot while a live session is held', () => {
    mount({});
    const bootsAfterMount = bootCount;

    fireOnline();
    expect(bootCount).toBe(bootsAfterMount);
  });

  it('does NOT reboot when voice should not be running (Vapi active)', () => {
    mount({ vapiStatus: 'active' });
    const bootsBefore = bootCount;
    expect(bootsBefore).toBe(0); // session effect never booted

    fireOnline();
    expect(bootCount).toBe(0);
  });

  it('online listener is torn down on unmount (no boot after unmount)', () => {
    mount({});
    act(() => root.unmount());
    const bootsAfterUnmount = bootCount;

    fireOnline();
    expect(bootCount).toBe(bootsAfterUnmount);
  });

  it('reboots a session parked offline once connectivity returns', () => {
    mount({});
    const bootsAfterMount = bootCount;

    // Offline drop parks the (dead-but-not-torn-down) handle.
    setOnline(false);
    fireError('voice connection lost');
    expect(bootCount).toBe(bootsAfterMount);

    // Connectivity back → parked flag lets the listener reboot despite a stale handle.
    setOnline(true);
    fireOnline();
    expect(bootCount).toBe(bootsAfterMount + 1);
  });
});
