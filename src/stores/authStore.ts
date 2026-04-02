import { create } from 'zustand';
import { identify, resetIdentity, track } from '@/lib/analytics';
import { supabase } from '@/lib/supabase';
import { Sentry } from '@/lib/sentry';

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
  // Extract role and status from JWT app_metadata claims
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

function identifyUser(user: AppUser) {
  identify(user.id, { email: user.email, name: user.name, role: user.role });
  Sentry.setUser({ id: user.id, email: user.email });
}

function clearUserIdentity() {
  resetIdentity();
  Sentry.setUser(null);
}

export interface AuthState {
  user: AppUser | null;
  loading: boolean;
  _unsubscribe: (() => void) | null;
  initialize: () => void;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: true,
  _unsubscribe: null,

  initialize: () => {
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (session?.user) {
          const user = mapUser(session.user);
          set({ user });
          identifyUser(user);
        }
        set({ loading: false });
      })
      .catch(() => set({ loading: false }));
    if (!get()._unsubscribe) {
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, session) => {
        if (session?.user) {
          set({ user: mapUser(session.user) });
        } else {
          set({ user: null });
        }
      });

      set({ _unsubscribe: () => subscription.unsubscribe() });
    }
  },

  signUp: async (email, password) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: email.split('@')[0],
        },
      },
    });

    if (error) return { error: friendlyError(error) };

    if (data?.user) {
      const user = mapUser(data.user);
      set({ user });
      identifyUser(user);
      track('Sign Up', { method: 'email' });
    }
    return { error: null };
  },

  signIn: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) return { error: friendlyError(error) };

    if (data?.user) {
      const user = mapUser(data.user);
      set({ user });
      identifyUser(user);
      track('Sign In', { method: 'email' });
    }
    return { error: null };
  },

  signOut: async () => {
    await supabase.auth.signOut();
    track('Sign Out');
    clearUserIdentity();
    set({ user: null });
  },

  signInWithGoogle: async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/auth/callback',
      },
    });
    return { error: error ? friendlyError(error) : null };
  },
}));
