import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  inferSchedule,
  SCHEDULE_DAYS,
  toggleSetItem,
  WEEKDAYS,
} from '@/components/onboarding/constants';
import { DailyReflectionCard } from '@/components/onboarding/DailyReflectionCard';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import type { ScheduleOption } from '@/components/onboarding/SchedulePicker';
import { type OnboardingVoiceResult } from '@/contexts/useOnboardingVoiceSession';
import { useAgentNavigation } from '@/hooks/useAgentNavigation';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useOnboardingFormSnapshot } from '@/hooks/useOnboardingFormSnapshot';
import { Sentry } from '@/lib/sentry';
import { DEFAULT_REFLECTION_PROMPTS } from '@gg/shared/types';
import { useCtaLoading } from '../shared/useCtaLoading';
import { useStepTiming } from '../shared/useStepTiming';

export function Step6Page() {
  const navigate = useNavigate();
  const location = useLocation();
  const { state: onboardingState, saveStepAsync } = useOnboarding();

  useAgentNavigation(6, '/onboarding/step-7');
  const trackStepComplete = useStepTiming(8, 'configure_journal', 'beginner');
  const state = location.state as {
    habitConfigs?: Record<
      string,
      { days: number[] | Set<number>; time: string; reminder: boolean }
    >;
    goals?: string[];
    category?: string;
    reflectionConfig?: {
      time: string;
      days: number[];
      reminder: boolean;
      schedule: ScheduleOption;
    };
  } | null;
  // Voice auto-nav lands here with no location.state; the manual Continue
  // button populates it. Persisted onboarding state (written by submit_*
  // tools before the user got here) is the reliable source for the carry-
  // through fields used by PlanReviewPage downstream.
  const persistedData = onboardingState?.data as Record<string, unknown> | undefined;
  const resolvedHabitConfigs =
    (persistedData?.habitConfigs as
      | Record<string, { days: number[] | Set<number>; time: string; reminder: boolean }>
      | undefined) ?? state?.habitConfigs;
  const resolvedGoals = (persistedData?.goals as string[] | undefined) ?? state?.goals;
  const resolvedCategory = (persistedData?.category as string | undefined) ?? state?.category;

  const incoming = state?.reflectionConfig;
  const [time, setTime] = useState(incoming?.time ?? '21:45');
  const [days, setDays] = useState<Set<number>>(
    incoming?.days ? new Set(incoming.days) : new Set(WEEKDAYS),
  );
  const [reminder, setReminder] = useState(incoming?.reminder ?? true);
  const [schedule, setSchedule] = useState<ScheduleOption>(incoming?.schedule ?? 'Weekday');
  const [selectedPrompts, setSelectedPrompts] = useState<string[]>(DEFAULT_REFLECTION_PROMPTS);
  const userToggledPromptsRef = useRef(false);

  const handleTogglePrompt = useCallback((q: string) => {
    userToggledPromptsRef.current = true;
    setSelectedPrompts((prev) => {
      const has = prev.includes(q);
      // Keep at least one selected — a 0-question state just falls back to
      // defaults on the backend, which is confusing.
      if (has && prev.length === 1) return prev;
      return DEFAULT_REFLECTION_PROMPTS.filter((p) => (p === q ? !has : prev.includes(p)));
    });
  }, []);

  // Reflect a voice/persisted prompt selection on the pills — e.g. saying "keep
  // proud and forgive" deselects the dropped one, giving visible confirmation of
  // what was saved. A manual tap wins from then on (don't override the user).
  useEffect(() => {
    if (userToggledPromptsRef.current) return;
    const saved = onboardingState?.data?.customPrompts;
    if (Array.isArray(saved) && saved.length > 0) {
      const sel = DEFAULT_REFLECTION_PROMPTS.filter((p) => saved.includes(p));
      if (sel.length > 0) setSelectedPrompts(sel);
    }
  }, [onboardingState?.data?.customPrompts]);

  const isDefaultSelection =
    selectedPrompts.length === DEFAULT_REFLECTION_PROMPTS.length &&
    DEFAULT_REFLECTION_PROMPTS.every((p) => selectedPrompts.includes(p));

  useEffect(() => {
    if (onboardingState?.data?.reflectionConfig) {
      const saved = onboardingState.data.reflectionConfig as {
        time: string;
        days: number[];
        reminder: boolean;
        schedule: ScheduleOption;
      };
      setTime(saved.time);
      setDays(new Set(saved.days));
      setReminder(saved.reminder);
      setSchedule(saved.schedule);
    }
  }, [onboardingState?.data?.reflectionConfig]);

  function handleScheduleChange(value: ScheduleOption) {
    setSchedule(value);
    setDays(new Set(SCHEDULE_DAYS[value]));
  }

  function handleToggleDay(day: number) {
    setDays((prev) => {
      const next = toggleSetItem(prev, day);
      const matched = inferSchedule(next);
      setSchedule(matched ?? 'Weekday');
      return next;
    });
  }

  const snapshot = useOnboardingFormSnapshot({
    reflectionConfig: { time, days: [...days], reminder, schedule },
  });

  const handleVoiceAction = useCallback(
    (result: OnboardingVoiceResult) => {
      if (result.action !== 'set_reflection_config') return;
      const p = result.params as {
        time?: string;
        days?: number[];
        reminder?: boolean;
        schedule?: string;
      };
      if (typeof p.time === 'string' && /^\d{1,2}:\d{2}$/.test(p.time)) setTime(p.time);
      if (Array.isArray(p.days)) {
        const ds = p.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
        if (ds.length > 0) {
          setDays(new Set(ds));
          const matched = inferSchedule(new Set(ds));
          if (matched) setSchedule(matched);
        }
      }
      if (typeof p.reminder === 'boolean') setReminder(p.reminder);
      if (p.schedule === 'Weekday' || p.schedule === 'Weekend' || p.schedule === 'Every day') {
        handleScheduleChange(p.schedule);
      }
    },
    // handleScheduleChange is a fresh closure per render but only references
    // stable setState functions and module-level constants, so omitting it
    // from deps is safe — and including it would invalidate the useCallback
    // every render, defeating the memoization.

    [],
  );

  const handleOnNext = useCallback(async () => {
    try {
      if (!resolvedHabitConfigs) {
        throw new Error(
          'Step6: habitConfigs missing from both nav state and persisted data — previous steps did not save',
        );
      }
      const serializedConfigs = Object.fromEntries(
        Object.entries(resolvedHabitConfigs).map(([k, v]) => [
          k,
          { ...v, days: v.days instanceof Set ? [...v.days] : v.days },
        ]),
      );
      const reflectionConfig = { time, days: [...days], reminder, schedule };
      // Only assert the prompt selection when the user actually used the pills.
      // Otherwise preserve a mode/prompts choice made by voice or the -08 screen
      // (e.g. dictated custom prompts, or freeform) instead of clobbering it.
      await saveStepAsync(
        6,
        userToggledPromptsRef.current
          ? {
              reflectionConfig,
              reflectionMode: 'prompts',
              customPrompts: isDefaultSelection ? [] : selectedPrompts,
            }
          : { reflectionConfig },
      );
      trackStepComplete();
      navigate('/onboarding/step-7', {
        state: {
          habitConfigs: serializedConfigs,
          goals: resolvedGoals,
          category: resolvedCategory,
          reflectionConfig: { time, days: [...days], reminder, schedule },
        },
      });
    } catch (err) {
      Sentry.captureException(err, {
        tags: { flow: 'onboarding', step: '6' },
        extra: {
          hasHabitConfigs: !!resolvedHabitConfigs,
          hasGoals: !!resolvedGoals,
          hasCategory: !!resolvedCategory,
        },
      });
      throw err;
    }
  }, [
    resolvedHabitConfigs,
    resolvedGoals,
    resolvedCategory,
    time,
    days,
    reminder,
    schedule,
    selectedPrompts,
    isDefaultSelection,
    navigate,
    saveStepAsync,
    trackStepComplete,
  ]);

  const { loading: ctaLoading, run: handleNextCta } = useCtaLoading(handleOnNext);

  const handleCreatePrompts = useCallback(async () => {
    const reflectionConfig = { time, days: [...days], reminder, schedule };
    const serializedConfigs = resolvedHabitConfigs
      ? Object.fromEntries(
          Object.entries(resolvedHabitConfigs).map(([k, v]) => [
            k,
            { ...v, days: v.days instanceof Set ? [...v.days] : v.days },
          ]),
        )
      : undefined;
    try {
      // Don't seed the custom-prompt list with the selected classics — the
      // step-6-prompts screen is only for genuinely custom prompts.
      await saveStepAsync(6, { reflectionConfig });
    } catch (err) {
      Sentry.captureException(err, { tags: { flow: 'onboarding', step: '6-prompts' } });
    }
    navigate('/onboarding/step-6-prompts', {
      state: {
        habitConfigs: serializedConfigs,
        goals: resolvedGoals,
        category: resolvedCategory,
        reflectionConfig,
      },
    });
  }, [
    time,
    days,
    reminder,
    schedule,
    resolvedHabitConfigs,
    resolvedGoals,
    resolvedCategory,
    saveStepAsync,
    navigate,
  ]);

  return (
    <OnboardingLayout
      screenId="ONBOARD-BEGINNER-07"
      formSnapshot={snapshot}
      ctaLabel="Continue"
      ctaVariant="inline"
      showVoiceButton
      aiListeningPrompt='"When would you like to do your daily reflection?"'
      footerText="You can change these settings later in your profile."
      onNext={handleNextCta}
      ctaLoading={ctaLoading}
      onVoiceAction={handleVoiceAction}
      onBack={() =>
        navigate('/onboarding/step-5', {
          state: {
            goals: resolvedGoals,
            category: resolvedCategory,
            habitConfigs: resolvedHabitConfigs,
          },
        })
      }
    >
      <OnboardingHeader
        title="One last thing for your mind"
        subtitle="We highly recommend adding a quick daily reflection to track your mental progress."
      />

      <DailyReflectionCard
        time={time}
        onTimeChange={setTime}
        days={days}
        onToggleDay={handleToggleDay}
        reminder={reminder}
        onToggleReminder={setReminder}
        schedule={schedule}
        onScheduleChange={handleScheduleChange}
        prompts={DEFAULT_REFLECTION_PROMPTS}
        selectedPrompts={selectedPrompts}
        onTogglePrompt={handleTogglePrompt}
        onCreatePrompts={() => {
          void handleCreatePrompts();
        }}
      />
    </OnboardingLayout>
  );
}
