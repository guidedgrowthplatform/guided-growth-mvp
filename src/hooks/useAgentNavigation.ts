/* eslint-disable react-hooks/refs -- this hook intentionally reads refs during
   render to capture the initial persistedStep BEFORE the advance effect runs on
   the same render (leading-edge detection). See the inline comments at the
   initialization block below for the full rationale. */
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOnboarding } from '@/hooks/useOnboarding';
import { queryKeys } from '@/lib/query';

/**
 * Input to the agent-advance decision. Kept as a pure shape so the
 * predicate below can be unit-tested without React or the router.
 */
export interface AgentAdvanceInput {
  /** The current_step value Realtime-mirrored into the React Query cache. */
  persistedStep: number | undefined;
  /** The step number this screen represents. */
  currentStep: number;
  /** The route to navigate to, or null if the target isn't resolvable yet. */
  nextRoute: string | null;
  /** Whether the calling hook has already triggered navigation once this mount. */
  alreadyAdvanced: boolean;
  /**
   * True when persistedStep has actually CHANGED during this mount (a
   * transition), as opposed to being already past on first observation.
   * Auto-nav only fires on transitions — see the hook below for why.
   */
  hasStepChanged: boolean;
}

/**
 * Pure decision: should we navigate right now?
 *
 * Returns true only when:
 * - the screen hasn't already advanced on this mount,
 * - persistedStep actually changed during this mount (transition, not
 *   mount-time magnitude — see hook for why),
 * - persistedStep > currentStep,
 * - and a concrete `nextRoute` is known (for forked screens like
 *   ONBOARD-02 the route resolves only after the agent writes the path
 *   field — until then we defer).
 */
export function shouldAdvanceToNextScreen(input: AgentAdvanceInput): boolean {
  if (input.alreadyAdvanced) return false;
  if (input.persistedStep === undefined) return false;
  if (!input.hasStepChanged) return false;
  if (input.persistedStep <= input.currentStep) return false;
  if (!input.nextRoute) return false;
  return true;
}

/**
 * Advance the user to the next onboarding screen when current_step climbs
 * past this screen — driven by the agent in BOTH voice and text-chat modes.
 *
 * Architecture
 * ------------
 * current_step is written by the nav tool, surfaced here via the cached
 * onboarding state:
 *   - Voice (Vapi): `navigate_next` writes current_step.
 *   - Text/async (Direct-LLM): `advance_step` writes current_step (data tools
 *     are data-only — the model must call advance_step to move).
 *
 * Tap mode can't trigger this: Continue does `saveStep(); navigate()`
 * synchronously, so the page unmounts before the cache transition lands.
 *
 * Leading-edge rule
 * -----------------
 * We fire auto-nav only on TRANSITIONS of persistedStep, not on mount-time
 * magnitude. The very first observation of persistedStep during a mount is
 * recorded into a ref but does not fire — even if it's already past this
 * screen's step. Reason: when a user back-navigates here from a later
 * screen, persistedStep is already higher than currentStep at mount, but
 * the user clicked Back because they want to stay and edit, not be yanked
 * forward.
 *
 * Subsequent observations (after the ref is initialized) DO fire when
 * persistedStep climbs past currentStep — the agent advanced the user.
 *
 * Idempotent: fires at most once per mount via `advancedRef`. Lagging
 * Realtime events or React Query refetches can't double-navigate.
 *
 * Resumed users whose current_step is ALREADY past this screen get no
 * transition (GREATEST keeps it flat) → no auto-advance; they tap Continue.
 */
export function useAgentNavigation(currentStep: number, nextRoute: string | null): void {
  const { state } = useOnboarding();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const advancedRef = useRef(false);
  const arrivedAheadRef = useRef<boolean | undefined>(undefined);

  const persistedStep = state?.current_step;

  // Suppress auto-advance only on a genuine back-nav: arriving already-ahead AND
  // from a LATER screen. Arriving already-ahead from an EARLIER screen is the UI
  // catching up to a server the chat raced forward — it must keep advancing.
  if (arrivedAheadRef.current === undefined) {
    const prevStep = qc.getQueryData<number>(queryKeys.onboarding.lastNavStep);
    const cameFromEarlier = prevStep !== undefined && prevStep < currentStep;
    const ahead = persistedStep !== undefined && persistedStep > currentStep;
    arrivedAheadRef.current = ahead && !cameFromEarlier;
  }

  const hasStepChanged = arrivedAheadRef.current === false;

  useEffect(() => {
    qc.setQueryData(queryKeys.onboarding.lastNavStep, currentStep);
  }, [qc, currentStep]);

  useEffect(() => {
    const input: AgentAdvanceInput = {
      persistedStep,
      currentStep,
      nextRoute,
      alreadyAdvanced: advancedRef.current,
      hasStepChanged,
    };
    if (!shouldAdvanceToNextScreen(input)) {
      if (import.meta.env.DEV) {
        let reason = 'unknown';
        if (input.alreadyAdvanced) reason = 'already_advanced_this_mount';
        else if (input.persistedStep === undefined) reason = 'persisted_step_undefined';
        else if (!input.hasStepChanged)
          reason = `arrived_ahead_no_autoadvance (persisted=${input.persistedStep}, page=${currentStep})`;
        else if (input.persistedStep <= input.currentStep)
          reason = `persisted_step_not_advanced (db=${input.persistedStep} <= page=${input.currentStep})`;
        else if (!input.nextRoute) reason = 'next_route_unresolved';
        console.debug(
          `[useAgentNavigation] skip currentStep=${currentStep} reason=${reason}`,
          input,
        );
      }
      return;
    }
    if (import.meta.env.DEV) {
      console.debug(
        `[useAgentNavigation] FIRE currentStep=${currentStep} → ${nextRoute} ` +
          `(arrivedAhead=${arrivedAheadRef.current}, now=${persistedStep})`,
      );
    }
    advancedRef.current = true;
    navigate(nextRoute as string);
  }, [persistedStep, currentStep, nextRoute, navigate, hasStepChanged]);
}
