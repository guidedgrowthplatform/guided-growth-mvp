import { Icon } from '@iconify/react';
import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { WEEKDAYS, WEEKEND, ALL_DAYS } from '@/components/onboarding/constants';
import type { ScheduleOption } from '@/components/onboarding/SchedulePicker';

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
  const state = location.state as LocationState | null;

  const [schedule, setSchedule] = useState<ScheduleOption>('Weekday');
  const [showDropdown, setShowDropdown] = useState(false);
  const [customPrompts] = useState<string[] | null>(state?.customPrompts ?? null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const habitConfigs = state?.habitConfigs;

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    if (showDropdown) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showDropdown]);

  const questions = customPrompts ?? DEFAULT_QUESTIONS;

  function handleReviewPlan() {
    // Convert habitConfigs array to Record format for Step7
    const configRecord: Record<string, { days: number[]; time: string; reminder: boolean }> = {};
    if (habitConfigs) {
      for (const h of habitConfigs) {
        configRecord[h.name] = { days: h.days, time: '21:45', reminder: true };
      }
    }

    const days = [...(SCHEDULE_DAYS[schedule] ?? WEEKDAYS)];

    navigate('/onboarding/step-7', {
      state: {
        habitConfigs: configRecord,
        reflectionConfig: { time: '21:45', days, reminder: true, schedule },
        source: 'advanced',
      },
    });
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[#f9f9f9]">
      {/* Back Arrow */}
      <div className="px-[24px] pb-[32px] pt-[max(16px,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={() => navigate('/onboarding/advanced-results')}
          className="flex size-[40px] items-center justify-center"
        >
          <Icon icon="ic:round-arrow-back" width={16} height={16} className="text-[#0f172a]" />
        </button>
      </div>

      {/* Heading + Subtitle */}
      <div className="flex flex-col gap-[11px] px-[24px] py-[16px]">
        <h1 className="text-[32px] font-bold leading-[40px] tracking-[-0.8px] text-[#0a2540]">
          Meet your AI Voice Journal
        </h1>
        <p className="text-[18px] font-medium leading-[29.25px] text-[#64748b]">
          We will turn your voice into text and learn from it to personalize your coaching.
        </p>
      </div>

      {/* Daily Reflection Card */}
      <div className="mx-[24px] mt-[16px] flex flex-col gap-[8px] rounded-[16px] border border-[rgba(19,91,236,0.1)] bg-white p-[25px] shadow-[0px_0px_30px_0px_rgba(19,91,236,0.15)]">
        {/* Card Header */}
        <div className="flex items-center gap-[12px] pb-[16px]">
          <div className="relative flex size-[40px] items-center justify-center rounded-full bg-[rgba(19,91,236,0.1)]">
            <Icon icon="mingcute:mic-fill" width={19} height={14} className="text-[#135bec]" />
            <span className="absolute right-[-4px] top-[-4px] text-[10px]">✨</span>
          </div>
          <span className="text-[20px] font-bold text-[#0a2540]">Daily Reflection</span>
        </div>

        {/* AI Badge */}
        <div className="flex items-center gap-[8px] rounded-[16px] bg-[#eef2ff] p-[12px]">
          <Icon icon="mingcute:mic-ai-fill" width={24} height={24} className="text-[#135bec]" />
          <span className="text-[14px] font-semibold leading-[20px] text-[#135bec]">
            Powered by AI Voice-to-Text. Just talk, we'll type.
          </span>
        </div>

        {/* Questions Section */}
        <div className="flex flex-col gap-[12px] pb-[24px] pt-[24px]">
          <span className="text-[14px] font-semibold uppercase leading-[20px] tracking-[0.7px] text-[#64748b]">
            You'll answer {questions.length} quick questions:
          </span>
          {questions.map((q, i) => (
            <div key={i} className="rounded-[16px] bg-[#f9fafb] p-[12px]">
              <span className="text-[15px] font-medium leading-[22.5px] text-[#0a2540]">{q}</span>
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
          className="flex h-[50px] items-center justify-center rounded-full border border-[#135bec] bg-white text-[16px] font-bold text-[#135bec] shadow-[0px_10px_15px_-3px_rgba(19,91,236,0.25),0px_4px_6px_-4px_rgba(19,91,236,0.25)]"
        >
          Optional: Create My Own Prompts
        </button>

        {/* Separator */}
        <div className="my-[16px] border-t border-[#e5e7eb]" />

        {/* Schedule Row */}
        <div className="flex items-center justify-between">
          <span className="text-[14px] font-semibold uppercase tracking-[0.7px] text-[#64748b]">
            Schedule:
          </span>
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-[4px] rounded-full bg-[#f1f5f9] px-[16px] py-[8px]"
            >
              <span className="text-[14px] font-semibold text-[#0a2540]">
                {schedule === 'Every day' ? 'Daily' : schedule}
              </span>
              <Icon
                icon="ic:round-keyboard-arrow-down"
                width={8}
                height={5}
                className="text-[#0a2540]"
              />
            </button>
            {showDropdown && (
              <div className="absolute right-0 top-full z-10 mt-[4px] rounded-[12px] border border-[#e2e8f0] bg-white py-[4px] shadow-lg">
                {SCHEDULE_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      setSchedule(opt);
                      setShowDropdown(false);
                    }}
                    className={`w-full px-[16px] py-[8px] text-left text-[14px] font-medium ${
                      schedule === opt ? 'text-[#135bec]' : 'text-[#0a2540]'
                    } hover:bg-[#f1f5f9]`}
                  >
                    {opt === 'Every day' ? 'Daily' : opt}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Voice Button */}
      <div className="flex justify-center py-[32px]">
        <div className="rounded-full shadow-[0px_0px_0px_12px_rgba(19,91,236,0.05),0px_0px_0px_24px_rgba(19,91,236,0.02)]">
          <button
            type="button"
            className="flex size-[96px] items-center justify-center rounded-full bg-[#135bec] shadow-[0px_10px_15px_-3px_rgba(19,91,236,0.3),0px_4px_6px_-4px_rgba(19,91,236,0.3)]"
          >
            <Icon icon="ic:round-mic" width={24} height={24} className="text-white" />
          </button>
        </div>
      </div>

      {/* CTA Footer */}
      <div className="mt-auto px-[24px] pb-[40px] pt-[32px]">
        <button
          type="button"
          onClick={handleReviewPlan}
          className="h-[56px] w-full rounded-full bg-[#135bec] text-[18px] font-bold text-white shadow-[0px_10px_15px_-3px_rgba(10,37,64,0.25),0px_4px_6px_-4px_rgba(10,37,64,0.25)]"
        >
          Review My Plan
        </button>
      </div>
    </div>
  );
}
