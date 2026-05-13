/**
 * Owns the single Vapi voice session that spans the entire onboarding flow.
 *
 * Mounted once at App level (wraps the route tree so any onboarding screen
 * can consume the state via `useOnboardingVoice`). Auto-starts the call when
 * the user enters an authed onboarding route, refreshes Coach Yair's context
 * whenever the route's screen_id changes, and tears the call down when the
 * user exits onboarding (e.g. lands on `/` after STARTING-PLAN).
 *
 * Replaces the per-screen Cartesia path (`useOnboardingAgent`) — single
 * long-lived call instead of one WebSocket per screen.
 *
 * Public `/welcome` is excluded because `/api/context` requires auth, so we
 * can't push a context message there. The earliest authed onboarding screen
 * (`/onboarding/voice-preference`) is the practical start point.
 */
import { useQuery } from '@tanstack/react-query';
import { ReactNode, useCallback, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { fetchScreenRoutes } from '@/api/context';
import {
  OnboardingVoiceContext,
  type OnboardingVoiceContextValue,
} from '@/contexts/useOnboardingVoice';
import { useVapiCall } from '@/hooks/useVapiCall';
import { screenIdForRoute } from '@/lib/context/screenIdForRoute';
import { queryKeys } from '@/lib/query/keys';

function isOnboardingPath(pathname: string): boolean {
  return pathname === '/onboarding' || pathname.startsWith('/onboarding/');
}

export function OnboardingVoiceProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const vapi = useVapiCall();

  const routesQuery = useQuery({
    queryKey: queryKeys.context.routes(),
    queryFn: fetchScreenRoutes,
    staleTime: 5 * 60 * 1000,
  });

  const inOnboarding = isOnboardingPath(location.pathname);
  const currentScreenId = useMemo(
    () => screenIdForRoute(routesQuery.data?.routes ?? [], location.pathname),
    [routesQuery.data, location.pathname],
  );

  useEffect(() => {
    if (inOnboarding && vapi.status === 'idle' && currentScreenId) {
      void vapi.start(currentScreenId);
    }
  }, [inOnboarding, vapi.status, currentScreenId, vapi.start, vapi]);

  useEffect(() => {
    if (vapi.status === 'active' && currentScreenId) {
      void vapi.refreshContext(currentScreenId);
    }
  }, [vapi.status, currentScreenId, vapi.refreshContext, vapi]);

  useEffect(() => {
    if (!inOnboarding && (vapi.status === 'active' || vapi.status === 'connecting')) {
      vapi.stop();
    }
  }, [inOnboarding, vapi.status, vapi.stop, vapi]);

  const restartCall = useCallback(async () => {
    if (currentScreenId) await vapi.start(currentScreenId);
  }, [currentScreenId, vapi]);

  const value: OnboardingVoiceContextValue = {
    status: vapi.status,
    isMuted: vapi.isMuted,
    isAssistantSpeaking: vapi.isAssistantSpeaking,
    errorMessage: vapi.errorMessage,
    currentScreenId,
    toggleMute: vapi.toggleMute,
    endCall: vapi.stop,
    restartCall,
  };

  return (
    <OnboardingVoiceContext.Provider value={value}>{children}</OnboardingVoiceContext.Provider>
  );
}
