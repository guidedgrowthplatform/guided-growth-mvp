import { Icon } from '@iconify/react';
import { useCallback, useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { WEEKDAYS, WEEKEND, ALL_DAYS } from '@/components/onboarding/constants';
import { OnboardingProgress } from '@/components/onboarding/OnboardingProgress';
import {
  OnboardingVoiceOverlay,
  type VoiceMessage,
} from '@/components/onboarding/OnboardingVoiceOverlay';
import type { ScheduleOption } from '@/components/onboarding/SchedulePicker';
import { useOnboarding } from '@/hooks/useOnboarding';
import type { OnboardingVoiceResult } from '@/hooks/useOnboardingVoice';

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
  const { saveStepAsync } = useOnboarding();
  const state = location.state as LocationState | null;

  const [schedule, setSchedule] = useState<ScheduleOption>('Weekday');
  const [showDropdown, setShowDropdown] = useState(false);
  const [customPrompts] = useState<string[] | null>(state?.customPrompts ?? null);
  const [showVoiceOverlay, setShowVoiceOverlay] = useState(false);
  const [voiceMessages, setVoiceMessages] = useState<VoiceMessage[]>([
    {
      id: 'greeting',
      role: 'ai',
      text: 'When should you reflect? Say "weekdays", "weekends", or "every day".',
    },
  ]);
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

  const handleVoiceAction = useCallback((result: OnboardingVoiceResult) => {
    if (result.params && typeof result.params.schedule === 'string') {
      const s = result.params.schedule.toLowerCase();
      if (s.includes('weekday')) setSchedule('Weekday');
      else if (s.includes('weekend')) setSchedule('Weekend');
      else if (s.includes('every') || s.includes('daily')) setSchedule('Every day');
    }
    setShowVoiceOverlay(false);
  }, []);

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
    <div className="flex min-h-dvh flex-col bg-surface-secondary">
      {/* Back Arrow */}
      <div className="px-6 pb-[32px] pt-[max(16px,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={() => navigate('/onboarding/advanced-results')}
          className="flex size-[40px] items-center justify-center"
        >
          <Icon icon="ic:round-arrow-back" width={16} height={16} className="text-content" />
        </button>
        <OnboardingProgress currentStep={5} totalSteps={6} />
      </div>

      {/* Heading + Subtitle */}
      <div className="flex flex-col gap-[11px] px-6 py-[16px]">
        <h1 className="text-[32px] font-bold leading-[40px] tracking-[-0.8px] text-content">
          Meet your AI Voice Journal
        </h1>
        <p className="text-[18px] font-medium leading-[29.25px] text-content-secondary">
          We will turn your voice into text and learn from it to personalize your coaching.
        </p>
      </div>

      {/* Daily Reflection Card */}
      <div className="mx-[24px] mt-[16px] flex flex-col gap-[8px] rounded-[16px] border border-primary/10 bg-white p-[25px] shadow-[0px_0px_30px_0px_rgba(19,91,236,0.15)]">
        {/* Card Header */}
        <div className="flex items-center gap-[12px] pb-[16px]">
          <div className="relative flex size-[40px] items-center justify-center rounded-full bg-primary/10">
            <Icon icon="mingcute:mic-fill" width={19} height={14} className="text-primary" />
            <span className="absolute right-[-4px] top-[-4px] text-[10px]">✨</span>
          </div>
          <span className="text-[20px] font-bold text-content">Daily Reflection</span>
        </div>

        {/* AI Badge */}
        <div className="flex items-center gap-[8px] rounded-[16px] bg-[#eef2ff] p-[12px]">
          <Icon icon="mingcute:mic-ai-fill" width={24} height={24} className="text-primary" />
          <span className="text-[14px] font-semibold leading-[20px] text-primary">
            Powered by AI Voice-to-Text. Just talk, we'll type.
          </span>
        </div>

        {/* Questions Section */}
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

        {/* Create Prompts Button */}
        <button
          type="button"
          onClick={() =>
            navigate('/onboarding/advanced-custom-prompts', {
              state: {
                habitConfigs,
                customPrompts,
                journalMode: customPrompts ? 'custom' : undefined,
              },
            })
          }
          className="flex h-[50px] items-center justify-center rounded-full border border-primary bg-white text-[16px] font-bold text-primary shadow-[0px_10px_15px_-3px_rgba(19,91,236,0.25),0px_4px_6px_-4px_rgba(19,91,236,0.25)]"
        >
          Optional: Create My Own Prompts
        </button>

        {/* Separator */}
        <div className="my-[16px] border-t border-border" />

        {/* Schedule Row */}
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
              <div className="absolute right-0 top-full z-10 mt-[4px] rounded-[12px] border border-border bg-white py-[4px] shadow-lg">
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

      {/* CTA Footer with Voice FAB */}
      <div className="mt-auto px-6 pb-[40px] pt-[32px]">
        <button
          type="button"
          onClick={() => setShowVoiceOverlay(true)}
          className="mb-4 flex h-[48px] w-full items-center justify-center gap-2 rounded-full border border-primary bg-white text-[14px] font-semibold text-primary shadow-[0px_4px_6px_-4px_rgba(19,91,236,0.25)]"
        >
          <Icon icon="ic:round-mic" width={18} height={18} />
          Set reflection schedule with voice
        </button>
        <button
          type="button"
          onClick={handleReviewPlan}
          className="h-[56px] w-full rounded-full bg-primary text-[18px] font-bold text-white shadow-[0px_10px_15px_-3px_rgba(10,37,64,0.25),0px_4px_6px_-4px_rgba(10,37,64,0.25)]"
        >
          Review My Plan
        </button>
      </div>

      {showVoiceOverlay && (
        <OnboardingVoiceOverlay
          stepContext={{
            step: 5,
            prompt: 'When should you reflect? Say "weekdays", "weekends", or "every day".',
            options: ['Weekday', 'Weekend', 'Every day'],
          }}
          onAction={handleVoiceAction}
          onClose={() => setShowVoiceOverlay(false)}
          messages={voiceMessages}
          setMessages={setVoiceMessages}
        />
      )}
    </div>
  );
}
