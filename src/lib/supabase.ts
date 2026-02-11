import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function signInWithGoogle() {
  // Use localhost for local dev, Vercel URL for production
  const redirectTo = import.meta.env.DEV 
    ? `${window.location.origin}/auth/callback`
    : 'https://guided-growth-mvp.vercel.app/auth/callback';

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
    },
  });

  if (error) throw error;
  return data;
}

