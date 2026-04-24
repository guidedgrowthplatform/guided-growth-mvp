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
import { useOnboardingAgent } from '@/hooks/useOnboardingAgent';
import { type OnboardingVoiceResult } from '@/hooks/useOnboardingVoice';
import { Sentry } from '@/lib/sentry';

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

  // Step6Page maps to ONBOARD-08 (journal setup) in the spec numbering;
  // the agent metadata uses the sheet's canonical id so screen_contexts
  // lookups land on the right row.
  useOnboardingAgent('onboard_08');

  // ONBOARD-08 (journal setup) → step-7 (plan review) on agent advance.
  useAgentNavigation(6, '/onboarding/step-7');
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
  }, [state, time, days, reminder, schedule, navigate, saveStepAsync]);

  return (
    <OnboardingLayout
      currentStep={6}
      totalSteps={7}
      ctaLabel="Review My Plan"
      ctaVariant="inline"
      showVoiceButton
      aiListeningPrompt='"When would you like to do your daily reflection?"'
      voiceFileId="ONBOARD-08"
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
      voicePrompt="One more thing — and this one's powerful. A daily reflection. Three questions. Two minutes. And it compounds over time in a way that surprises people. What you're proud of. What you forgive yourself for. What you're grateful for. These three questions rewire how you process your day. You'll feel the difference within a week. Want to add it?"
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
