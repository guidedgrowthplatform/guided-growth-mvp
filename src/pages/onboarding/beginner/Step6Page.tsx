import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  WEEKDAYS,
  WEEKEND,
  ALL_DAYS,
  toggleSetItem,
  setsEqual,
} from '@/components/onboarding/constants';
import { DailyReflectionCard } from '@/components/onboarding/DailyReflectionCard';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import type { ScheduleOption } from '@/components/onboarding/SchedulePicker';
import { useAgentNavigation } from '@/hooks/useAgentNavigation';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useOnboardingFormSnapshot } from '@/hooks/useOnboardingFormSnapshot';
import { type OnboardingVoiceResult } from '@/hooks/useOnboardingVoice';
import { Sentry } from '@/lib/sentry';
import { useStepTiming } from '../shared/useStepTiming';

const SCHEDULE_DAYS: Record<ScheduleOption, Set<number>> = {
  Weekday: WEEKDAYS,
  Weekend: WEEKEND,
  'Every day': ALL_DAYS,
};

function inferSchedule(days: Set<number>): ScheduleOption | null {
  for (const [label, preset] of Object.entries(SCHEDULE_DAYS)) {
    if (setsEqual(days, preset)) return label as ScheduleOption;
  }
  return null;
}

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

  const incoming = state?.reflectionConfig;
  const [time, setTime] = useState(incoming?.time ?? '21:45');
  const [days, setDays] = useState<Set<number>>(
    incoming?.days ? new Set(incoming.days) : new Set(WEEKDAYS),
  );
  const [reminder, setReminder] = useState(incoming?.reminder ?? true);
  const [schedule, setSchedule] = useState<ScheduleOption>(incoming?.schedule ?? 'Weekday');

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
      if (!state?.habitConfigs) {
        throw new Error(
          'Step6: habitConfigs missing from navigation state — previous steps did not pass data forward',
        );
      }
      const serializedConfigs = Object.fromEntries(
        Object.entries(state.habitConfigs).map(([k, v]) => [
          k,
          { ...v, days: v.days instanceof Set ? [...v.days] : v.days },
        ]),
      );
      await saveStepAsync(6, { reflectionConfig: { time, days: [...days], reminder, schedule } });
      trackStepComplete();
      navigate('/onboarding/step-7', {
        state: {
          habitConfigs: serializedConfigs,
          goals: state?.goals,
          category: state?.category,
          reflectionConfig: { time, days: [...days], reminder, schedule },
        },
      });
    } catch (err) {
      Sentry.captureException(err, {
        tags: { flow: 'onboarding', step: '6' },
        extra: {
          hasHabitConfigs: !!state?.habitConfigs,
          hasGoals: !!state?.goals,
          hasCategory: !!state?.category,
        },
      });
      throw err;
    }
  }, [state, time, days, reminder, schedule, navigate, saveStepAsync, trackStepComplete]);

  return (
    <OnboardingLayout
      currentStep={6}
      screenId="ONBOARD-BEGINNER-07"
      formSnapshot={snapshot}
      ctaLabel="Review My Plan"
      ctaVariant="inline"
      showVoiceButton
      aiListeningPrompt='"When would you like to do your daily reflection?"'
      footerText="You can change these settings later in your profile."
      onNext={handleOnNext}
      onVoiceAction={handleVoiceAction}
      onBack={() =>
        navigate('/onboarding/step-5', {
          state: {
            goals: state?.goals,
            category: state?.category,
            habitConfigs: state?.habitConfigs,
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
      />
    </OnboardingLayout>
  );
}
