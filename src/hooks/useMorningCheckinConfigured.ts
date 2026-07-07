import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { queryKeys } from '@/lib/query';
import { supabaseDataService } from '@/lib/services/supabase-data-service';

// W3-B: Home's "Morning Check In" card used to render unconditionally,
// regardless of whether the user ever actually configured a morning
// check-in during onboarding (submit_morning_checkin can be rejected by the
// server-side setup-config guard, B58/!478, e.g. on an explicit refusal).
// Server truth only: read the same onboarding_states row useAppGate already
// caches (queryKeys.onboarding.state) and check for a real morningCheckin
// config, rather than showing the card by default.
export function useMorningCheckinConfigured(): boolean {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: queryKeys.onboarding.state,
    queryFn: () => supabaseDataService.getOnboardingState(),
    enabled: !!user,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  });
  return data?.data?.morningCheckin != null;
}
