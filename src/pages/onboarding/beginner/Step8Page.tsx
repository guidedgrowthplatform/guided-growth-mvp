import { useCallback, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { SelectionCard } from '@/components/onboarding/SelectionCard';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useOnboardingRealtimeScreen } from '@/hooks/useOnboardingRealtimeScreen';

/**
 * ONBOARD-08 — Evening Reflection Setup (MANDATORY).
 *
 * Per Yair spreadsheet: reflection is mandatory. User picks ONE of three
 * styles: guided (recommended), custom, or freeform. Then auto-navs to
 * ONBOARD-09 (final plan).
 */
type ReflectionStyle = 'guided' | 'custom' | 'freeform';

interface Step8State {
  habitConfigs?: Record<string, unknown>;
  goals?: string[];
  category?: string;
  reflectionConfig?: Record<string, unknown>;
}

export function Step8Page() {
  const navigate = useNavigate();
  const location = useLocation();
  const { saveStepAsync } = useOnboarding();
  const state = location.state as Step8State | null;
  const [style, setStyle] = useState<ReflectionStyle | null>(null);

  useOnboardingRealtimeScreen({
    screen: 'onboard_08',
    onFieldCaptured: (field, value) => {
      if (field !== 'reflection_style' && field !== 'journal_style') return;
      const v = value.toLowerCase();
      if (v.includes('guided') || v.includes('recommend') || v.includes('questions')) {
        setStyle('guided');
      } else if (v.includes('custom') || v.includes('own') || v.includes('my ')) {
        setStyle('custom');
      } else if (v.includes('free') || v.includes('blank') || v.includes('just write')) {
        setStyle('freeform');
      }
    },
    onNavigate: async (dest) => {
      const chosen = style ?? 'guided';
      await saveStepAsync(8, {
        reflectionStyle: chosen,
        journal_configured: true,
      });
      navigate(dest ?? '/onboarding/step-9', {
        state: { ...state, reflectionStyle: chosen, journal_configured: true },
        replace: true,
      });
    },
  });

  const handleNext = useCallback(async () => {
    const chosen = style ?? 'guided';
    await saveStepAsync(8, {
      reflectionStyle: chosen,
      journal_configured: true,
    });
    navigate('/onboarding/step-9', {
      state: { ...state, reflectionStyle: chosen, journal_configured: true },
    });
  }, [style, state, navigate, saveStepAsync]);

  return (
    <OnboardingLayout
      currentStep={8}
      totalSteps={9}
      ctaLabel="Continue"
      ctaVariant="inline"
      ctaDisabled={!style}
      onNext={handleNext}
      onBack={() => navigate('/onboarding/step-7', { state })}
    >
      <OnboardingHeader
        title="Your evening reflection"
        subtitle="This is mandatory — and powerful. Pick a style that feels right."
      />

      <div className="flex flex-col gap-[16px]">
        <SelectionCard
          icon="ic:outline-question-answer"
          iconBg="#E2E8F0"
          iconColor="rgb(var(--color-primary))"
          title="Guided prompts"
          description="I'll ask you three simple questions each evening. You just answer. Recommended."
          selected={style === 'guided'}
          onSelect={() => setStyle('guided')}
        />
        <SelectionCard
          icon="ic:outline-edit-note"
          iconBg="#E2E8F0"
          iconColor="#8B5CF6"
          title="Custom prompts"
          description="Write your own reflection questions. You set the theme."
          selected={style === 'custom'}
          onSelect={() => setStyle('custom')}
        />
        <SelectionCard
          icon="ic:outline-text-snippet"
          iconBg="#E2E8F0"
          iconColor="#10B981"
          title="Freeform"
          description="Just a blank page. Write whatever comes to mind."
          selected={style === 'freeform'}
          onSelect={() => setStyle('freeform')}
        />
      </div>
    </OnboardingLayout>
  );
}
