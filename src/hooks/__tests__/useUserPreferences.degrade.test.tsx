/** @vitest-environment jsdom */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * The remote preferences write must be NON-FATAL: when the upsert rejects
 * (RLS reject, invalid identity, offline), updatePreferences resolves and the
 * chosen values stay applied locally, the same contract as signed-out,
 * instead of surfacing an uncaught rejection that wedges the awaiting beat
 * (the mic-allow spinner).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadLocalPreferences } from '@/lib/preferences/snapshot';
import { queryKeys } from '@/lib/query';
import { useUserPreferences, type UserPreferences } from '../useUserPreferences';

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('@/hooks/useSessionLog', () => ({
  useSessionLog: () => ({ logEvent: vi.fn() }),
}));

vi.mock('@/lib/localReminders', () => ({
  rescheduleFromPrefs: vi.fn(() => Promise.resolve()),
}));

const upsertPreferences = vi.fn();
vi.mock('@/lib/services/supabase-data-service', () => ({
  supabaseDataService: {
    getPreferences: vi.fn(() => Promise.resolve(null)),
    upsertPreferences: (...args: unknown[]) => upsertPreferences(...args),
  },
}));

let container: HTMLDivElement;
let root: Root;
let qc: QueryClient;
let hook: ReturnType<typeof useUserPreferences> | null = null;

function Probe() {
  hook = useUserPreferences();
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
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  upsertPreferences.mockReset();
  qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  hook = null;
  localStorage.clear();
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  vi.restoreAllMocks();
});

describe('useUserPreferences remote-failure degrade', () => {
  it('a rejected upsert resolves (no throw) and keeps the values local-only', async () => {
    upsertPreferences.mockRejectedValue(
      new Error('invalid input syntax for type uuid: "preview-b17e5b05"'),
    );
    await render();

    // The mic beat's exact shape: `await updatePreferences(...)`, this must
    // NOT reject (a rejection wedged the beat on its spinner).
    await act(async () => {
      await expect(
        hook!.updatePreferences({ micPermission: true, micEnabled: true }),
      ).resolves.toBeUndefined();
    });

    // The user's choice stuck locally: cache and persisted snapshot.
    const cached = qc.getQueryData<UserPreferences>(queryKeys.preferences.all);
    expect(cached?.micPermission).toBe(true);
    expect(cached?.micEnabled).toBe(true);
    expect(loadLocalPreferences().micPermission).toBe(true);
  });

  it('a successful upsert still round-trips the server row (unchanged happy path)', async () => {
    upsertPreferences.mockResolvedValue({ mic_permission: true, mic_enabled: true });
    await render();

    await act(async () => {
      await hook!.updatePreferences({ micPermission: true, micEnabled: true });
    });

    expect(upsertPreferences).toHaveBeenCalledWith({ mic_permission: true, mic_enabled: true });
    const cached = qc.getQueryData<UserPreferences>(queryKeys.preferences.all);
    expect(cached?.micPermission).toBe(true);
  });
});
