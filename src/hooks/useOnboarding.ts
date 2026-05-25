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
export const STEP_TO_SCREEN_ID: Record<number, string> = {
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
    onSuccess: (updated) => {
      qc.setQueryData(queryKeys.onboarding.state, updated);
      // form_submit is logged SYNCHRONOUSLY in saveStep / saveStepAsync below
      // (BEFORE the mutation kicks off) so the optimistic session_log store
      // contains it before the page navigates. Logging here would race the
      // navigate(), so by the time the next screen's pushScreenContext reads
      // state_delta, form_submit wouldn't be there yet.
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

  // Synchronously emit form_submit into the optimistic session_log store
  // BEFORE the saveStep mutation is queued. Two reasons:
  // 1. Continue handlers do `saveStep(...); navigate(...)` synchronously, so
  //    by the time the next screen mounts and its Vapi pushScreenContext
  //    fires, the form_submit must already be in state_delta. If we waited
  //    for mutation.onSuccess (server round-trip), it would land too late.
  // 2. The local store is "optimistic" — failed server POSTs still leave
  //    the row in the local delta, which is exactly what state_delta needs
  //    to reflect user intent.
  const emitFormSubmit = useCallback(
    (step: number, data: Partial<OnboardingStepData>, path: OnboardingPath | null) => {
      const screenId = STEP_TO_SCREEN_ID[step] ?? `ONBOARD-${String(step).padStart(2, '0')}`;
      const payload: Record<string, unknown> = { screen_id: screenId, ...data };
      if (path) payload.path = path;
      if (import.meta.env.DEV) {
        console.debug('[onboarding] form_submit (optimistic)', { screenId, payload });
      }
      logEvent('form_submit', payload, screenId);
    },
    [logEvent],
  );

  const saveStep = useCallback(
    (
      step: number,
      data: Partial<OnboardingStepData>,
      options?: { path?: OnboardingPath; brainDump?: { raw?: string; parsed?: ParsedHabit[] } },
    ) => {
      const path = options?.path ?? state?.path ?? null;
      emitFormSubmit(step, data, options?.path ?? null);
      saveMutation.mutate({
        step,
        path,
        data,
        brainDump: options?.brainDump,
      });
    },
    [saveMutation, state?.path, emitFormSubmit],
  );

  const saveStepAsync = useCallback(
    (
      step: number,
      data: Partial<OnboardingStepData>,
      options?: { path?: OnboardingPath; brainDump?: { raw?: string; parsed?: ParsedHabit[] } },
    ) => {
      const path = options?.path ?? state?.path ?? null;
      emitFormSubmit(step, data, options?.path ?? null);
      return saveMutation.mutateAsync({
        step,
        path,
        data,
        brainDump: options?.brainDump,
      });
    },
    [saveMutation, state?.path, emitFormSubmit],
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
