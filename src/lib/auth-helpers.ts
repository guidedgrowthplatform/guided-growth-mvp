import { authClient } from './auth-client';

/**
 * Get the current authenticated user's ID from Better Auth session.
 * Used by data services that need user_id for database operations.
 */
export async function getCurrentUserId(): Promise<string> {
  const { data } = await authClient.getSession();
  if (!data?.user?.id) {
    throw new Error('Not authenticated');
  }
  return data.user.id;
}
