import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { track } from '@/analytics';
import * as onboardingApi from '@/api/onboarding';
import { useToast } from '@/contexts/ToastContext';
import { useSessionLog } from '@/hooks/useSessionLog';
import {
  ensureExactAlarmPermission,
  isLocalRemindersSupported,
  requestLocalNotificationPermission,
  rescheduleFromSnapshot,
} from '@/lib/localReminders';
import { clearOnboardingChatSessionId } from '@/lib/onboarding/onboardingChatSession';
import { requestPushPermissionAndRegister } from '@/lib/push';
import { queryKeys } from '@/lib/query';
import { Sentry } from '@/lib/sentry';
import { useAuthStore } from '@/stores/authStore';
import type {
  OnboardingPath,
  OnboardingState,
  OnboardingStepData,
  ParsedHabit,
} from '@gg/shared/types';

// Step → canonical screen_id for session_log labels, on the V3 persist-step
// scale (the step each beat SAVES; 5 is shared by habit-select + habit-schedule
// and labels as habit-select). The advanced lane isn't keyed by integer — it
// falls through to the format-string fallback in the handler below.
const STEP_TO_SCREEN_ID: Record<number, string> = {
  1: 'ONBOARD-01',
  2: 'ONBOARD-FORK',
  3: 'ONBOARD-BEGINNER-01',
  4: 'ONBOARD-BEGINNER-02',
  5: 'ONBOARD-BEGINNER-03',
  6: 'ONBOARD-STATE-CHECK',
  7: 'ONBOARD-MORNING-SETUP',
  8: 'ONBOARD-BEGINNER-07',
};

export function useOnboarding() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { logEvent } = useSessionLog();
  const { addToast } = useToast();
  // Lazy state init keeps Date.now() out of the render path (purity rule).
  const [startTime] = useState(() => Date.now());

  // Subscribe to cache updates for the onboarding state key so this hook
  // re-renders when the row changes — including writes from
  // useOnboardingRealtimeSync (Vapi tool webhook path). Previously this was a
  // one-time getQueryData() snapshot read, so realtime updates didn't
  // propagate until a parent re-render forced this hook to re-run.
  //
  // Implementation note: we use a manual getQueryCache().subscribe() instead
  // of useQuery() to avoid the "No queryFn was passed" warning. The actual
  // fetcher lives in useAppGate; we only observe here.
  const [state, setState] = useState<OnboardingState | null>(
    () => qc.getQueryData<OnboardingState | null>(queryKeys.onboarding.state) ?? null,
  );
  useEffect(() => {
    const unsubscribe = qc.getQueryCache().subscribe((event) => {
      if (event.type !== 'updated') return;
      const key = event.query.queryKey;
      if (!Array.isArray(key) || key[0] !== 'onboarding' || key[1] !== 'state') return;
      setState(qc.getQueryData<OnboardingState | null>(queryKeys.onboarding.state) ?? null);
    });
    return unsubscribe;
  }, [qc]);
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
    // Synchronous body, no await. Cache flip + clearSession + navigate fire
    // before React can spin a re-render cascade between PlanReviewPage and
    // AppGate — both subscribe to the same onboarding-state query, and a
    // pre-this-fix async gap caused "Maximum update depth exceeded" when
    // they both reacted to status='completed' simultaneously.
    onSuccess: (_result, finalData) => {
      qc.setQueryData(queryKeys.onboarding.state, (old: OnboardingState | null | undefined) =>
        old
          ? { ...old, status: 'completed' as const, completed_at: new Date().toISOString() }
          : old,
      );
      clearOnboardingChatSessionId();
      navigate('/home', { replace: true, state: { fromOnboarding: true } });

      // Fire-and-forget side effects — PlanReviewPage has already unmounted.
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
      void useAuthStore.getState().updateProfile();

      // default-on prefs only deliver once OS permission granted; /enable-permissions isn't in the flow
      void (async () => {
        if (!isLocalRemindersSupported()) return;
        const granted = await requestLocalNotificationPermission();
        track('grant_notification_permission', { granted });
        if (!granted) return;
        await ensureExactAlarmPermission();
        await rescheduleFromSnapshot();
        // register FCM token for server pushes (Android only; iOS no-ops) —
        // local-notif permission alone never registers with FirebaseMessaging
        await requestPushPermissionAndRegister();
      })();
    },
    // Previously had no onError. A failed completeOnboarding() call left the
    // user staring at a spinner with no signal — the cache never flipped, so
    // PlanReviewPage didn't navigate to /home and the overlay stayed up. Now
    // we surface the error so they can retry by tapping Start plan again.
    onError: (err) => {
      Sentry.captureException(err, {
        tags: { flow: 'onboarding', step: '7-complete' },
      });
      addToast('error', "Couldn't finish setup — please try again.");
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
    // Exposed so PlanReviewPage can reset its single-fire autoCompletedRef
    // when completion fails — otherwise voice-retry ("let's go" again) is
    // silently ignored after the first attempt and the user can only retry
    // by tap.
    completeError: completeMutation.error,
    saveStep,
    saveStepAsync,
    complete,
  };
}
