import { supabase } from '@/lib/supabase';
import type { User } from '@shared/types';

export async function fetchCurrentUser(): Promise<User | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    return {
      id: user.id,
      email: user.email ?? '',
      name: user.user_metadata?.full_name ?? null,
    };
  } catch {
    return null;
  }
}

export function initiateGoogleLogin(): void {
  supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + '/auth/callback',
    },
  });
}

export async function logout(): Promise<void> {
  await supabase.auth.signOut();
  window.location.href = '/login';
}
