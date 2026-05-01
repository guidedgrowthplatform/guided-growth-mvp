import { useCallback, useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { track } from '@/analytics';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { SelectionCard } from '@/components/onboarding/SelectionCard';
import { useAgentNavigation } from '@/hooks/useAgentNavigation';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useOnboardingAgent } from '@/hooks/useOnboardingAgent';

// PostHog spec v6.0 §3.3 names the two paths beginner/advanced. Internal
// store uses simple/braindump for historical reasons — translate at the
// analytics boundary, not in the store, so the store stays decoupled
// from spec wording.
function pathToSpec(plan: 'simple' | 'braindump'): 'beginner' | 'advanced' {
  return plan === 'simple' ? 'beginner' : 'advanced';
}

export function Step2Page() {
  const navigate = useNavigate();
  const { state: onboardingState, saveStepAsync } = useOnboarding();
  const [plan, setPlan] = useState<'simple' | 'braindump' | null>(null);

  const { startVoice } = useOnboardingAgent('onboard_02');

  useEffect(() => {
    if (onboardingState?.path) {
      setPlan(onboardingState.path as 'simple' | 'braindump');
    }
  }, [onboardingState?.path]);

  // null defers navigation until path is set so we route to the right fork.
  useAgentNavigation(
    2,
    plan === 'braindump'
      ? '/onboarding/advanced-input'
      : plan === 'simple'
        ? '/onboarding/step-3'
        : null,
  );

  const submittingRef = useRef(false);
  const handleNext = useCallback(async () => {
    if (!plan || submittingRef.current) return;
    submittingRef.current = true;
    try {
      await saveStepAsync(2, {}, { path: plan });
      track('select_onboarding_path', { path: pathToSpec(plan) });
      track('complete_onboarding_step', { step_number: 2, step_name: 'onboarding_path', input_method: 'manual' });
      if (plan === 'braindump') {
        navigate('/onboarding/advanced-input');
      } else {
        navigate('/onboarding/step-3');
      }
    } catch (e) {
      submittingRef.current = false;
      throw e;
    }
  }, [plan, navigate, saveStepAsync]);

  return (
    <OnboardingLayout onStartVoice={startVoice}
      currentStep={2}
      totalSteps={7}
      ctaLabel="Continue"
      ctaVariant="inline"
      ctaDisabled={!plan}
      showVoiceButton
      onNext={handleNext}
      onBack={() => navigate('/onboarding/step-1')}
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
