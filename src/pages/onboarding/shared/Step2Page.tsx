import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { SelectionCard } from '@/components/onboarding/SelectionCard';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useOnboardingRealtimeScreen } from '@/hooks/useOnboardingRealtimeScreen';

/**
 * ONBOARD-02 — Experience Fork.
 *
 * Per Yair Phase 1 spec (Section 2.5): agent asks whether the user has
 * tracked habits before. User says 'new' / 'experienced' / 'brain dump';
 * agent calls `update_onboarding_data(field='path', value=...)` then
 * `navigate_next(from_screen='onboard_02', path=...)`. The realtime hook
 * takes the `path` arg into account and routes to either `/onboarding/step-3`
 * (beginner) or `/onboarding/advanced-input` (brain-dump).
 */
export function Step2Page() {
  const navigate = useNavigate();
  const { state: onboardingState, saveStepAsync } = useOnboarding();
  const [plan, setPlan] = useState<'simple' | 'braindump' | null>(null);

  useEffect(() => {
    if (onboardingState?.path) {
      setPlan(onboardingState.path as 'simple' | 'braindump');
    }
  }, [onboardingState?.path]);

  useOnboardingRealtimeScreen({
    screen: 'onboard_02',
    onFieldCaptured: (field, value) => {
      if (field !== 'path') return;
      const v = value.toLowerCase();
      if (v.includes('simple') || v.includes('new') || v.includes('beginner')) {
        setPlan('simple');
      } else if (
        v.includes('brain') ||
        v.includes('advanced') ||
        v.includes('experience') ||
        v.includes('dump')
      ) {
        setPlan('braindump');
      }
    },
    onNavigate: async (dest, args) => {
      const path = (args.path as string | undefined) ?? plan ?? 'simple';
      await saveStepAsync(2, {}, { path: path as 'simple' | 'braindump' });
      const target =
        path === 'braindump' ? '/onboarding/advanced-input' : (dest ?? '/onboarding/step-3');
      navigate(target, { replace: true });
    },
  });

  const handleNext = useCallback(async () => {
    await saveStepAsync(2, {}, { path: plan as 'simple' | 'braindump' });
    if (plan === 'braindump') {
      navigate('/onboarding/advanced-input');
    } else {
      navigate('/onboarding/step-3');
    }
  }, [plan, navigate, saveStepAsync]);

  return (
    <OnboardingLayout
      currentStep={2}
      totalSteps={7}
      ctaLabel="Continue"
      ctaVariant="inline"
      ctaDisabled={!plan}
      onNext={handleNext}
      onBack={() => navigate('/onboarding')}
    >
      <OnboardingHeader
        title="Let's build your plan."
        subtitle="How would you like to set up your habits today?"
      />
      <div className="flex flex-col gap-[20px]">
        <SelectionCard
          icon="ic:outline-explore"
          iconBg="#E2E8F0"
          iconColor="rgb(var(--color-primary))"
          title="I'm new to habit tracking"
          description="Start with a few recommended habits"
          selected={plan === 'simple'}
          onSelect={() => setPlan('simple')}
        />
        <SelectionCard
          icon="ic:round-mic"
          iconBg="#E2E8F0"
          iconColor="#8B5CF6"
          title="I already have experience with habit tracking"
          description="Tell me everything you want to achieve, and I'll organize it"
          selected={plan === 'braindump'}
          onSelect={() => setPlan('braindump')}
        />
      </div>
    </OnboardingLayout>
  );
}
