import { useState, useEffect, type ReactNode, useCallback } from 'react';
import { authClient } from '@/lib/auth-client';
import { AuthContext, type AuthUser, type AuthSession } from './authContextDef';

/** Fetch the user's role from our app's users table via /api/auth/me */
async function fetchUserRole(): Promise<string | undefined> {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (!res.ok) return undefined;
    const data = await res.json();
    return data.role ?? undefined;
  } catch {
    return undefined;
  }
}

interface BetterAuthUser {
  id: string;
  email: string;
  name: string;
  image?: string | null;
  emailVerified: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
}

interface BetterAuthSession {
  token: string;
  userId: string;
  expiresAt: string | Date;
}

function toAuthUser(u: BetterAuthUser, role?: string): AuthUser {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    image: u.image ?? null,
    emailVerified: u.emailVerified,
    createdAt: new Date(u.createdAt),
    updatedAt: new Date(u.updatedAt),
    role,
  };
}

function toAuthSession(s: BetterAuthSession): AuthSession {
  return {
    token: s.token,
    userId: s.userId,
    expiresAt: new Date(s.expiresAt),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch session on mount
  useEffect(() => {
    let mounted = true;

    const fetchSession = async () => {
      try {
        const { data, error } = await authClient.getSession();
        if (!mounted) return;

        if (error || !data?.session || !data?.user) {
          setUser(null);
          setSession(null);
        } else {
          const role = await fetchUserRole();
          if (!mounted) return;
          setUser(toAuthUser(data.user, role));
          setSession(toAuthSession(data.session));
        }
      } catch {
        if (mounted) {
          setUser(null);
          setSession(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchSession();
    return () => {
      mounted = false;
    };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    try {
      const { error } = await authClient.signUp.email({
        email,
        password,
        name: email.split('@')[0], // Default name from email
      });
      if (error) {
        return { error: error.message ?? 'Sign up failed' };
      }

      // Fetch session after successful signup (autoSignIn is enabled)
      const { data } = await authClient.getSession();
      if (data?.user && data?.session) {
        const role = await fetchUserRole();
        setUser(toAuthUser(data.user, role));
        setSession(toAuthSession(data.session));
      }

      return { error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sign up failed';
      return { error: message };
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { error } = await authClient.signIn.email({
        email,
        password,
      });
      if (error) {
        return { error: error.message ?? 'Sign in failed' };
      }

      // Fetch fresh session after successful sign-in
      const { data: sessionData } = await authClient.getSession();
      if (sessionData?.user && sessionData?.session) {
        const role = await fetchUserRole();
        setUser(toAuthUser(sessionData.user, role));
        setSession(toAuthSession(sessionData.session));
      }
      return { error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sign in failed';
      return { error: message };
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await authClient.signOut();
    } finally {
      setUser(null);
      setSession(null);
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    try {
      await authClient.signIn.social({
        provider: 'google',
        callbackURL: window.location.origin,
      });
      return { error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Google sign in failed';
      return { error: message };
    }
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-primary-bg">
        <div className="text-center">
          <div className="mb-2 animate-pulse text-2xl font-bold text-primary">Guided Growth</div>
          <div className="text-sm text-content-secondary">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{ user, session, loading, signUp, signIn, signOut, signInWithGoogle }}
    >
      {children}
    </AuthContext.Provider>
  );
}
