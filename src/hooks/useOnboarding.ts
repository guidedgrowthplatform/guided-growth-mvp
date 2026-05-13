import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as onboardingApi from '@/api/onboarding';
import { useSessionLog } from '@/hooks/useSessionLog';
import { queryKeys } from '@/lib/query';
import { useAuthStore } from '@/stores/authStore';
import type {
  OnboardingPath,
  OnboardingState,
  OnboardingStepData,
  ParsedHabit,
} from '@shared/types';

// Step → canonical screen_id (matches screen_contexts). Steps 8-9 cover the
// advanced flow and aren't keyed by integer — they fall through to the format
// string fallback in the handler below.
const STEP_TO_SCREEN_ID: Record<number, string> = {
  1: 'ONBOARD-01',
  2: 'ONBOARD-FORK',
  3: 'ONBOARD-BEGINNER-01',
  4: 'ONBOARD-BEGINNER-02',
  5: 'ONBOARD-BEGINNER-03',
  6: 'ONBOARD-BEGINNER-04',
  7: 'STARTING-PLAN',
};

export function useOnboarding() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { logEvent } = useSessionLog();
  // Lazy state init keeps Date.now() out of the render path (purity rule).
  const [startTime] = useState(() => Date.now());

  const state = qc.getQueryData<OnboardingState | null>(queryKeys.onboarding.state) ?? null;
  const isCompleted = state?.status === 'completed';

  const saveMutation = useMutation({
    mutationFn: ({
      step,
      path,
      data,
      brainDump,
    }: {
      step: number;
      path: OnboardingPath | null;
      data: Partial<OnboardingStepData>;
      brainDump?: { raw?: string; parsed?: ParsedHabit[] };
    }) => onboardingApi.saveOnboardingStep(step, path, data, brainDump),
    onSuccess: (updated, vars) => {
      qc.setQueryData(queryKeys.onboarding.state, updated);
      const screenId =
        STEP_TO_SCREEN_ID[vars.step] ?? `ONBOARD-${String(vars.step).padStart(2, '0')}`;
      // form_submit spec keeps screen_id in payload alongside the column —
      // the LLM reads payload for state delta, the column is for joins.
      logEvent('form_submit', { screen_id: screenId }, screenId);
    },
  });

  const completeMutation = useMutation({
    mutationFn: (finalData?: Partial<OnboardingStepData>) =>
      onboardingApi.completeOnboarding(finalData),
    onSuccess: async (_result, finalData) => {
      qc.setQueryData(queryKeys.onboarding.state, (old: OnboardingState | null | undefined) =>
        old
          ? { ...old, status: 'completed' as const, completed_at: new Date().toISOString() }
          : old,
      );
      const durationSec = Math.round((Date.now() - startTime) / 1000);
      const habitConfigs = finalData?.habitConfigs ?? finalData?.advancedHabitConfigs ?? null;
      const habitCount = habitConfigs ? Object.keys(habitConfigs).length : 0;
      logEvent(
        'onboarding_completed',
        {
          duration_sec: durationSec,
          habit_count: habitCount,
          reflection_style: finalData?.reflectionSchedule ?? '',
        },
        'STARTING-PLAN',
      );
      await useAuthStore.getState().updateProfile();
      navigate('/home', { replace: true, state: { fromOnboarding: true } });
    },
  });

  const saveStep = useCallback(
    (
      step: number,
      data: Partial<OnboardingStepData>,
      options?: { path?: OnboardingPath; brainDump?: { raw?: string; parsed?: ParsedHabit[] } },
    ) => {
      saveMutation.mutate({
        step,
        path: options?.path ?? state?.path ?? null,
        data,
        brainDump: options?.brainDump,
      });
    },
    [saveMutation, state?.path],
  );

  const saveStepAsync = useCallback(
    (
      step: number,
      data: Partial<OnboardingStepData>,
      options?: { path?: OnboardingPath; brainDump?: { raw?: string; parsed?: ParsedHabit[] } },
    ) => {
      return saveMutation.mutateAsync({
        step,
        path: options?.path ?? state?.path ?? null,
        data,
        brainDump: options?.brainDump,
      });
    },
    [saveMutation, state?.path],
  );

  const complete = useCallback(
    (finalData?: Partial<OnboardingStepData>) => {
      completeMutation.mutate(finalData ?? {});
    },
    [completeMutation],
  );

  return {
    state,
    isCompleted,
    isSaving: saveMutation.isPending,
    isCompleting: completeMutation.isPending,
    saveStep,
    saveStepAsync,
    complete,
  };
}
