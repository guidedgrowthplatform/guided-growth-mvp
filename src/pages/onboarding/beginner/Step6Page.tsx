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
import { useOnboarding } from '@/hooks/useOnboarding';
import { type OnboardingVoiceResult } from '@/hooks/useOnboardingVoice';

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

  const handleVoiceAction = useCallback((result: OnboardingVoiceResult) => {
    if (result.params) {
      if (typeof result.params.time === 'string') {
        setTime(result.params.time);
      }
      if (typeof result.params.schedule === 'string') {
        const scheduleStr = result.params.schedule.toLowerCase();
        if (scheduleStr.includes('weekday')) {
          handleScheduleChange('Weekday');
        } else if (scheduleStr.includes('weekend')) {
          handleScheduleChange('Weekend');
        } else if (scheduleStr.includes('every') || scheduleStr.includes('daily')) {
          handleScheduleChange('Every day');
        }
      }
    }
  }, []);

  const handleOnNext = useCallback(async () => {
    const serializedConfigs = state?.habitConfigs
      ? Object.fromEntries(
          Object.entries(state.habitConfigs).map(([k, v]) => [
            k,
            { ...v, days: v.days instanceof Set ? [...v.days] : v.days },
          ]),
        )
      : undefined;
    await saveStepAsync(6, { reflectionConfig: { time, days: [...days], reminder, schedule } });
    navigate('/onboarding/step-7', {
      state: {
        habitConfigs: serializedConfigs,
        goals: state?.goals,
        category: state?.category,
        reflectionConfig: { time, days: [...days], reminder, schedule },
      },
    });
  }, [state, time, days, reminder, schedule, navigate, saveStepAsync]);

  return (
    <OnboardingLayout
      currentStep={6}
      totalSteps={7}
      ctaLabel="Review My Plan"
      ctaVariant="inline"
      showVoiceButton
      aiListeningPrompt='"When would you like to do your daily reflection?"'
      footerText="You can change these settings later in your profile."
      onNext={handleOnNext}
      onBack={() =>
        navigate('/onboarding/step-5', {
          state: {
            goals: state?.goals,
            category: state?.category,
            habitConfigs: state?.habitConfigs,
          },
        })
      }
      voiceOptions={['Weekday', 'Weekend', 'Every day', '9 PM', '10 PM', '8 PM']}
      voicePrompt="Now, let's set up your daily reflection. Do you want to use my guided prompts, or do you prefer to write freely? You can also tell me when and how often you'd like to reflect."
      onVoiceAction={handleVoiceAction}
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
