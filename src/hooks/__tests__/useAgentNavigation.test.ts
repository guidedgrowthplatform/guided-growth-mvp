/**
 * Tests for shouldAdvanceToNextScreen — the pure decision function
 * inside useAgentNavigation.
 *
 * Why test the predicate and not the hook: the behaviour that actually
 * matters for correctness is the edge-detector on persistedStep vs
 * currentStep. Mocking react-router + react-query to exercise the
 * rendered hook would add indirection without catching more bugs.
 *
 * Behaviour under test corresponds to Voice System Implementation Guide
 * §2.5: "In voice mode, the user should NEVER have to press a button
 * to advance to the next screen." The predicate is what makes that
 * true — it must fire exactly once per screen when the agent has
 * written a higher current_step and the target route is known.
 *
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { shouldAdvanceToNextScreen } from '../useAgentNavigation';

describe('shouldAdvanceToNextScreen', () => {
  it('returns true when persistedStep has climbed past currentStep and route is known', () => {
    expect(
      shouldAdvanceToNextScreen({
        persistedStep: 2,
        currentStep: 1,
        nextRoute: '/onboarding/step-2',
        alreadyAdvanced: false,
      }),
    ).toBe(true);
  });

  it('returns false before the agent bumps the step (still on same screen)', () => {
    expect(
      shouldAdvanceToNextScreen({
        persistedStep: 1,
        currentStep: 1,
        nextRoute: '/onboarding/step-2',
        alreadyAdvanced: false,
      }),
    ).toBe(false);
  });

  it('returns false when persistedStep has not caught up yet', () => {
    expect(
      shouldAdvanceToNextScreen({
        persistedStep: 0,
        currentStep: 1,
        nextRoute: '/onboarding/step-2',
        alreadyAdvanced: false,
      }),
    ).toBe(false);
  });

  it('returns false when the target route is not yet resolvable (fork screen waiting on path)', () => {
    // ONBOARD-02 fork scenario: agent bumped step but hasn't written
    // `path` yet, so the branch route is unknown. The hook must NOT
    // navigate; it will re-check on the next Realtime payload.
    expect(
      shouldAdvanceToNextScreen({
        persistedStep: 3,
        currentStep: 2,
        nextRoute: null,
        alreadyAdvanced: false,
      }),
    ).toBe(false);
  });

  it('returns false when already advanced this mount (no double-navigate)', () => {
    // Lagging Realtime payload after we already navigated once. The
    // advancedRef guard prevents the second navigate from firing.
    expect(
      shouldAdvanceToNextScreen({
        persistedStep: 3,
        currentStep: 1,
        nextRoute: '/onboarding/step-2',
        alreadyAdvanced: true,
      }),
    ).toBe(false);
  });

  it('returns false on initial cache miss (persistedStep is undefined)', () => {
    // First render before Realtime sync has fetched the row. We can't
    // make a decision yet.
    expect(
      shouldAdvanceToNextScreen({
        persistedStep: undefined,
        currentStep: 1,
        nextRoute: '/onboarding/step-2',
        alreadyAdvanced: false,
      }),
    ).toBe(false);
  });

  it('handles a multi-step jump (e.g. agent skipped ahead to step 4 while we were on 1)', () => {
    // Shouldn't actually happen in normal flow, but if it does we
    // still navigate — agent drives, frontend follows.
    expect(
      shouldAdvanceToNextScreen({
        persistedStep: 4,
        currentStep: 1,
        nextRoute: '/onboarding/step-2',
        alreadyAdvanced: false,
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
      }),
    ).toBe(false);
  });

  it('works for the final plan-review step (currentStep=7 → complete)', () => {
    // PlanReviewPage waits for persistedStep > 7 before firing complete().
    // Proving the predicate returns true at that edge.
    expect(
      shouldAdvanceToNextScreen({
        persistedStep: 8,
        currentStep: 7,
        nextRoute: '/home',
        alreadyAdvanced: false,
      }),
    ).toBe(true);
  });
});
