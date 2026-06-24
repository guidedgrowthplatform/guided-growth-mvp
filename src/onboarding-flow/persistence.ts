/**
 * Persistence adapter for the flow orchestrator.
 *
 * The orchestrator stays decoupled from how answers are saved: in the real app
 * it reuses the existing `useOnboarding()` save path verbatim (saveStep +
 * complete, the same calls the old Step pages make), and a local no-op adapter
 * lets the renderer run in a browser preview with no auth / no Supabase.
 */
import { useMemo } from 'react';
import { useOnboarding } from '@/hooks/useOnboarding';
import type { OnboardingPath, OnboardingStepData } from '@gg/shared/types';

export interface FlowPersistence {
  /** Mirrors useOnboarding().saveStep — optimistic, fire-and-forget. */
  saveStep: (
    step: number,
    data: Partial<OnboardingStepData>,
    options?: { path?: OnboardingPath },
  ) => void;
  /** Mirrors useOnboarding().complete — writes final state + navigates to /home. */
  complete: (finalData?: Partial<OnboardingStepData>) => void;
}

/** Production adapter: reuses the real Supabase save path. */
export function useOnboardingPersistence(): FlowPersistence {
  const { saveStep, complete } = useOnboarding();
  return useMemo<FlowPersistence>(() => ({ saveStep, complete }), [saveStep, complete]);
}

/**
 * Preview adapter: keeps everything in memory and logs. Used by the public
 * preview route so the chat-native flow is runnable without auth.
 */
export function useLocalPersistence(onComplete?: (finalData?: Partial<OnboardingStepData>) => void): FlowPersistence {
  return useMemo<FlowPersistence>(
    () => ({
      saveStep: (step, data, options) => {
        // eslint-disable-next-line no-console
        console.info('[flow-preview] saveStep', step, data, options ?? {});
      },
      complete: (finalData) => {
        // eslint-disable-next-line no-console
        console.info('[flow-preview] complete', finalData ?? {});
        onComplete?.(finalData);
      },
    }),
    [onComplete],
  );
}
