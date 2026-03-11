import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
// import { supabase } from '@/lib/supabase';
import type { User as SupabaseUser, Session } from '@supabase/supabase-js';

// ============================================================
// 🚧 AUTH BYPASS — TEST USER MODE
// Remove this block and uncomment Supabase code below to
// restore real authentication.
// ============================================================
const TEST_USER = {
  id: 'test-user-001',
  email: 'testuser@guidedgrowth.app',
  user_metadata: { full_name: 'Test User' },
  app_metadata: {},
  aud: 'authenticated',
  role: 'authenticated',
  created_at: new Date().toISOString(),
} as unknown as SupabaseUser;

interface AuthContextValue {
  user: SupabaseUser | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // 🚧 TEST MODE: skip Supabase, use hardcoded test user
  const [user] = useState<SupabaseUser | null>(TEST_USER);
  const [session] = useState<Session | null>(null);
  const [loading] = useState(false);

  const signUp = async (_email: string, _password: string) => {
    return { error: null };
  };

  const signIn = async (_email: string, _password: string) => {
    return { error: null };
  };

  const signOut = async () => {
    console.log('[Auth] signOut called (test mode — no-op)');
  };

  /* ==========================================================
   * REAL SUPABASE AUTH — uncomment this block to restore
   * ==========================================================
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error?.message ?? null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-cyan-50 to-blue-100">
        <div className="text-center">
          <div className="text-2xl font-bold text-cyan-600 mb-2 animate-pulse">Guided Growth</div>
          <div className="text-sm text-slate-500">Loading...</div>
        </div>
      </div>
    );
  }
  ========================================================== */

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
