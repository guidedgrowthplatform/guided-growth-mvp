// Supabase client singleton
// Uses VITE_ prefix for Vite env var exposure to client

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[Supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — falling back to mock data service',
  );
}

export const supabase: SupabaseClient = createClient(
  supabaseUrl || 'https://noop.supabase.co',
  supabaseAnonKey || 'noop',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  },
);
