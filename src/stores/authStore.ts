import { Capacitor } from '@capacitor/core';
import { create } from 'zustand';
import { identify, resetIdentity, track } from '@/analytics';
import { clearPkceVerifier } from '@/lib/clearPkceVerifier';
import { getWebOrigin } from '@/lib/env';
import { SETTINGS_STORAGE_KEY } from '@/lib/preferences/snapshot';
import { queryClient } from '@/lib/query';
import { Sentry } from '@/lib/sentry';
import { supabase } from '@/lib/supabase';

export interface AppUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  nickname: string | null;
  role: string;
  status: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapUser(u: any): AppUser {
  const claims = u.app_metadata as { role?: string; status?: string };
  return {
    id: u.id,
    email: u.email,
    name: u.user_metadata?.full_name ?? null,
    image: u.user_metadata?.avatar_url ?? null,
    nickname: u.user_metadata?.nickname ?? null,
    role: claims.role ?? 'user',
    status: claims.status ?? 'active',
  };
}

function decodeJwtClaims(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

async function fetchAnonId(): Promise<string | null> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) return null;
    const claims = decodeJwtClaims(session.access_token);
    const anonId = typeof claims?.anon_id === 'string' ? claims.anon_id : null;
    if (!anonId) {
      Sentry.captureMessage('analytics_identify_failed', {
        level: 'warning',
        extra: { reason: 'missing_anon_id_claim' },
      });
    }
    return anonId;
  } catch (err) {
    Sentry.captureMessage('analytics_identify_failed', {
      level: 'warning',
      extra: { error: err instanceof Error ? err.message : String(err) },
    });
    return null;
  }
}

const ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Incorrect email or password',
  user_already_exists: 'An account with this email already exists',
  weak_password: 'Password must be at least 8 characters',
  invalid_email_or_password: 'Incorrect email or password',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function friendlyError(error: any): string {
  if (!error) return 'Something went wrong. Please try again.';
  const message = error.message?.toLowerCase?.() || error.code?.toLowerCase?.() || '';
  for (const [key, value] of Object.entries(ERROR_MESSAGES)) {
    if (message.includes(key.toLowerCase())) {
      return value;
    }
  }
  return error.message || 'Something went wrong. Please try again.';
}

// PostHog spec v6.0 §3.1: signup_error/login_error use `error_type` as a
// short category (not the raw message). Map common Supabase auth error
// strings to a stable enum so PostHog dashboards can group cleanly.
const ERROR_TYPE_PATTERNS: Array<[string, string]> = [
  ['invalid_credentials', 'invalid_credentials'],
  ['invalid login', 'invalid_credentials'],
  ['user_already_exists', 'user_exists'],
  ['already registered', 'user_exists'],
  ['weak_password', 'weak_password'],
  ['rate limit', 'rate_limited'],
  ['network', 'network_error'],
  ['email_not_confirmed', 'email_not_confirmed'],
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function categorizeAuthError(error: any): string {
  if (!error) return 'unknown';
  const msg = error.message?.toLowerCase?.() || error.code?.toLowerCase?.() || '';
  for (const [pattern, category] of ERROR_TYPE_PATTERNS) {
    if (msg.includes(pattern)) return category;
  }
  return 'other';
}

function identifyUser(
  user: AppUser,
  cachedAnonId: string | null,
  setAnonId: (id: string | null) => void,
) {
  const callIdentify = (anonId: string) => {
    const traits = {
      role: user.role,
      status: user.status,
      platform: Capacitor.getPlatform(),
      app_version: (import.meta.env.VITE_APP_VERSION as string | undefined) ?? 'unknown',
    };
    identify(anonId, traits);
    Sentry.setUser({ id: anonId });
  };

  if (cachedAnonId) {
    callIdentify(cachedAnonId);
    return;
  }

  void fetchAnonId().then((anonId) => {
    if (!anonId) return;
    setAnonId(anonId);
    callIdentify(anonId);
  });
}

function clearUserIdentity(setAnonId: (id: string | null) => void) {
  resetIdentity();
  Sentry.setUser(null);
  setAnonId(null);
}

export interface AuthState {
  user: AppUser | null;
  anonId: string | null;
  loading: boolean;
  isRecoveryMode: boolean;
  _unsubscribe: (() => void) | null;
  initialize: () => void;
  signUp: (
    email: string,
    password: string,
  ) => Promise<{ error: string | null; confirmationPending?: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  updateProfile: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => {
  const setAnonId = (anonId: string | null) => set({ anonId });
  return {
    user: null,
    anonId: null,
    loading: true,
    isRecoveryMode: false,
    _unsubscribe: null,

    initialize: () => {
      supabase.auth
        .getSession()
        .then(({ data: { session } }) => {
          if (session?.user) {
            const user = mapUser(session.user);
            set({ user });
            identifyUser(user, get().anonId, setAnonId);
          }
          set({ loading: false });
        })
        .catch(() => set({ loading: false }));
      if (!get()._unsubscribe) {
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
          if (event === 'PASSWORD_RECOVERY') {
            set({ isRecoveryMode: true });
          }
          if (session?.user) {
            const nextUser = mapUser(session.user);
            const prevUser = get().user;
            set({ user: nextUser });
            // Re-identify only when the user actually changed (login,
            // account switch, token refresh that surfaces a different
            // user). Token refreshes for the same user don't need to
            // re-fire analytics events.
            //
            // Previously this listener updated user state but never
            // called identifyUser/clearUserIdentity, so Sentry and
            // analytics stayed tagged with the previous user across
            // sign-out, account switches, and sessions restored from
            // another tab.
            if (prevUser?.id !== nextUser.id) {
              const prevAnonId = prevUser ? null : get().anonId;
              identifyUser(nextUser, prevAnonId, setAnonId);
              // PostHog spec v6.0 §3.1: complete_signup / complete_login.
              // Email signup/signin already fire these from the dedicated
              // store actions; OAuth (Google/Apple) lands here via redirect
              // callback and was previously silent. Skip 'email' to avoid
              // double-counting; treat any non-email provider as OAuth.
              //
              // Gate on event === 'SIGNED_IN' so INITIAL_SESSION (restored
              // session on page reload), USER_UPDATED, and TOKEN_REFRESHED
              // can't double-fire the funnel events.
              const provider =
                (session.user.app_metadata as { provider?: string } | null)?.provider ?? 'email';
              if (event === 'SIGNED_IN' && provider !== 'email') {
                const createdAtMs = session.user.created_at
                  ? new Date(session.user.created_at).getTime()
                  : 0;
                const lastSignInMs = session.user.last_sign_in_at
                  ? new Date(session.user.last_sign_in_at).getTime()
                  : Date.now();
                // <60s gap between account creation and this sign-in means
                // we're inside the first OAuth round-trip — count as signup.
                // Same threshold as the email-flow heuristic in signIn(),
                // with is_returning_user computed via the same expression
                // (>60s gap) so missing created_at behaves identically.
                const gapMs = lastSignInMs - createdAtMs;
                const isFirstSignIn = createdAtMs > 0 && gapMs < 60_000;
                const isReturningUser = createdAtMs > 0 && gapMs > 60_000;
                if (isFirstSignIn) {
                  track('complete_signup', { method: provider }, { send_instantly: true });
                } else {
                  track(
                    'complete_login',
                    { method: provider, is_returning_user: isReturningUser },
                    { send_instantly: true },
                  );
                }
              }
            }
          } else {
            if (get().user) {
              clearUserIdentity(setAnonId);
            }
            set({ user: null });
          }
        });

        set({ _unsubscribe: () => subscription.unsubscribe() });
      }
    },

    signUp: async (email, password) => {
      track('start_signup', { method: 'email' });
      const startedAt = Date.now();
      const emailRedirectTo = `${getWebOrigin()}/auth/callback?type=signup`;

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo,
          data: {
            full_name: email.split('@')[0],
          },
        },
      });

      if (error) {
        track('signup_error', {
          method: 'email',
          error_type: categorizeAuthError(error),
        });
        return { error: friendlyError(error) };
      }

      // Reject auto-confirmed sessions — product flow requires email verification.
      // Revert synchronously before awaiting signOut so AppGate can't redirect mid-flow.
      if (data.session) {
        set({ user: null });
        await supabase.auth.signOut({ scope: 'global' });
        await clearPkceVerifier();
        track('signup_error', {
          method: 'email',
          error_type: 'auto_confirm_misconfigured',
        });
        return {
          error:
            'Email verification is not configured for this environment. Please contact support.',
        };
      }

      // send_instantly skips the batched queue — otherwise the event races
      // with post-auth navigation and is dropped before flush.
      track(
        'complete_signup',
        {
          method: 'email',
          time_to_complete_seconds: Math.round((Date.now() - startedAt) / 1000),
        },
        { send_instantly: true },
      );

      return { error: null, confirmationPending: true };
    },

    signIn: async (email, password) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        track('login_error', { method: 'email', error_type: categorizeAuthError(error) });
        return { error: friendlyError(error) };
      }

      if (data?.user) {
        const user = mapUser(data.user);
        set({ user });
        identifyUser(user, get().anonId, setAnonId);
        // is_returning_user per spec v6.0 §3.1 — derived from the gap between
        // account creation and this sign-in. >60s gap = not the immediate post-signup
        // auto-login (which fires ~instantly after complete_signup), so it's a real
        // returning user. <60s = same session as signup, treat as first login.
        const createdAtMs = data.user.created_at ? new Date(data.user.created_at).getTime() : 0;
        const lastSignInMs = data.user.last_sign_in_at
          ? new Date(data.user.last_sign_in_at).getTime()
          : Date.now();
        const isReturningUser = createdAtMs > 0 && lastSignInMs - createdAtMs > 60_000;

        // send_instantly skips the batched queue — without it the event
        // races with post-auth navigation and gets dropped from the
        // localStorage-backed queue before flush.
        track(
          'complete_login',
          { method: 'email', is_returning_user: isReturningUser },
          { send_instantly: true },
        );
      }
      return { error: null };
    },

    signOut: async () => {
      await supabase.auth.signOut({ scope: 'global' });
      queryClient.clear();
      localStorage.removeItem(SETTINGS_STORAGE_KEY);
      clearUserIdentity(setAnonId);
      set({ user: null });
    },

    updateProfile: async () => {
      const { data } = await supabase.auth.refreshSession();
      if (data.session?.user) {
        set({ user: mapUser(data.session.user) });
      }
    },

    signInWithGoogle: async () => {
      const isNative = Capacitor.isNativePlatform();
      const redirectTo = isNative
        ? 'guidedgrowth://auth/callback'
        : `${getWebOrigin()}/auth/callback`;

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: isNative,
        },
      });

      if (error) return { error: friendlyError(error) };

      if (isNative && data?.url) {
        const { Browser } = await import('@capacitor/browser');
        await Browser.open({ url: data.url });
      }

      return { error: null };
    },

    resetPassword: async (email) => {
      const redirectTo = `${getWebOrigin()}/auth/callback?type=recovery`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) return { error: friendlyError(error) };
      return { error: null };
    },

    updatePassword: async (password) => {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) return { error: friendlyError(error) };

      // Invalidate the recovery session — user must re-login with new password
      await supabase.auth.signOut();
      clearUserIdentity(setAnonId);
      set({ user: null, isRecoveryMode: false });
      return { error: null };
    },
  };
});
