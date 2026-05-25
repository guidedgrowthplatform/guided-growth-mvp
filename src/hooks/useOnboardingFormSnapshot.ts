import { useMemo } from 'react';
import { useOnboarding } from '@/hooks/useOnboarding';

/**
 * Snapshot of the onboarding form fields known so far. Composed of:
 * 1. Persisted state from `onboarding_states.data` (via useOnboarding).
 * 2. Optional in-flight overrides from the current page (state setters'
 *    values that haven't been saveStep'd yet).
 *
 * Empty / undefined fields are kept as-is in the merged object — the renderer
 * downstream (buildOnboardingPrompt / buildContextMessage) strips them.
 *
 * Consumed by:
 * - OnboardingLayout → processTranscript `filled_fields` (parser hot path).
 * - OnboardingLayout → onboardingVoice.setFormSnapshot() (Vapi context push).
 */
export function useOnboardingFormSnapshot(
  overrides?: Record<string, unknown>,
): Record<string, unknown> {
  const { state } = useOnboarding();
  const persisted = state?.data as Record<string, unknown> | undefined;
  return useMemo(() => ({ ...(persisted ?? {}), ...(overrides ?? {}) }), [persisted, overrides]);
}
