/** @vitest-environment jsdom */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * W3-B: Home's morning check-in card must reflect server truth only. A
 * rejected submit_morning_checkin (the setup-config guard, B58/!478) leaves
 * onboarding_states.data.morningCheckin absent, and useMorningCheckinConfigured
 * must read that absence as "not set up", never fall back to a default/true.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OnboardingState } from '@gg/shared/types';
import { useMorningCheckinConfigured } from '../useMorningCheckinConfigured';

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

const getOnboardingState = vi.fn<() => Promise<OnboardingState | null>>();
vi.mock('@/lib/services/supabase-data-service', () => ({
  supabaseDataService: {
    getOnboardingState: () => getOnboardingState(),
  },
}));

let container: HTMLDivElement;
let root: Root;
let qc: QueryClient;
let result: boolean | null = null;

function Probe() {
  result = useMorningCheckinConfigured();
  return null;
}

async function render() {
  await act(async () => {
    root.render(
      <QueryClientProvider client={qc}>
        <Probe />
      </QueryClientProvider>,
    );
  });
}

// The query resolves over the mocked promise plus react-query's own internal
// scheduling (fetch -> cache -> re-render), which is more than one microtask
// tick. Poll with real macrotask ticks (setTimeout) instead of assuming a
// handful of Promise.resolve() ticks is enough.
async function flush() {
  for (let i = 0; i < 15; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

function stateWith(data: Record<string, unknown>): OnboardingState {
  return {
    id: 'row-1',
    anon_id: 'anon-1',
    path: 'simple',
    status: 'completed',
    current_step: 10,
    data,
    completed_at: '2026-07-01T00:00:00Z',
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
  };
}

beforeEach(() => {
  getOnboardingState.mockReset();
  qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  result = null;
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  vi.restoreAllMocks();
});

describe('useMorningCheckinConfigured', () => {
  it('is false when the row has no morningCheckin field (refused or never reached)', async () => {
    getOnboardingState.mockResolvedValue(stateWith({}));
    await render();
    await flush();
    expect(result).toBe(false);
  });

  it('is false when there is no onboarding row at all', async () => {
    getOnboardingState.mockResolvedValue(null);
    await render();
    await flush();
    expect(result).toBe(false);
  });

  it('is true only when morningCheckin is a real, saved config', async () => {
    getOnboardingState.mockResolvedValue(
      stateWith({
        morningCheckin: {
          time: '08:00',
          days: [1, 2, 3, 4, 5],
          reminder: true,
          schedule: 'Weekday',
        },
      }),
    );
    await render();
    await flush();
    expect(result).toBe(true);
  });
});
