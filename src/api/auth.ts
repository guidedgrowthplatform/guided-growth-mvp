import { supabase } from '@/lib/supabase';

export async function logout(): Promise<void> {
  await supabase.auth.signOut();
  window.location.href = '/login';
}
