import { useCallback, useRef, useState } from 'react';
import { track } from '@/analytics';

export function useStepTiming(
  stepNumber: number,
  stepName: string,
  onboardingPath: 'beginner' | 'advanced' | null,
) {
  const [startedAt] = useState(() => Date.now());
  const firedRef = useRef(false);

  return useCallback(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    track('complete_onboarding_step', {
      step_number: stepNumber,
      step_name: stepName,
      onboarding_path: onboardingPath,
      time_on_step_seconds: Math.round((Date.now() - startedAt) / 1000),
    });
  }, [stepNumber, stepName, onboardingPath, startedAt]);
}
