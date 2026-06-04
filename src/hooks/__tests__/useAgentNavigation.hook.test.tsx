/** @vitest-environment jsdom */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionLogContext, type SessionLogContextValue } from '@/contexts/SessionLogContext';
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
        <SessionLogContext.Provider value={sessionCtx}>
          <Probe step={step} route={route} />
        </SessionLogContext.Provider>
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

  it('does NOT yank forward when current_step is already past at mount (back-nav)', async () => {
    qc.setQueryData(queryKeys.onboarding.state, stateAt(5));
    render(2, '/onboarding/step-3');
    await flush();
    expect(navigateSpy).not.toHaveBeenCalled();
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
