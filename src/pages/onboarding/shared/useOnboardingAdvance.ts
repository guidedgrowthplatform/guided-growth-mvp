import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { type NavigateOptions, useNavigate } from 'react-router-dom';
import { advanceOnboardingStep } from '@/api/onboarding';
import { queryKeys } from '@/lib/query';
import type { OnboardingState } from '@gg/shared/types';

// Bare-set current_step down to destStep on a back-navved forward move; awaited
// so the server row's updated_at wins over saveStep's stale GREATEST broadcast.
export function useOnboardingAdvance() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  return useCallback(
    async (destStep: number, to: string, options?: NavigateOptions) => {
      const cached = qc.getQueryData<OnboardingState | null>(queryKeys.onboarding.state) ?? null;
      if (cached && cached.current_step > destStep) {
        try {
          const row = await advanceOnboardingStep(destStep);
          qc.setQueryData(queryKeys.onboarding.state, row);
        } catch {
          qc.setQueryData<OnboardingState | null>(queryKeys.onboarding.state, {
            ...cached,
            current_step: destStep,
          });
        }
      }
      navigate(to, options);
    },
    [navigate, qc],
  );
}
