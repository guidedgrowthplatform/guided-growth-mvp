/** @vitest-environment jsdom */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '@/lib/query';
import type { OnboardingState } from '@gg/shared/types';

const navigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));

const advanceOnboardingStep = vi.fn(
  async (n: number) =>
    ({ current_step: n, updated_at: '2026-06-15T00:00:00Z' }) as unknown as OnboardingState,
);
vi.mock('@/api/onboarding', () => ({
  advanceOnboardingStep: (n: number) => advanceOnboardingStep(n),
}));

const { useOnboardingAdvance } = await import('../useOnboardingAdvance');

let container: HTMLDivElement;
let root: Root;
let qc: QueryClient;
let goNext: ReturnType<typeof useOnboardingAdvance>;

function seedStep(currentStep: number) {
  qc.setQueryData<OnboardingState | null>(queryKeys.onboarding.state, {
    current_step: currentStep,
    data: {},
    path: null,
  } as unknown as OnboardingState);
}
function cachedStep(): number | undefined {
  return qc.getQueryData<OnboardingState | null>(queryKeys.onboarding.state)?.current_step;
}

function Bridge() {
  const fn = useOnboardingAdvance();
  useEffect(() => {
    goNext = fn;
  });
  return null;
}

function wrap(children: ReactNode) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  navigate.mockClear();
  advanceOnboardingStep.mockClear();
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  container = document.createElement('div');
  root = createRoot(container);
  act(() => root.render(wrap(<Bridge />)));
});

afterEach(() => {
  act(() => root.unmount());
});

describe('useOnboardingAdvance', () => {
  it('back-navved (current_step > destStep): bumps cache, persists, navigates', async () => {
    seedStep(7);
    await act(async () => {
      await goNext(4, '/onboarding/step-4');
    });
    expect(cachedStep()).toBe(4);
    expect(advanceOnboardingStep).toHaveBeenCalledWith(4);
    expect(
      (qc.getQueryData(queryKeys.onboarding.state) as { updated_at?: string } | undefined)
        ?.updated_at,
    ).toBe('2026-06-15T00:00:00Z');
    expect(navigate).toHaveBeenCalledWith('/onboarding/step-4', undefined);
  });

  it('normal forward edge (current_step <= destStep): no bump, no persist, just navigates', async () => {
    seedStep(3);
    await act(async () => {
      await goNext(4, '/onboarding/step-4');
    });
    expect(cachedStep()).toBe(3);
    expect(advanceOnboardingStep).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/onboarding/step-4', undefined);
  });

  it('passes NavigateOptions (state payload) through unchanged', async () => {
    seedStep(7);
    await act(async () => {
      await goNext(4, '/onboarding/step-4', { state: { category: 'Sleep better' } });
    });
    expect(navigate).toHaveBeenCalledWith('/onboarding/step-4', {
      state: { category: 'Sleep better' },
    });
  });

  it('no cached state: plain navigate, no bump or persist', async () => {
    qc.setQueryData(queryKeys.onboarding.state, null);
    await act(async () => {
      await goNext(4, '/onboarding/step-4');
    });
    expect(advanceOnboardingStep).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/onboarding/step-4', undefined);
  });
});
