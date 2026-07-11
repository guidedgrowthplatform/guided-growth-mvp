import { Capacitor } from '@capacitor/core';
import { create } from 'zustand';
import { identify, resetIdentity, track } from '@/analytics';
import { markCalendarConnectPending } from '@/api/calendar';
import { authScheme } from '@/lib/appVariant';
import { setAuthReturnTo } from '@/lib/auth/authHandoff';
import { clearPkceVerifier } from '@/lib/clearPkceVerifier';
import { getWebOrigin } from '@/lib/env';
import { SETTINGS_STORAGE_KEY } from '@/lib/preferences/snapshot';
import { queryClient } from '@/lib/query';
import { Sentry } from '@/lib/sentry';
import { supabase } from '@/lib/supabase';
import { decodeJwtPayload } from '@gg/shared/utils/jwt';

// set before each user-initiated signOut → lets the listener tell an involuntary
// expiry apart from a deliberate logout
let intentionalSignOut = false;
let sessionExpiredPending = false;

// peek (no clear-on-read) so React StrictMode's double-mount can't eat it;
// cleared on the next sign-in
export function isSessionExpiredPending(): boolean {
  return sessionExpiredPending;
}

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
    email: u.email ?? '',
    name: u.user_metadata?.full_name ?? null,
    image: u.user_metadata?.avatar_url ?? null,
    nickname: u.user_metadata?.nickname ?? null,
    role: claims.role ?? 'user',
    status: claims.status ?? 'active',
  };
}

// Resolves the anon_id every client read filters by. Callers pass the
// access token and user id they ALREADY resolved (initialize, onAuthStateChange,
// signIn, signInAsGuest all hold a fresh session). We deliberately do NOT call
// getSession() again here in the common path: a second concurrent getSession()
// contends for the auth-token Web Lock, and a "steal" can resolve it with no
// session (see Sentry "Lock broken ... 'steal'" on sb-...-auth-token). When that
// happened, anon_id stayed null, every client RLS read was disabled, and the home
// rendered empty (no habits, no journal) even though the data was intact
// server-side. Decoding the token the caller already has removes that race.
async function fetchAnonId(
  accessToken: string | null,
  userId: string | null,
): Promise<string | null> {
  try {
    // Prefer the token the caller resolved. Only fall back to getSession() if a
    // caller did not hand one in (defensive; current callers always do).
    let token = accessToken;
    if (!token) {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      token = session?.access_token ?? null;
    }
    if (!token) {
      Sentry.captureMessage('analytics_identify_no_session', {
        level: 'warning',
        extra: { reason: 'no_access_token_for_authenticated_user' },
      });
    }

    const claims = token ? decodeJwtPayload(token) : null;
    let anonId = typeof claims?.anon_id === 'string' ? claims.anon_id : null;

    // Recover from the profile when the claim is missing (a stale token minted
    // before the profile got its anon_id, or a token-hook hiccup) or when the
    // token could not be resolved at all. The profile row carries the canonical
    // anon_id and is self-readable by auth.uid() (RLS users_can_read_own_profile),
    // independent of the JWT claim and of whether getSession won the lock race.
    if (!anonId && userId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('anon_id')
        .eq('id', userId)
        .single();
      anonId = typeof profile?.anon_id === 'string' ? profile.anon_id : null;
      if (anonId) {
        Sentry.captureMessage('analytics_identify_recovered', {
          level: 'warning',
          extra: { reason: 'recovered_from_profile' },
        });
      }
    }

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
  accessToken: string | null,
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

  // Pass the token + user id the caller already resolved so fetchAnonId does not
  // make a second getSession() that would race the auth-token Web Lock.
  void fetchAnonId(accessToken, user.id).then((anonId) => {
    if (!anonId) return;
    setAnonId(anonId);
    callIdentify(anonId);
  });
}

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

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
  signInAsGuest: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  connectGoogleCalendar: () => Promise<{ error: string | null }>;
  signInWithApple: () => Promise<{ error: string | null }>;
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
            identifyUser(user, get().anonId, setAnonId, session.access_token);
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
            sessionExpiredPending = false; // signed back in → expiry notice no longer relevant
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
              identifyUser(nextUser, prevAnonId, setAnonId, session.access_token);
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
            const hadUser = get().user !== null;
            const wasIntentional = intentionalSignOut;
            intentionalSignOut = false;
            if (hadUser) clearUserIdentity(setAnonId);
            set({ user: null });
            // a real session lapse: we had a user and it wasn't a deliberate logout
            if (hadUser && !wasIntentional) sessionExpiredPending = true;
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
        intentionalSignOut = true;
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
        identifyUser(user, get().anonId, setAnonId, data.session?.access_token ?? null);
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

    signInAsGuest: async () => {
      track('start_signup', { method: 'guest' });
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) {
        track('signup_error', { method: 'guest', error_type: categorizeAuthError(error) });
        return { error: friendlyError(error) };
      }
      if (data?.user) {
        const user = mapUser(data.user);
        set({ user });
        identifyUser(user, get().anonId, setAnonId, data.session?.access_token ?? null);
        track('complete_signup', { method: 'guest' }, { send_instantly: true });
      }
      return { error: null };
    },

    signOut: async () => {
      intentionalSignOut = true;
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
        ? `${await authScheme()}://auth/callback`
        : `${getWebOrigin()}/auth/callback`;
      if (!isNative) setAuthReturnTo();

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

    // Separate calendar-authorization grant (NOT a login): its own consent with
    // the calendar scopes on a distinct ?intent=calendar callback that returns to Settings.
    connectGoogleCalendar: async () => {
      const isNative = Capacitor.isNativePlatform();
      const base = isNative
        ? `${await authScheme()}://auth/callback`
        : `${getWebOrigin()}/auth/callback`;
      const redirectTo = `${base}?intent=calendar`;
      // Fallback in case the query param doesn't survive the redirect round-trip.
      markCalendarConnectPending();

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: isNative,
          scopes:
            'https://www.googleapis.com/auth/calendar.app.created https://www.googleapis.com/auth/calendar.events',
          queryParams: { access_type: 'offline', prompt: 'consent' },
        },
      });

      if (error) return { error: friendlyError(error) };

      if (isNative && data?.url) {
        const { Browser } = await import('@capacitor/browser');
        await Browser.open({ url: data.url });
      }

      return { error: null };
    },

    signInWithApple: async () => {
      // iOS: native ASAuthorization sheet + signInWithIdToken — no browser
      // round-trip, the WebView never navigates away.
      if (Capacitor.getPlatform() === 'ios') {
        try {
          const { SignInWithApple } = await import('@capacitor-community/apple-sign-in');
          // Apple gets the SHA-256 hash; Supabase gets the raw nonce and
          // hashes it server-side to match the token's nonce claim.
          const rawNonce = toHex(crypto.getRandomValues(new Uint8Array(32)));
          const hashedNonce = toHex(
            new Uint8Array(
              await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawNonce)),
            ),
          );
          const { response } = await SignInWithApple.authorize({
            // clientId/redirectURI are required by the plugin's types but the
            // iOS implementation ignores them (token aud = bundle id).
            clientId: 'app.guidedgrowth.mvp',
            redirectURI: `${getWebOrigin()}/auth/callback`,
            scopes: 'name email',
            nonce: hashedNonce,
          });
          if (!response?.identityToken) return { error: null }; // treated as cancel
          const { data, error } = await supabase.auth.signInWithIdToken({
            provider: 'apple',
            token: response.identityToken,
            nonce: rawNonce,
          });
          if (error) return { error: friendlyError(error) };
          // Apple only returns the name on FIRST authorization and the id
          // token carries no name claim — persist it or it's gone.
          const fullName = [response.givenName, response.familyName]
            .filter(Boolean)
            .join(' ')
            .trim();
          if (fullName && !data.user?.user_metadata?.full_name) {
            void supabase.auth.updateUser({ data: { full_name: fullName } });
          }
          return { error: null };
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
          // ASAuthorizationError code 1001 = user canceled the sheet.
          const msg = String(err?.message ?? err);
          if (/cancel/i.test(msg) || /1001/.test(msg)) return { error: null };
          return { error: friendlyError(err) };
        }
      }

      // Web + Android: same OAuth round-trip shape as Google.
      const isNative = Capacitor.isNativePlatform();
      const redirectTo = isNative
        ? `${await authScheme()}://auth/callback`
        : `${getWebOrigin()}/auth/callback`;
      if (!isNative) setAuthReturnTo();

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
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
      intentionalSignOut = true;
      await supabase.auth.signOut();
      clearUserIdentity(setAnonId);
      set({ user: null, isRecoveryMode: false });
      return { error: null };
    },
  };
});
