// Supabase client singleton
// Uses VITE_ prefix for Vite env var exposure to client
// On native (Capacitor), uses @capacitor/preferences for reliable session persistence

import { Capacitor } from '@capacitor/core';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[Supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — falling back to mock data service',
  );
}

// Build a synchronous storage adapter that delegates to @capacitor/preferences.
// The adapter methods return Promises, which Supabase v2 supports.
function createNativeStorage() {
  // We import Preferences eagerly at module load on native platforms.
  // The import is cached after the first call, so subsequent calls are synchronous.
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
      autoRefreshToken: true,
      persistSession: true,
      // On native, don't scan the URL for tokens — the URL is capacitor://localhost
      detectSessionInUrl: !isNative,
      // On native, use Capacitor Preferences (iOS UserDefaults) instead of localStorage
      ...(isNative ? { storage: createNativeStorage() } : {}),
    },
  },
);

// Resolves when the initial session has been restored from storage
let resolveSessionReady: () => void;
export const sessionReady: Promise<void> = new Promise((resolve) => {
  resolveSessionReady = resolve;
});
supabase.auth
  .getSession()
  .then(() => resolveSessionReady())
  .catch(() => resolveSessionReady());
