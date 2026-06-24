import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useOnboarding } from '@/hooks/useOnboarding';
import { beatForStep, type Beat } from '@/lib/onboarding/onboardingStepBeats';
import { queryKeys } from '@/lib/query';
import type { OnboardingState } from '@gg/shared/types';

// Drives the single-screen chat-native flow: current_step (+ path) selects the
// beat; advance() bumps current_step so the next beat's screenId/opener fires.
// On the chat page nothing watches current_step for route changes (unlike the
// routed useAgentNavigation), so the bump just re-selects the beat in place.
export function useOnboardingBeat(): { beat: Beat; advance: (toStep?: number) => void } {
  const qc = useQueryClient();
  const { state } = useOnboarding();
  // No row yet (brand-new) → step 0 = Beat 0 (preferences), the first in-chat beat.
  const beat = beatForStep(state?.current_step ?? 0, state?.path ?? null);

  // Optimistic, client-first advance so the beat moves instantly without waiting
  // on the network. Idempotent (Math.max) — passing an explicit target lets a
  // frozen card from an earlier beat re-fire harmlessly (Math.max keeps the
  // higher current step). When there's no row yet (brand-new user) synthesize a
  // minimal in-progress state so a save failure can't strand them on Beat 0.
  const nextStep = beat.step + 1;
  const advance = useCallback(
    (toStep?: number) => {
      const target = toStep ?? nextStep;
      qc.setQueryData<OnboardingState | null>(queryKeys.onboarding.state, (prev) =>
        prev
          ? { ...prev, current_step: Math.max(prev.current_step, target) }
          : ({
              current_step: target,
              status: 'in_progress',
              path: null,
              data: {},
            } as OnboardingState),
      );
    },
    [qc, nextStep],
  );

  return { beat, advance };
}
