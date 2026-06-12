/** @vitest-environment jsdom */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionLogContext, type SessionLogContextValue } from '@/contexts/SessionLogContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { queryKeys } from '@/lib/query';
import type { OnboardingState } from '@gg/shared/types';
import { useAgentNavigation } from '../useAgentNavigation';

const navigateSpy = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigateSpy }));

const sessionCtx: SessionLogContextValue = {
  sessionId: 'test-session',
  logEvent: vi.fn(),
  startVoice: vi.fn(() => 'a'),
  endVoice: vi.fn(),
};

function stateAt(step: number): OnboardingState {
  return { current_step: step, status: 'in_progress', path: 'simple', data: {} } as OnboardingState;
}

let container: HTMLDivElement;
let root: Root;
let qc: QueryClient;

function Probe({ step, route }: { step: number; route: string }) {
  useAgentNavigation(step, route);
  return null;
}
function render(step: number, route: string) {
  act(() => {
    root.render(
      <QueryClientProvider client={qc}>
        <ToastProvider>
          <SessionLogContext.Provider value={sessionCtx}>
            <Probe step={step} route={route} />
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
  navigateSpy.mockClear();
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('useAgentNavigation — advances on current_step bump without voice (text-chat)', () => {
  it('navigates when current_step transitions past the screen (no voice active)', async () => {
    qc.setQueryData(queryKeys.onboarding.state, stateAt(3));
    render(3, '/onboarding/step-4');
    await flush();
    expect(navigateSpy).not.toHaveBeenCalled();

    act(() => qc.setQueryData(queryKeys.onboarding.state, stateAt(4)));
    await flush();
    expect(navigateSpy).toHaveBeenCalledWith('/onboarding/step-4');
  });

  it('advances the goals screen when current_step climbs 4→5 (BEGINNER-02 stall regression)', async () => {
    qc.setQueryData(queryKeys.onboarding.state, stateAt(4));
    render(4, '/onboarding/step-5');
    await flush();
    expect(navigateSpy).not.toHaveBeenCalled();

    act(() => qc.setQueryData(queryKeys.onboarding.state, stateAt(5)));
    await flush();
    expect(navigateSpy).toHaveBeenCalledWith('/onboarding/step-5');
  });

  it('navigates when the row is absent at mount and first appears past the screen (new user, ONBOARD-01--FORM stall regression)', async () => {
    render(1, '/onboarding/step-2');
    await flush();
    expect(navigateSpy).not.toHaveBeenCalled();

    act(() => qc.setQueryData(queryKeys.onboarding.state, stateAt(2)));
    await flush();
    expect(navigateSpy).toHaveBeenCalledWith('/onboarding/step-2');
  });

  it('does NOT yank forward when current_step is already past at mount (cold load / resume)', async () => {
    qc.setQueryData(queryKeys.onboarding.state, stateAt(5));
    render(2, '/onboarding/step-3');
    await flush();
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('does NOT yank forward when arriving from a LATER screen (deliberate back-nav)', async () => {
    qc.setQueryData(queryKeys.onboarding.lastNavStep, 6);
    qc.setQueryData(queryKeys.onboarding.state, stateAt(7));
    render(5, '/onboarding/step-6');
    await flush();
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('catches up (advances) when arriving from an EARLIER screen but the server already raced ahead', async () => {
    qc.setQueryData(queryKeys.onboarding.lastNavStep, 5);
    qc.setQueryData(queryKeys.onboarding.state, stateAt(7));
    render(6, '/onboarding/step-7');
    await flush();
    expect(navigateSpy).toHaveBeenCalledWith('/onboarding/step-7');
  });

  it('starts the catch-up cascade from an early screen when the server is several steps ahead', async () => {
    qc.setQueryData(queryKeys.onboarding.lastNavStep, 1);
    qc.setQueryData(queryKeys.onboarding.state, stateAt(7));
    render(2, '/onboarding/step-3');
    await flush();
    expect(navigateSpy).toHaveBeenCalledWith('/onboarding/step-3');
  });

  it('navigates at most once per mount (idempotent across re-renders)', async () => {
    qc.setQueryData(queryKeys.onboarding.state, stateAt(3));
    render(3, '/onboarding/step-4');
    act(() => qc.setQueryData(queryKeys.onboarding.state, stateAt(4)));
    await flush();
    expect(navigateSpy).toHaveBeenCalledTimes(1);
    render(3, '/onboarding/step-4');
    await flush();
    expect(navigateSpy).toHaveBeenCalledTimes(1);
  });
});
