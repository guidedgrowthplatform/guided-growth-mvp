import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/stores/authStore';

const { trackMock, identifyMock, resetIdentityMock, getSessionMock, onAuthStateChangeMock } =
  vi.hoisted(() => ({
    trackMock: vi.fn(),
    identifyMock: vi.fn(),
    resetIdentityMock: vi.fn(),
    getSessionMock: vi.fn(),
    onAuthStateChangeMock: vi.fn(),
  }));

vi.mock('@/analytics', () => ({
  track: trackMock,
  identify: identifyMock,
  resetIdentity: resetIdentityMock,
}));

vi.mock('@/lib/sentry', () => ({
  Sentry: { setUser: vi.fn() },
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => false, getPlatform: () => 'web' },
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: getSessionMock,
      onAuthStateChange: onAuthStateChangeMock,
    },
  },
  sessionReady: Promise.resolve(),
}));

interface AuthChangeHandler {
  (event: string, session: { user: Record<string, unknown> } | null): void;
}

let capturedHandler: AuthChangeHandler | null = null;

beforeEach(() => {
  trackMock.mockReset();
  identifyMock.mockReset();
  resetIdentityMock.mockReset();
  getSessionMock.mockReset();
  onAuthStateChangeMock.mockReset();

  getSessionMock.mockResolvedValue({ data: { session: null } });
  onAuthStateChangeMock.mockImplementation((handler: AuthChangeHandler) => {
    capturedHandler = handler;
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  });

  // Reset store between tests so the _unsubscribe gate doesn't block re-init.
  useAuthStore.setState({ user: null, _unsubscribe: null, isRecoveryMode: false });
  useAuthStore.getState().initialize();
});

afterEach(() => {
  capturedHandler = null;
});

function googleSession(opts: { createdAt: string; lastSignInAt: string; userId?: string }) {
  return {
    user: {
      id: opts.userId ?? 'user-google-1',
      email: 'sarah@example.com',
      app_metadata: { provider: 'google' },
      user_metadata: { full_name: 'Sarah' },
      created_at: opts.createdAt,
      last_sign_in_at: opts.lastSignInAt,
    },
  };
}

function emailSession(opts: { createdAt: string; lastSignInAt: string; userId?: string }) {
  return {
    user: {
      id: opts.userId ?? 'user-email-1',
      email: 'sarah@example.com',
      app_metadata: { provider: 'email' },
      user_metadata: { full_name: 'Sarah' },
      created_at: opts.createdAt,
      last_sign_in_at: opts.lastSignInAt,
    },
  };
}

describe('OAuth complete events via onAuthStateChange', () => {
  it("fires complete_signup with method='google' on first OAuth sign-in (created≈signed-in)", () => {
    const now = new Date('2026-04-29T10:00:00Z').toISOString();
    capturedHandler!('SIGNED_IN', googleSession({ createdAt: now, lastSignInAt: now }));

    expect(trackMock).toHaveBeenCalledWith(
      'complete_signup',
      { method: 'google' },
      { send_instantly: true },
    );
  });

  it("fires complete_login with method='google' for returning OAuth user (>60s gap)", () => {
    const created = new Date('2026-04-01T10:00:00Z').toISOString();
    const signedIn = new Date('2026-04-29T10:00:00Z').toISOString();
    capturedHandler!('SIGNED_IN', googleSession({ createdAt: created, lastSignInAt: signedIn }));

    expect(trackMock).toHaveBeenCalledWith(
      'complete_login',
      { method: 'google', is_returning_user: true },
      { send_instantly: true },
    );
  });

  it('does NOT fire complete_signup/complete_login from this listener for email provider', () => {
    // Email signup/signin fire these explicitly from signUp()/signIn() —
    // the listener must NOT double-count.
    const now = new Date('2026-04-29T10:00:00Z').toISOString();
    capturedHandler!('SIGNED_IN', emailSession({ createdAt: now, lastSignInAt: now }));

    expect(trackMock).not.toHaveBeenCalledWith(
      'complete_signup',
      expect.anything(),
      expect.anything(),
    );
    expect(trackMock).not.toHaveBeenCalledWith(
      'complete_login',
      expect.anything(),
      expect.anything(),
    );
  });

  it('does NOT re-fire on token refresh for the same user', () => {
    const created = new Date('2026-04-01T10:00:00Z').toISOString();
    const signedIn = new Date('2026-04-29T10:00:00Z').toISOString();
    const session = googleSession({ createdAt: created, lastSignInAt: signedIn, userId: 'u-1' });

    capturedHandler!('SIGNED_IN', session);
    expect(trackMock).toHaveBeenCalledTimes(1);

    // TOKEN_REFRESHED with same user — should be a no-op for analytics.
    trackMock.mockClear();
    capturedHandler!('TOKEN_REFRESHED', session);
    expect(trackMock).not.toHaveBeenCalled();
  });

  it('handles missing app_metadata.provider gracefully (defaults to email — no fire)', () => {
    const now = new Date('2026-04-29T10:00:00Z').toISOString();
    capturedHandler!('SIGNED_IN', {
      user: {
        id: 'user-no-provider',
        email: 'x@example.com',
        app_metadata: {},
        user_metadata: {},
        created_at: now,
        last_sign_in_at: now,
      },
    });

    expect(trackMock).not.toHaveBeenCalledWith(
      'complete_signup',
      expect.anything(),
      expect.anything(),
    );
  });
});
