import type {
  OnboardingPath,
  OnboardingState,
  OnboardingStepData,
  ParsedHabit,
} from '@shared/types';
import { apiDelete, apiGet, apiPost, apiPut } from './client';

const IS_BYPASS = import.meta.env.VITE_AUTH_BYPASS_MODE === 'true';
const LOCAL_KEY = '__dev_onboarding_state';

function getLocalState(): OnboardingState | null {
  if (!IS_BYPASS) return null;
  const raw = localStorage.getItem(LOCAL_KEY);
  return raw ? JSON.parse(raw) : null;
}

function setLocalState(state: OnboardingState): void {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
}

function makeDefaultState(): OnboardingState {
  return {
    id: 'dev-onboarding',
    user_id: 'dev-user-001',
    status: 'in_progress',
    current_step: 1,
    path: null,
    data: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    completed_at: null,
  } as OnboardingState;
}

export async function fetchOnboardingState(): Promise<OnboardingState | null> {
  if (IS_BYPASS) return getLocalState() ?? makeDefaultState();
  return apiGet<OnboardingState | null>('/api/onboarding');
}

export async function saveOnboardingStep(
  step: number,
  path: OnboardingPath | null,
  data: Partial<OnboardingStepData>,
  brainDump?: { raw?: string; parsed?: ParsedHabit[] },
): Promise<OnboardingState> {
  if (IS_BYPASS) {
    const current = getLocalState() ?? makeDefaultState();
    const updated: OnboardingState = {
      ...current,
      current_step: step,
      path: path ?? current.path,
      data: { ...current.data, ...data },
      updated_at: new Date().toISOString(),
    };
    setLocalState(updated);
    return updated;
  }
  return apiPut<OnboardingState>('/api/onboarding', {
    step,
    path,
    data,
    brainDumpRaw: brainDump?.raw,
    brainDumpParsed: brainDump?.parsed,
  });
}

export async function completeOnboarding(finalData?: Partial<OnboardingStepData>): Promise<void> {
  if (IS_BYPASS) {
    const current = getLocalState() ?? makeDefaultState();
    setLocalState({ ...current, status: 'completed', completed_at: new Date().toISOString() });
    return;
  }
  await apiPost<{ message: string }>('/api/onboarding/complete', { finalData });
}

export async function deleteAccount(): Promise<void> {
  if (IS_BYPASS) {
    localStorage.removeItem(LOCAL_KEY);
    return;
  }
  await apiDelete<{ message: string }>('/api/onboarding/delete-account');
}
