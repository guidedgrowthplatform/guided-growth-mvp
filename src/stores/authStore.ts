import { create } from 'zustand';
import { fetchOnboardingState } from '@/api/onboarding';
import { authClient } from '@/lib/auth-client';
import { queryClient } from '@/lib/query';
import { queryKeys } from '@/lib/query/keys';

export interface AppUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: string;
  status: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapUser(u: any): AppUser {
  return {
    id: u.id,
    email: u.email,
    name: u.name ?? null,
    image: u.image ?? null,
    role: u.role ?? 'user',
    status: u.status ?? 'active',
  };
}

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: 'Incorrect email or password',
  FAILED_TO_CREATE_USER: 'Unable to create account',
  USER_ALREADY_EXISTS: 'An account with this email already exists',
  INVALID_PASSWORD: 'Password must be at least 8 characters',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function friendlyError(error: any): string {
  if (!error) return 'Something went wrong. Please try again.';
  const code = error.code || error.message;
  return ERROR_MESSAGES[code] || error.message || 'Something went wrong. Please try again.';
}

export interface AuthState {
  user: AppUser | null;
  loading: boolean;
  _pollInterval: ReturnType<typeof setInterval> | null;
  initialize: () => void;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: true,
  _pollInterval: null,

  initialize: () => {
    authClient
      .getSession()
      .then(({ data }) => {
        if (data?.user) {
          set({ user: mapUser(data.user) });
          queryClient.prefetchQuery({
            queryKey: queryKeys.onboarding.state,
            queryFn: fetchOnboardingState,
          });
        }
        set({ loading: false });
      })
      .catch(() => set({ loading: false }));

    // Session expiry poll
    if (!get()._pollInterval) {
      const interval = setInterval(
        async () => {
          try {
            const { data } = await authClient.getSession();
            if (!data?.user) set({ user: null });
          } catch {
            /* network error — keep current state */
          }
        },
        5 * 60 * 1000,
      );
      set({ _pollInterval: interval });
    }
  },

  signUp: async (email, password) => {
    const { data, error } = await authClient.signUp.email({
      email,
      password,
      name: email.split('@')[0],
    });
    if (error) return { error: friendlyError(error) };

    if (data?.user) {
      set({ user: mapUser(data.user) });
    } else {
      const { data: session } = await authClient.getSession();
      if (session?.user) set({ user: mapUser(session.user) });
    }
    queryClient.prefetchQuery({
      queryKey: queryKeys.onboarding.state,
      queryFn: fetchOnboardingState,
    });
    return { error: null };
  },

  signIn: async (email, password) => {
    const { data, error } = await authClient.signIn.email({ email, password });
    if (error) return { error: friendlyError(error) };

    if (data?.user) {
      set({ user: mapUser(data.user) });
    } else {
      const { data: session } = await authClient.getSession();
      if (session?.user) set({ user: mapUser(session.user) });
    }
    queryClient.prefetchQuery({
      queryKey: queryKeys.onboarding.state,
      queryFn: fetchOnboardingState,
    });
    return { error: null };
  },

  signOut: async () => {
    await authClient.signOut();
    set({ user: null });
  },

  signInWithGoogle: async () => {
    const { error } = await authClient.signIn.social({
      provider: 'google',
      callbackURL: window.location.origin,
    });
    return { error: error ? friendlyError(error) : null };
  },
}));
