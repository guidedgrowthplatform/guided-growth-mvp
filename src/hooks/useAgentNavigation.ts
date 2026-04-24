import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOnboarding } from '@/hooks/useOnboarding';

/**
 * Advance the user to the next onboarding screen when the real-time
 * agent signals that the current screen's task is complete.
 *
 * How the signal works
 * --------------------
 * The Cartesia Line agent's `navigate_next` tool writes a bumped
 * `current_step` to `onboarding_states`. Supabase Realtime mirrors that
 * row into the React Query cache via `useOnboardingRealtimeSync`. This
 * hook watches that cached value: if it climbs past the screen we're
 * currently rendering, we `navigate()` once.
 *
 * Why `current_step` instead of a dedicated `status='ready_for_next'`
 * signal: the `onboarding_states` table only has `status` and
 * `current_step` columns (001_onboarding.sql). Adding a new column for
 * a single signal is overkill when we can edge-detect on the integer
 * that's already there.
 *
 * The hook is idempotent: it fires at most once per mount via a ref
 * guard, so re-renders or lagging Realtime events won't double-navigate.
 * Per Voice System Implementation Guide §2.5: "In voice mode the user
 * should NEVER have to press a button to advance to the next screen."
 */
export function useAgentNavigation(currentStep: number, nextRoute: string | null): void {
  const { state } = useOnboarding();
  const navigate = useNavigate();
  const advancedRef = useRef(false);

  useEffect(() => {
    if (advancedRef.current) return;
    if (!state) return;
    if (state.current_step <= currentStep) return;
    // The agent has advanced the step but the route target isn't
    // resolvable yet (e.g. ONBOARD-02 fork is waiting for the agent to
    // write `path` into onboarding_states.data before we know whether
    // to route to beginner or advanced). Don't fire — we'll re-check
    // on the next Realtime payload when the field lands.
    if (!nextRoute) return;
    advancedRef.current = true;
    navigate(nextRoute);
  }, [state, currentStep, nextRoute, navigate]);
}
