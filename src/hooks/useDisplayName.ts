import { useAuth } from '@/hooks/useAuth';

// Preferred short name for greetings/bubbles: nickname → first name → email local-part.
export function useDisplayName(fallback: string): string;
export function useDisplayName(fallback?: string): string | undefined;
export function useDisplayName(fallback?: string): string | undefined {
  const { user } = useAuth();
  return user?.nickname || user?.name?.split(' ')[0] || user?.email?.split('@')[0] || fallback;
}
