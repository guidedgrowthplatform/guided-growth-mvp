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
  // Destructure the stable callbacks + primitives. `vapi` itself is a fresh
  // object each render, so depending on it directly causes effects to fire
  // every commit; the underlying useCallbacks in useVapiCall are stable.
  const {
    status,
    isMuted,
    isTtsMuted,
    isAssistantSpeaking,
    errorMessage,
    start,
    stop,
    toggleMute,
    setMicEnabled,
    setTtsEnabled,
    refreshContext,
  } = vapi;

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
    if (inOnboarding && status === 'idle' && currentScreenId) {
      void start(currentScreenId);
    }
  }, [inOnboarding, status, currentScreenId, start]);

  useEffect(() => {
    if (status === 'active' && currentScreenId) {
      void refreshContext(currentScreenId);
    }
  }, [status, currentScreenId, refreshContext]);

  useEffect(() => {
    if (!inOnboarding && (status === 'active' || status === 'connecting')) {
      stop();
    }
  }, [inOnboarding, status, stop]);

  const restartCall = useCallback(async () => {
    if (currentScreenId) await start(currentScreenId);
  }, [currentScreenId, start]);

  const value: OnboardingVoiceContextValue = {
    status,
    isMuted,
    isTtsMuted,
    isAssistantSpeaking,
    errorMessage,
    currentScreenId,
    toggleMute,
    setMicEnabled,
    setTtsEnabled,
    endCall: stop,
    restartCall,
  };

  return (
    <OnboardingVoiceContext.Provider value={value}>{children}</OnboardingVoiceContext.Provider>
  );
}
