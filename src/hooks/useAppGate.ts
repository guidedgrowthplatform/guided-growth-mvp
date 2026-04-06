import { useQuery } from '@tanstack/react-query';
import * as onboardingApi from '@/api/onboarding';
import { useAuth } from '@/hooks/useAuth';
import { queryKeys } from '@/lib/query';

export type AppGateStatus =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'onboarding_needed' }
  | { status: 'onboarding_in_progress'; step: number; path: string | null }
  | { status: 'ready' }
  | { status: 'error'; retry: () => void };

export function useAppGate(): AppGateStatus {
  const { user, loading: authLoading } = useAuth();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.onboarding.state,
    queryFn: onboardingApi.fetchOnboardingState,
    enabled: !!user,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  });

  if (authLoading || (!!user && isLoading)) return { status: 'loading' };
  if (!user) return { status: 'unauthenticated' };
  if (isError) return { status: 'error', retry: refetch };
  if (!data) return { status: 'onboarding_needed' };
  if (data.status === 'in_progress') {
    return { status: 'onboarding_in_progress', step: data.current_step, path: data.path };
  }
  if (data.status === 'completed') return { status: 'ready' };
  return { status: 'onboarding_needed' };
}
