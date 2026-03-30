import type {
  OnboardingPath,
  OnboardingState,
  OnboardingStepData,
  ParsedHabit,
} from '@shared/types';
import { apiDelete, apiGet, apiPost, apiPut } from './client';

export async function fetchOnboardingState(): Promise<OnboardingState | null> {
  return apiGet<OnboardingState | null>('/api/onboarding');
}

export async function saveOnboardingStep(
  step: number,
  path: OnboardingPath | null,
  data: Partial<OnboardingStepData>,
  brainDump?: { raw?: string; parsed?: ParsedHabit[] },
): Promise<OnboardingState> {
  return apiPut<OnboardingState>('/api/onboarding', {
    step,
    path,
    data,
    brainDumpRaw: brainDump?.raw,
    brainDumpParsed: brainDump?.parsed,
  });
}

export async function completeOnboarding(finalData?: Partial<OnboardingStepData>): Promise<void> {
  await apiPost<{ message: string }>('/api/onboarding/complete', { finalData });
}

export async function deleteAccount(): Promise<void> {
  await apiDelete<{ message: string }>('/api/onboarding/delete-account');
}
