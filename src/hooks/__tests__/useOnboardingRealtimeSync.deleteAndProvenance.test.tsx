/** @vitest-environment jsdom */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Integration coverage for the data-provenance fix on the onboarding Realtime
 * sync hook (W2-G).
 *
 * Bug this closes: the QA self-reset flow (api/qa/self-reset.ts) really
 * DELETEs the onboarding_states row server-side. Supabase Realtime DELETE
 * events carry `new: {}` (see @supabase/realtime-js RealtimePostgresDeletePayload),
 * never `null` — so the pre-fix `if (!next) return` never actually detected a
 * DELETE (an empty object is truthy), and the cache never learned the row was
 * wiped. Separately, `isStaleRealtimeRow` only rejects a row when there is a
 * CACHED `updated_at` to compare against; on a fresh subscribe (empty cache)
 * the very first incoming event used to be accepted unconditionally, however
 * old — exactly how a buffered echo of a PRIOR session's real writes on the
 * same anon_id channel could be mistaken for a "fresh" session's live data.
 *
 * These tests drive the hook's real `postgres_changes` callback (captured off
 * a mocked `supabase.channel(...).on(...)`) to prove:
 *   1. A DELETE event clears the cache.
 *   2. On an empty cache, a row timestamped BEFORE this hook subscribed is
 *      dropped (the provenance-stale echo case).
 *   3. On an empty cache, a row timestamped AT/AFTER subscribe is accepted
 *      (a genuinely fresh write racing ahead of the initial REST fetch).
 *   4. The normal update-flow (non-empty cache, isStaleRealtimeRow) is
 *      unchanged.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '@/lib/query';
import type { OnboardingState } from '@gg/shared/types';
import { useOnboardingRealtimeSync } from '../useOnboardingRealtimeSync';

const ANON_ID = 'anon-w2g-test';

type Payload = {
  new?: OnboardingState | Record<string, never> | null;
  old?: Partial<OnboardingState> | null;
  eventType?: string;
};
type Handler = (payload: Payload) => void;

let capturedHandler: Handler | null = null;
const removeChannel = vi.fn();

const subscribeMock = vi.fn((cb: (status: string) => void) => {
  cb('SUBSCRIBED');
  return { on: onMock };
});
const onMock = vi.fn((_type: string, _filter: unknown, handler: Handler) => {
  capturedHandler = handler;
  return { subscribe: subscribeMock };
});
const channelMock = vi.fn((_name: string) => ({ on: onMock }));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    channel: (name: string) => channelMock(name),
    removeChannel: (ch: unknown) => removeChannel(ch),
  },
}));

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: { anonId: string | null }) => unknown) =>
    selector({ anonId: ANON_ID }),
}));

vi.mock('@/lib/telemetry/latencySpans', () => ({
  markBeatTransition: vi.fn(),
}));

function makeRow(overrides: Partial<OnboardingState> = {}): OnboardingState {
  return {
    id: 'row-1',
    anon_id: ANON_ID,
    path: 'beginner',
    status: 'in_progress',
    current_step: 3,
    data: {},
    completed_at: null,
    created_at: '2026-06-25T10:00:00.000Z',
    updated_at: '2026-06-25T10:00:00.000Z',
    ...overrides,
  } as OnboardingState;
}

let container: HTMLDivElement;
let root: Root;
let qc: QueryClient;

function Probe() {
  useOnboardingRealtimeSync();
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

beforeEach(() => {
  capturedHandler = null;
  onMock.mockClear();
  subscribeMock.mockClear();
  channelMock.mockClear();
  removeChannel.mockClear();
  qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  vi.restoreAllMocks();
});

describe('useOnboardingRealtimeSync — DELETE handling + provenance on empty cache', () => {
  it('a DELETE event clears the cached row', async () => {
    const existing = makeRow();
    qc.setQueryData(queryKeys.onboarding.state, existing);
    await render();
    expect(capturedHandler).not.toBeNull();

    await act(async () => {
      capturedHandler!({ eventType: 'DELETE', new: {}, old: { id: 'row-1', anon_id: ANON_ID } });
    });

    expect(qc.getQueryData(queryKeys.onboarding.state)).toBeNull();
  });

  it('drops a pre-subscribe-timestamp echo landing on an empty cache', async () => {
    // Cache is empty (fresh session / post-reset). The subscribe timestamp is
    // "now"; an incoming row timestamped in the past (a buffered echo of a
    // PRIOR session's real write) must not be accepted.
    expect(qc.getQueryData(queryKeys.onboarding.state)).toBeUndefined();
    await render();

    const staleEcho = makeRow({
      updated_at: '2020-01-01T00:00:00.000Z',
      created_at: '2020-01-01T00:00:00.000Z',
      current_step: 6,
    });

    await act(async () => {
      capturedHandler!({ eventType: 'UPDATE', new: staleEcho });
    });

    // Dropped: cache must still show no row, not the stale echo's data.
    const cached = qc.getQueryData<OnboardingState | null>(queryKeys.onboarding.state);
    expect(cached).toBeUndefined();
  });

  it('accepts a fresh post-subscribe write landing on an empty cache', async () => {
    expect(qc.getQueryData(queryKeys.onboarding.state)).toBeUndefined();
    await render();

    // Timestamped "now + a bit" so it is unambiguously at/after subscribe time,
    // simulating Realtime delivering before the initial REST fetch resolves.
    const freshRow = makeRow({
      updated_at: new Date(Date.now() + 1000).toISOString(),
      created_at: new Date(Date.now() + 1000).toISOString(),
      current_step: 1,
    });

    await act(async () => {
      capturedHandler!({ eventType: 'INSERT', new: freshRow });
    });

    const cached = qc.getQueryData<OnboardingState | null>(queryKeys.onboarding.state);
    expect(cached?.id).toBe('row-1');
    expect(cached?.current_step).toBe(1);
  });

  it('normal update flow is unchanged: a genuinely newer row replaces the cached one', async () => {
    const existing = makeRow({ current_step: 2, updated_at: '2026-06-25T10:00:00.000Z' });
    qc.setQueryData(queryKeys.onboarding.state, existing);
    await render();

    const newer = makeRow({ current_step: 3, updated_at: '2026-06-25T10:00:05.000Z' });

    await act(async () => {
      capturedHandler!({ eventType: 'UPDATE', new: newer });
    });

    const cached = qc.getQueryData<OnboardingState | null>(queryKeys.onboarding.state);
    expect(cached?.current_step).toBe(3);
    expect(cached?.updated_at).toBe('2026-06-25T10:00:05.000Z');
  });

  it('normal update flow is unchanged: an older echo against a populated cache is still dropped', async () => {
    const existing = makeRow({ current_step: 5, updated_at: '2026-06-25T10:00:05.000Z' });
    qc.setQueryData(queryKeys.onboarding.state, existing);
    await render();

    const olderEcho = makeRow({ current_step: 1, updated_at: '2026-06-25T10:00:00.000Z' });

    await act(async () => {
      capturedHandler!({ eventType: 'UPDATE', new: olderEcho });
    });

    const cached = qc.getQueryData<OnboardingState | null>(queryKeys.onboarding.state);
    expect(cached?.current_step).toBe(5);
  });

  it('a DELETE followed by a genuinely fresh write is accepted (reset then fresh onboarding start)', async () => {
    const existing = makeRow({ current_step: 5 });
    qc.setQueryData(queryKeys.onboarding.state, existing);
    await render();

    await act(async () => {
      capturedHandler!({ eventType: 'DELETE', new: {} });
    });
    expect(qc.getQueryData(queryKeys.onboarding.state)).toBeNull();

    const freshStart = makeRow({
      current_step: 0,
      updated_at: new Date(Date.now() + 500).toISOString(),
      created_at: new Date(Date.now() + 500).toISOString(),
      data: {},
    });

    await act(async () => {
      capturedHandler!({ eventType: 'INSERT', new: freshStart });
    });

    const cached = qc.getQueryData<OnboardingState | null>(queryKeys.onboarding.state);
    expect(cached?.current_step).toBe(0);
    expect(cached?.data).toEqual({});
  });
});
