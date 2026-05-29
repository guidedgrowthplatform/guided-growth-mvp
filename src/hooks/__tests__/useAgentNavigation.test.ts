/**
 * Tests for shouldAdvanceToNextScreen — the pure decision function
 * inside useAgentNavigation.
 *
 * Why test the predicate and not the hook: the behaviour that actually
 * matters for correctness is the edge-detector on persistedStep vs
 * currentStep with the leading-edge guard. Mocking react-router +
 * react-query to exercise the rendered hook would add indirection
 * without catching more bugs.
 *
 * Behaviour under test corresponds to Voice System Implementation Guide
 * §2.5: "In voice mode, the user should NEVER have to press a button
 * to advance to the next screen." The predicate is what makes that
 * true — it must fire exactly once per screen when the LLM has explicitly
 * called `navigate_next` to advance the user.
 *
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { shouldAdvanceToNextScreen } from '../useAgentNavigation';

describe('shouldAdvanceToNextScreen', () => {
  it('fires when persistedStep transitioned past currentStep during the mount', () => {
    // Fresh user happy path: navigate_next bumped step from 1 → 2 while
    // Step1Page was mounted.
    expect(
      shouldAdvanceToNextScreen({
        persistedStep: 2,
        currentStep: 1,
        nextRoute: '/onboarding/step-2',
        alreadyAdvanced: false,
        hasStepChanged: true,
      }),
    ).toBe(true);
  });

  it('does NOT fire on mount-time magnitude (no transition yet)', () => {
    // Race-safe / back-nav-safe: persistedStep is already past at first
    // observation. We sit still until the LLM explicitly calls navigate_next.
    expect(
      shouldAdvanceToNextScreen({
        persistedStep: 5,
        currentStep: 1,
        nextRoute: '/onboarding/step-2',
        alreadyAdvanced: false,
        hasStepChanged: false,
      }),
    ).toBe(false);
  });

  it('does NOT fire before persistedStep climbs past currentStep', () => {
    // persistedStep changed (e.g. submit_profile wrote data and Realtime
    // delivered) but it's still at currentStep — no nav yet.
    expect(
      shouldAdvanceToNextScreen({
        persistedStep: 1,
        currentStep: 1,
        nextRoute: '/onboarding/step-2',
        alreadyAdvanced: false,
        hasStepChanged: true,
      }),
    ).toBe(false);
  });

  it('does NOT fire when target route is not yet resolvable (fork screen)', () => {
    expect(
      shouldAdvanceToNextScreen({
        persistedStep: 3,
        currentStep: 2,
        nextRoute: null,
        alreadyAdvanced: false,
        hasStepChanged: true,
      }),
    ).toBe(false);
  });

  it('does NOT fire when already advanced this mount (idempotency)', () => {
    expect(
      shouldAdvanceToNextScreen({
        persistedStep: 2,
        currentStep: 1,
        nextRoute: '/onboarding/step-2',
        alreadyAdvanced: true,
        hasStepChanged: true,
      }),
    ).toBe(false);
  });

  it('does NOT fire on initial cache miss (persistedStep is undefined)', () => {
    expect(
      shouldAdvanceToNextScreen({
        persistedStep: undefined,
        currentStep: 1,
        nextRoute: '/onboarding/step-2',
        alreadyAdvanced: false,
        hasStepChanged: false,
      }),
    ).toBe(false);
  });

  it('does NOT fire when persistedStep is past but step never changed during mount', () => {
    // User back-navigated to step 2 from step 5. persistedStep is 5 at
    // mount; user edits a field, tool merges data but doesn't bump step.
    // hasStepChanged stays false. No yank.
    expect(
      shouldAdvanceToNextScreen({
        persistedStep: 5,
        currentStep: 2,
        nextRoute: '/onboarding/step-3',
        alreadyAdvanced: false,
        hasStepChanged: false,
      }),
    ).toBe(false);
  });

  it('fires when the user confirms and LLM calls navigate_next on a back-navved page', () => {
    // Same back-nav scenario; user says "yes continue", LLM calls
    // navigate_next(3). persistedStep changes from initial value, now
    // hasStepChanged is true. predicate fires.
    expect(
      shouldAdvanceToNextScreen({
        persistedStep: 3,
        currentStep: 2,
        nextRoute: '/onboarding/step-3',
        alreadyAdvanced: false,
        hasStepChanged: true,
      }),
    ).toBe(true);
  });

  it('rejects an empty string route as not-yet-resolvable', () => {
    expect(
      shouldAdvanceToNextScreen({
        persistedStep: 2,
        currentStep: 1,
        nextRoute: '',
        alreadyAdvanced: false,
        hasStepChanged: true,
      }),
    ).toBe(false);
  });

  it('works for the final plan-review step (currentStep=7 → complete)', () => {
    expect(
      shouldAdvanceToNextScreen({
        persistedStep: 8,
        currentStep: 7,
        nextRoute: '/home',
        alreadyAdvanced: false,
        hasStepChanged: true,
      }),
    ).toBe(true);
  });

  it('handles a multi-step jump (LLM called navigate_next with a step > currentStep+1)', () => {
    // Returning user re-entering onboarding after step 1; LLM detects
    // they want to go to where they left off and calls navigate_next(4).
    // The Step1 → Step2 hop fires here; subsequent step pages will chain.
    expect(
      shouldAdvanceToNextScreen({
        persistedStep: 4,
        currentStep: 1,
        nextRoute: '/onboarding/step-2',
        alreadyAdvanced: false,
        hasStepChanged: true,
      }),
    ).toBe(true);
  });
});
