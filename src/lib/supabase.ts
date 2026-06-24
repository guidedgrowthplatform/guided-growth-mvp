import { Capacitor } from '@capacitor/core';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { setSession } from '@/lib/auth/tokenStore';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[Supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — falling back to mock data service',
  );
}

function createNativeStorage() {
  let _prefs: (typeof import('@capacitor/preferences'))['Preferences'] | null = null;
  const prefsReady = import('@capacitor/preferences').then((m) => {
    _prefs = m.Preferences;
  });

  return {
    getItem: async (key: string): Promise<string | null> => {
      if (!_prefs) await prefsReady;
      const { value } = await _prefs!.get({ key });
      return value;
    },
    setItem: async (key: string, value: string): Promise<void> => {
      if (!_prefs) await prefsReady;
      await _prefs!.set({ key, value });
    },
    removeItem: async (key: string): Promise<void> => {
      if (!_prefs) await prefsReady;
      await _prefs!.remove({ key });
    },
  };
}

const isNative = Capacitor.isNativePlatform();

export const supabase: SupabaseClient = createClient(
  supabaseUrl || 'https://noop.supabase.co',
  supabaseAnonKey || 'noop',
  {
    auth: {
      flowType: 'pkce',
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: !isNative,
      ...(isNative ? { storage: createNativeStorage() } : {}),
    },
  },
);

// Single writer to tokenStore + the only realtime.setAuth caller.
supabase.auth.onAuthStateChange((_event, session) => {
  setSession(session);
  void supabase.realtime.setAuth(session?.access_token ?? null);
});

let resolveSessionReady: () => void;
export const sessionReady: Promise<void> = new Promise((resolve) => {
  resolveSessionReady = resolve;
});
supabase.auth
  .getSession()
  .then(({ data: { session } }) => {
    // warm before the async INITIAL_SESSION so the first request has a token
    setSession(session);
    void supabase.realtime.setAuth(session?.access_token ?? null);
    resolveSessionReady();
  })
  .catch(() => resolveSessionReady());

// Dev-only: expose the client on window for quick console debugging
// (e.g. supabase.getChannels()). Stripped from prod bundles.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as { supabase: SupabaseClient }).supabase = supabase;
}
