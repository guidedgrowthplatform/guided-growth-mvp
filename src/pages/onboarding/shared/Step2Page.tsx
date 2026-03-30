import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { SelectionCard } from '@/components/onboarding/SelectionCard';
import { useOnboarding } from '@/hooks/useOnboarding';
import { type OnboardingVoiceResult } from '@/hooks/useOnboardingVoice';

export function Step2Page() {
  const navigate = useNavigate();
  const { state: onboardingState, saveStepAsync } = useOnboarding();
  const [plan, setPlan] = useState<'simple' | 'braindump' | null>(null);

  useEffect(() => {
    if (onboardingState?.path) {
      setPlan(onboardingState.path as 'simple' | 'braindump');
    }
  }, [onboardingState?.path]);

  const handleVoiceAction = useCallback((result: OnboardingVoiceResult) => {
    if (result.params && typeof result.params.path === 'string') {
      const path = result.params.path.toLowerCase();
      if (path.includes('simple')) {
        setPlan('simple');
      } else if (path.includes('brain') || path.includes('advanced')) {
        setPlan('braindump');
      }
    }
  }, []);

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
      showVoiceButton
      aiListeningPrompt={'"select which plan you want to have?"'}
      voiceOptions={['simple', 'brain dump', 'braindump', 'beginner', 'advanced']}
      voicePrompt="Which plan would you like?"
      onVoiceAction={handleVoiceAction}
    >
      <OnboardingHeader
        title="Let's build your plan."
        subtitle="How would you like to set up your habits today?"
      />
      <div className="flex flex-col gap-[20px]">
        <SelectionCard
          icon="ic:outline-explore"
          iconBg="rgba(19,91,236,0.1)"
          iconColor="#135bec"
          title="Beginner user"
          description="Start with a few recommended habits"
          selected={plan === 'simple'}
          onSelect={() => setPlan('simple')}
        />
        <SelectionCard
          icon="ic:round-mic"
          iconBg="#f5f3ff"
          iconColor="#7c3aed"
          title="Advanced user"
          description="Tell me everything you want to achieve, and I'll organize it"
          selected={plan === 'braindump'}
          onSelect={() => setPlan('braindump')}
          showSparkle
        />
      </div>
    </OnboardingLayout>
  );
}
