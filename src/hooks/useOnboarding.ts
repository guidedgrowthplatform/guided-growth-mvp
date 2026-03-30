import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as onboardingApi from '@/api/onboarding';
import { queryKeys } from '@/lib/query';
import type {
  OnboardingPath,
  OnboardingState,
  OnboardingStepData,
  ParsedHabit,
} from '@shared/types';

export function useOnboarding() {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: state = null, isLoading } = useQuery({
    queryKey: queryKeys.onboarding.state,
    queryFn: onboardingApi.fetchOnboardingState,
    staleTime: 30_000,
  });

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
    onSuccess: (updated) => {
      qc.setQueryData(queryKeys.onboarding.state, updated);
    },
  });

  const completeMutation = useMutation({
    mutationFn: (finalData?: Partial<OnboardingStepData>) =>
      onboardingApi.completeOnboarding(finalData),
    onSuccess: () => {
      qc.setQueryData(queryKeys.onboarding.state, (old: OnboardingState | null | undefined) =>
        old
          ? { ...old, status: 'completed' as const, completed_at: new Date().toISOString() }
          : old,
      );
      navigate('/home', { replace: true });
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
      completeMutation.mutate(finalData);
    },
    [completeMutation],
  );

  return {
    state,
    isLoading,
    isCompleted,
    isSaving: saveMutation.isPending,
    isCompleting: completeMutation.isPending,
    saveStep,
    saveStepAsync,
    complete,
  };
}
