import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isSessionExpiredPending, useAuthStore } from '@/stores/authStore';

const { getSessionMock, onAuthStateChangeMock, signOutMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  onAuthStateChangeMock: vi.fn(),
  signOutMock: vi.fn(),
}));

vi.mock('@/analytics', () => ({ track: vi.fn(), identify: vi.fn(), resetIdentity: vi.fn() }));
vi.mock('@/lib/sentry', () => ({
  Sentry: { setUser: vi.fn(), captureMessage: vi.fn(), captureException: vi.fn() },
}));
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => false, getPlatform: () => 'web' },
}));
vi.mock('@/lib/query', () => ({ queryClient: { clear: vi.fn() } }));
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: getSessionMock,
      onAuthStateChange: onAuthStateChangeMock,
      signOut: signOutMock,
    },
  },
  sessionReady: Promise.resolve(),
}));

type Handler = (event: string, session: { user: Record<string, unknown> } | null) => void;
let handler: Handler | null = null;
const session = { user: { id: 'u1', email: 'a@b.com', app_metadata: {}, user_metadata: {} } };

beforeEach(() => {
  getSessionMock.mockResolvedValue({ data: { session: null } });
  signOutMock.mockResolvedValue({ error: null });
  onAuthStateChangeMock.mockImplementation((h: Handler) => {
    handler = h;
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  });
  useAuthStore.setState({ user: null, _unsubscribe: null, isRecoveryMode: false });
  useAuthStore.getState().initialize();
});

afterEach(() => {
  handler = null;
});

describe('session-expired detection', () => {
  it('involuntary logout (had user, not intentional) flags expiry', () => {
    handler!('SIGNED_IN', session);
    handler!('SIGNED_OUT', null);
    expect(isSessionExpiredPending()).toBe(true);
  });

  it('peek is stable (not cleared on read) until next sign-in', () => {
    handler!('SIGNED_IN', session);
    handler!('SIGNED_OUT', null);
    expect(isSessionExpiredPending()).toBe(true);
    expect(isSessionExpiredPending()).toBe(true);
    handler!('SIGNED_IN', session);
    expect(isSessionExpiredPending()).toBe(false);
  });

  it('manual signOut does NOT flag expiry', async () => {
    handler!('SIGNED_IN', session);
    await useAuthStore.getState().signOut();
    handler!('SIGNED_OUT', null);
    expect(isSessionExpiredPending()).toBe(false);
  });

  it('app-start with no prior user does NOT flag expiry', () => {
    handler!('INITIAL_SESSION', null);
    expect(isSessionExpiredPending()).toBe(false);
  });
});
