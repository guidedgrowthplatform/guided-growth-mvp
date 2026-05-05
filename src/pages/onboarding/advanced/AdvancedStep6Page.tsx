import { Icon } from '@iconify/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ALL_DAYS, WEEKDAYS, WEEKEND } from '@/components/onboarding/constants';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import type { ScheduleOption } from '@/components/onboarding/SchedulePicker';
import { useAgentNavigation } from '@/hooks/useAgentNavigation';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useOnboardingAgent } from '@/hooks/useOnboardingAgent';

const DEFAULT_QUESTIONS = [
  'What am I proud of today?',
  'What do I forgive myself for today?',
  'What am I grateful for today?',
];

const SCHEDULE_DAYS: Record<ScheduleOption, Set<number>> = {
  Weekday: WEEKDAYS,
  Weekend: WEEKEND,
  'Every day': ALL_DAYS,
};

const SCHEDULE_OPTIONS: ScheduleOption[] = ['Weekday', 'Weekend', 'Every day'];

interface LocationState {
  habitConfigs?: Array<{ name: string; days: number[] }>;
  customPrompts?: string[];
  journalMode?: 'freeform' | 'custom';
}

export function AdvancedStep6Page() {
  const navigate = useNavigate();
  const location = useLocation();
  const { state: onboardingState, saveStepAsync } = useOnboarding();
  const state = location.state as LocationState | null;

  useOnboardingAgent('onboard_advanced_step_6');
  useAgentNavigation(5, '/onboarding/step-7');

  const [schedule, setSchedule] = useState<ScheduleOption>('Weekday');
  const [showDropdown, setShowDropdown] = useState(false);
  const customPrompts = state?.customPrompts ?? onboardingState?.data?.customPrompts ?? null;
  const dropdownRef = useRef<HTMLDivElement>(null);

  const habitConfigs = state?.habitConfigs;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    if (showDropdown) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showDropdown]);

  useEffect(() => {
    const incoming = onboardingState?.data?.reflectionSchedule;
    if (typeof incoming !== 'string') return;
    const lower = incoming.toLowerCase();
    if (lower.includes('weekday')) setSchedule('Weekday');
    else if (lower.includes('weekend')) setSchedule('Weekend');
    else if (lower.includes('every') || lower.includes('daily')) setSchedule('Every day');
  }, [onboardingState?.data?.reflectionSchedule]);

  const questions = customPrompts ?? DEFAULT_QUESTIONS;

  const handleReviewPlan = useCallback(async () => {
    const configRecord: Record<string, { days: number[]; time: string; reminder: boolean }> = {};
    if (habitConfigs) {
      for (const h of habitConfigs) {
        configRecord[h.name] = { days: h.days, time: '21:45', reminder: true };
      }
    }
    const days = [...(SCHEDULE_DAYS[schedule] ?? WEEKDAYS)];
    const reflectionConfig = { time: '21:45', days, reminder: true, schedule };
    await saveStepAsync(5, { habitConfigs: configRecord, reflectionConfig });
    navigate('/onboarding/step-7', {
      state: {
        habitConfigs: configRecord,
        reflectionConfig,
        source: 'advanced',
      },
    });
  }, [habitConfigs, schedule, navigate, saveStepAsync]);

  return (
    <OnboardingLayout
      currentStep={6}
      ctaLabel="Final Step"
      onBack={() => navigate('/onboarding/advanced-results')}
      onNext={handleReviewPlan}
      showVoiceButton
      secondaryAction={{
        label: 'Optional: Create My Own Prompts',
        onClick: () =>
          navigate('/onboarding/advanced-custom-prompts', {
            state: {
              habitConfigs,
              customPrompts,
              journalMode: customPrompts ? 'custom' : undefined,
            },
          }),
      }}
    >
      <OnboardingHeader
        title="Meet your AI Voice Journal"
        subtitle="We will turn your voice into text and learn from it to personalize your coaching."
      />

      <div className="flex flex-col gap-[8px] rounded-[16px] border border-primary/10 bg-surface p-[25px] shadow-[0px_0px_30px_0px_rgba(19,91,236,0.15)]">
        <div className="flex items-center gap-[12px] pb-[16px]">
          <div className="relative flex size-[40px] items-center justify-center rounded-full bg-primary/10">
            <Icon icon="mingcute:mic-fill" width={19} height={14} className="text-primary" />
            <span className="absolute right-[-4px] top-[-4px] text-[10px]">✨</span>
          </div>
          <span className="text-[20px] font-bold text-content">Daily Reflection</span>
        </div>

        <div className="flex items-center gap-[8px] rounded-[16px] bg-primary-bg p-[12px]">
          <Icon icon="mingcute:mic-ai-fill" width={24} height={24} className="text-primary" />
          <span className="text-[14px] font-semibold leading-[20px] text-primary">
            Powered by AI Voice-to-Text. Just talk, we'll type.
          </span>
        </div>

        <div className="flex flex-col gap-[12px] pb-[24px] pt-[24px]">
          <span className="text-[14px] font-semibold uppercase leading-[20px] tracking-[0.7px] text-content-secondary">
            You'll answer {questions.length} quick questions:
          </span>
          {questions.map((q, i) => (
            <div key={i} className="rounded-[16px] bg-surface-secondary p-[12px]">
              <span className="text-[15px] font-medium leading-[22.5px] text-content">{q}</span>
            </div>
          ))}
        </div>

        <div className="my-[16px] border-t border-border" />

        <div className="flex items-center justify-between">
          <span className="text-[14px] font-semibold uppercase tracking-[0.7px] text-content-secondary">
            Schedule:
          </span>
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-[4px] rounded-full bg-border-light px-[16px] py-[8px]"
            >
              <span className="text-[14px] font-semibold text-content">
                {schedule === 'Every day' ? 'Daily' : schedule}
              </span>
              <Icon
                icon="ic:round-keyboard-arrow-down"
                width={8}
                height={5}
                className="text-content"
              />
            </button>
            {showDropdown && (
              <div className="absolute right-0 top-full z-10 mt-[4px] rounded-[12px] border border-border bg-surface py-[4px] shadow-lg">
                {SCHEDULE_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      setSchedule(opt);
                      setShowDropdown(false);
                    }}
                    className={`w-full px-[16px] py-[8px] text-left text-[14px] font-medium ${
                      schedule === opt ? 'text-primary' : 'text-content'
                    } hover:bg-border-light`}
                  >
                    {opt === 'Every day' ? 'Daily' : opt}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </OnboardingLayout>
  );
}
