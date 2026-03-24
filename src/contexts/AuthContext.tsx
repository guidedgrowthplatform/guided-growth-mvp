import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { authClient } from '@/lib/auth-client';
import { AuthContext, type AuthUser } from './authContextDef';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<{ token: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authClient
      .getSession()
      .then(({ data }) => {
        if (data?.user) {
          setUser(data.user as unknown as AuthUser);
          setSession({ token: data.session?.token || '' });
        }
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { data, error } = await authClient.signUp.email({
      email,
      password,
      name: email.split('@')[0],
    });
    if (error) return { error: error.message ?? 'Sign up failed' };

    if (data?.user) {
      setUser(data.user as unknown as AuthUser);
      setSession({ token: (data as { token?: string }).token || '' });
    } else {
      const { data: sessionData } = await authClient.getSession();
      if (sessionData?.user) {
        setUser(sessionData.user as unknown as AuthUser);
        setSession({ token: sessionData.session?.token || '' });
      }
    }
    return { error: null };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await authClient.signIn.email({ email, password });
    if (error) return { error: error.message ?? 'Sign in failed' };

    if (data?.user) {
      setUser(data.user as unknown as AuthUser);
      setSession({ token: (data as { token?: string }).token || '' });
    } else {
      // Fallback: fetch session if signIn response didn't include user
      const { data: sessionData } = await authClient.getSession();
      if (sessionData?.user) {
        setUser(sessionData.user as unknown as AuthUser);
        setSession({ token: sessionData.session?.token || '' });
      }
    }
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    await authClient.signOut();
    setUser(null);
    setSession(null);
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const { error } = await authClient.signIn.social({
      provider: 'google',
      callbackURL: window.location.origin,
    });
    if (error) return { error: error.message ?? 'Google sign-in failed' };
    return { error: null };
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, session, loading, signUp, signIn, signOut, signInWithGoogle }}
    >
      {children}
    </AuthContext.Provider>
  );
}
