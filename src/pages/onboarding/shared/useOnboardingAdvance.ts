import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { type NavigateOptions, useNavigate } from 'react-router-dom';
import { advanceOnboardingStep } from '@/api/onboarding';
import { queryKeys } from '@/lib/query';
import type { OnboardingState } from '@gg/shared/types';

// Forward nav. When a stale high-water current_step sits past the destination
// (back-nav), bare-set it down to destStep so the destination screen doesn't
// cascade. Optimistic cache write BEFORE navigate; persist in the background.
export function useOnboardingAdvance() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  return useCallback(
    (destStep: number, to: string, options?: NavigateOptions) => {
      const cached = qc.getQueryData<OnboardingState | null>(queryKeys.onboarding.state) ?? null;
      if (cached && cached.current_step > destStep) {
        qc.setQueryData<OnboardingState | null>(queryKeys.onboarding.state, {
          ...cached,
          current_step: destStep,
        });
        void advanceOnboardingStep(destStep)
          .then((row) => qc.setQueryData(queryKeys.onboarding.state, row))
          .catch(() => {});
      }
      navigate(to, options);
    },
    [navigate, qc],
  );
}
