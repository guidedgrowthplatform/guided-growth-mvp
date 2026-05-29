/* eslint-disable react-hooks/refs -- this hook intentionally reads refs during
   render to capture the initial persistedStep BEFORE the advance effect runs on
   the same render (leading-edge detection). See the inline comments at the
   initialization block below for the full rationale. */
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDualButtonControls } from '@/hooks/useDualButtonControls';
import { useOnboarding } from '@/hooks/useOnboarding';

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
 * Advance the user to the next onboarding screen when the agent has
 * navigated them via `navigate_next`.
 *
 * Architecture
 * ------------
 * The Vapi assistant has TWO kinds of tools:
 *   - `submit_*` tools — save data only. They do NOT touch current_step.
 *   - `navigate_next` — the only tool that writes current_step.
 *
 * So on a back-navved page, the user can edit fields freely (data tools
 * fire, persistedStep doesn't change). Auto-nav only fires when the LLM
 * has explicitly received user confirmation ("ready to continue?") and
 * called `navigate_next`.
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
 * persistedStep climbs past currentStep — that's the `navigate_next` call
 * the LLM made after the user confirmed.
 *
 * Idempotent: fires at most once per mount via `advancedRef`. Lagging
 * Realtime events or React Query refetches can't double-navigate.
 *
 * Per Voice System Implementation Guide §2.5: "In voice mode the user
 * should NEVER have to press a button to advance to the next screen."
 */
export function useAgentNavigation(currentStep: number, nextRoute: string | null): void {
  const { state } = useOnboarding();
  const navigate = useNavigate();
  const { voiceOn, micOn } = useDualButtonControls();
  // Voice-only: text/tap modes navigate client-side via the page's handleNext.
  const voiceActive = voiceOn || micOn;
  const advancedRef = useRef(false);
  // The persistedStep value observed at the START of this mount. Set once
  // on the first render where state.current_step is defined. Subsequent
  // changes are compared against this baseline to detect "step changed
  // during the mount" (a leading edge).
  const initialPersistedStepRef = useRef<number | undefined>(undefined);
  // True once we've recorded the initial value. Distinguishes "ref is
  // undefined because we haven't initialized" from "ref is undefined
  // because the initial value was undefined" — both legitimate states.
  const hasInitializedRef = useRef(false);

  const persistedStep = state?.current_step;

  // First-render initialization. Records the initial value but doesn't
  // fire — that's the whole point of leading-edge. Runs in render rather
  // than useEffect so the initial value is captured BEFORE the predicate
  // effect runs on the same render.
  if (!hasInitializedRef.current && persistedStep !== undefined) {
    initialPersistedStepRef.current = persistedStep;
    hasInitializedRef.current = true;
  }

  // Has persistedStep CHANGED since the initial observation? Only true
  // once we've initialized AND the current value differs from the seed.
  const hasStepChanged =
    hasInitializedRef.current && persistedStep !== initialPersistedStepRef.current;

  useEffect(() => {
    if (!voiceActive) {
      if (import.meta.env.DEV) {
        console.debug(
          `[useAgentNavigation] skip currentStep=${currentStep} reason=voice_inactive ` +
            `voiceOn=${voiceOn} micOn=${micOn} — auto-nav is voice-only`,
        );
      }
      return;
    }
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
          reason = `awaiting_step_change (current=${input.persistedStep}, initial=${initialPersistedStepRef.current})`;
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
          `(initial=${initialPersistedStepRef.current} → now=${persistedStep})`,
      );
    }
    advancedRef.current = true;
    navigate(nextRoute as string);
  }, [
    persistedStep,
    currentStep,
    nextRoute,
    navigate,
    voiceActive,
    voiceOn,
    micOn,
    hasStepChanged,
  ]);
}
