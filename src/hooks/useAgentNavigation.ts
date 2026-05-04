import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOnboarding } from '@/hooks/useOnboarding';

/**
 * Input to the agent-advance decision. Kept as a pure shape so the
 * predicate below can be unit-tested without React or the router.
 */
export interface AgentAdvanceInput {
  /** The current_step value Realtime-mirrored into the React Query cache. */
  persistedStep: number | undefined;
  initialPersistedStep: number | undefined;
  /** The step number this screen represents. */
  currentStep: number;
  /** The route to navigate to, or null if the target isn't resolvable yet. */
  nextRoute: string | null;
  /** Whether the calling hook has already triggered navigation once. */
  alreadyAdvanced: boolean;
}

/**
 * Pure decision: should we navigate right now?
 *
 * Returns true only when:
 * - the screen hasn't already advanced on this mount,
 * - the persisted onboarding step has climbed past the current screen,
 * - and a concrete `nextRoute` is known (for forked screens like
 *   ONBOARD-02 the route resolves only after the agent writes the path
 *   field — until then we defer).
 */
export function shouldAdvanceToNextScreen(input: AgentAdvanceInput): boolean {
  if (input.alreadyAdvanced) return false;
  if (input.persistedStep === undefined) return false;
  if (input.persistedStep <= input.currentStep) return false;
  if (input.initialPersistedStep !== undefined && input.initialPersistedStep > input.currentStep) {
    return false;
  }
  if (!input.nextRoute) return false;
  return true;
}

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
  const initialPersistedStepRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (initialPersistedStepRef.current === undefined && state?.current_step !== undefined) {
      initialPersistedStepRef.current = state.current_step;
    }
  }, [state?.current_step]);

  useEffect(() => {
    if (
      !shouldAdvanceToNextScreen({
        persistedStep: state?.current_step,
        initialPersistedStep: initialPersistedStepRef.current,
        currentStep,
        nextRoute,
        alreadyAdvanced: advancedRef.current,
      })
    ) {
      return;
    }
    advancedRef.current = true;
    navigate(nextRoute as string);
  }, [state, currentStep, nextRoute, navigate]);
}
