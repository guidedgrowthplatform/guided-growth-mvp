import type {
  OnboardingPath,
  OnboardingState,
  OnboardingStepData,
  ParsedHabit,
} from '@shared/types';
import type { OnboardingTurnResponse } from '@shared/types/llm';
import { apiDelete, apiPost, apiPut } from './client';

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

export interface DeleteAccountResponse {
  message: string;
  storage_purge: { avatars: number; journalImages: number };
  storage_purge_errors: string[];
}

export async function deleteAccount(): Promise<DeleteAccountResponse> {
  return apiDelete<DeleteAccountResponse>('/api/onboarding/delete-account');
}

export function parseOnboardingInput(
  screenId: string,
  text: string,
  options: string[],
  filledFields: Record<string, unknown>,
  step?: number,
): Promise<OnboardingTurnResponse> {
  return apiPost<OnboardingTurnResponse>('/api/llm/onboarding', {
    screen_id: screenId,
    user_message: text,
    options,
    filled_fields: filledFields,
    step,
  });
}
