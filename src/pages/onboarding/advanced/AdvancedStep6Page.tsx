import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ALL_DAYS,
  formatCadence,
  toggleSetItem,
  WEEKDAYS,
  WEEKEND,
} from '@/components/onboarding/constants';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { DayPicker } from '@/components/ui/DayPicker';
import {
  useOnboardingVoice,
  type OnboardingVoiceResult,
} from '@/contexts/useOnboardingVoiceSession';
import { useAgentNavigation } from '@/hooks/useAgentNavigation';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useOnboardingFormSnapshot } from '@/hooks/useOnboardingFormSnapshot';
import { DEFAULT_REFLECTION_PROMPTS } from '@gg/shared/types';
import { useCtaLoading } from '../shared/useCtaLoading';
import { useStepTiming } from '../shared/useStepTiming';

// String labels (persisted / voice) → day set
function daysFromScheduleLabel(label: string): Set<number> | null {
  const lower = label.toLowerCase();
  if (lower.includes('weekday')) return new Set(WEEKDAYS);
  if (lower.includes('weekend')) return new Set(WEEKEND);
  if (lower.includes('every') || lower.includes('daily')) return new Set(ALL_DAYS);
  return null;
}

interface LocationState {
  habitConfigs?: Array<{ name: string; days: number[] }>;
  customPrompts?: string[];
  journalMode?: 'freeform' | 'custom';
}

export function AdvancedStep6Page() {
  const navigate = useNavigate();
  const location = useLocation();
  const { state: onboardingState, saveStepAsync } = useOnboarding();
  const onboardingVoice = useOnboardingVoice();
  const state = location.state as LocationState | null;

  useAgentNavigation(5, '/onboarding/step-7');
  const trackStepComplete = useStepTiming(7, 'advanced_journal_setup', 'advanced');

  const [selectedDays, setSelectedDays] = useState<Set<number>>(new Set(WEEKDAYS));
  const customPrompts = state?.customPrompts ?? onboardingState?.data?.customPrompts ?? null;

  const habitConfigs =
    state?.habitConfigs ?? (onboardingState?.data?.habitConfigs as LocationState['habitConfigs']);

  // Vapi + Direct-LLM context for the reflection-setup screen.
  useEffect(() => {
    if (!onboardingVoice) return;
    onboardingVoice.pushSubScreen('ONBOARD-ADVANCED-04');
    return () => onboardingVoice.pushSubScreen(null);
  }, [onboardingVoice]);

  // Rehydrate day selection: full-fidelity days first, cadence label as fallback.
  useEffect(() => {
    const cfg = onboardingState?.data?.reflectionConfig;
    if (cfg?.days?.length) {
      setSelectedDays(new Set(cfg.days));
      return;
    }
    const incoming = onboardingState?.data?.reflectionSchedule;
    if (typeof incoming === 'string') {
      const days = daysFromScheduleLabel(incoming);
      if (days) setSelectedDays(days);
    }
  }, [onboardingState?.data?.reflectionConfig, onboardingState?.data?.reflectionSchedule]);

  const questions = customPrompts ?? DEFAULT_REFLECTION_PROMPTS;

  const snapshot = useOnboardingFormSnapshot({
    reflectionSchedule: formatCadence(selectedDays),
    customPrompts: customPrompts ?? undefined,
  });

  const handleToggleDay = useCallback((day: number) => {
    setSelectedDays((prev) => toggleSetItem(prev, day));
  }, []);

  const handleVoiceAction = useCallback((result: OnboardingVoiceResult) => {
    if (result.action === 'select_option') {
      const p = result.params as { fieldName?: string; value?: string };
      if (p.fieldName !== 'reflectionSchedule' || typeof p.value !== 'string') return;
      const days = daysFromScheduleLabel(p.value);
      if (days) setSelectedDays(days);
      return;
    }
    if (result.action === 'set_reflection_config') {
      const p = result.params as { schedule?: string; days?: number[] };
      if (Array.isArray(p.days)) {
        const valid = p.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
        if (valid.length > 0) {
          setSelectedDays(new Set(valid));
          return;
        }
      }
      if (typeof p.schedule === 'string') {
        const days = daysFromScheduleLabel(p.schedule);
        if (days) setSelectedDays(days);
      }
    }
  }, []);

  const handleReviewPlan = useCallback(async () => {
    const configRecord: Record<string, { days: number[]; time: string; reminder: boolean }> = {};
    if (habitConfigs) {
      for (const h of habitConfigs) {
        configRecord[h.name] = { days: h.days, time: '21:45', reminder: true };
      }
    }
    const days = [...selectedDays];
    const reflectionConfig = {
      time: '21:45',
      days,
      reminder: true,
      schedule: formatCadence(selectedDays),
    };
    await saveStepAsync(5, { habitConfigs: configRecord, reflectionConfig });
    trackStepComplete();
    navigate('/onboarding/step-7', {
      state: {
        habitConfigs: configRecord,
        reflectionConfig,
        source: 'advanced',
      },
    });
  }, [habitConfigs, selectedDays, navigate, saveStepAsync, trackStepComplete]);

  const { loading: ctaLoading, run: handleNextCta } = useCtaLoading(handleReviewPlan);

  return (
    <OnboardingLayout
      screenId="ONBOARD-ADVANCED-04"
      formSnapshot={snapshot}
      ctaLabel="Continue"
      onBack={() => navigate('/onboarding/advanced-results')}
      onNext={handleNextCta}
      ctaLoading={ctaLoading}
      showVoiceButton
      onVoiceAction={handleVoiceAction}
    >
      <OnboardingHeader
        title="Your daily reflection"
        subtitle="Choose how you would like to reflect each day"
      />

      <div className="flex flex-col gap-[20px] rounded-[16px] border border-primary/10 bg-surface p-[24px] shadow-[0px_0px_30px_0px_rgba(19,91,236,0.15)]">
        <div className="flex flex-col gap-[12px]">
          <span className="text-[14px] font-semibold uppercase leading-[20px] tracking-[0.7px] text-content-secondary">
            You'll answer {questions.length} quick questions:
          </span>
          {questions.map((q, i) => (
            <div key={i} className="rounded-[16px] bg-surface-secondary p-[12px]">
              <span className="text-[15px] font-medium leading-[22.5px] text-content">{q}</span>
            </div>
          ))}
        </div>

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
          className="w-full rounded-full border-2 border-primary py-[14px] text-center text-[16px] font-bold text-primary"
        >
          Optional: Create My Own Prompts
        </button>

        <div className="flex flex-col gap-[8px]">
          <span className="text-[14px] font-semibold uppercase leading-[20px] tracking-[0.7px] text-content-secondary">
            Schedule:
          </span>
          <DayPicker selectedDays={selectedDays} onToggleDay={handleToggleDay} />
        </div>
      </div>
    </OnboardingLayout>
  );
}
