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
      if (path.includes('simple') || path.includes('new') || path.includes('beginner')) {
        setPlan('simple');
      } else if (
        path.includes('brain') ||
        path.includes('advanced') ||
        path.includes('experience') ||
        path.includes('dump')
      ) {
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
      aiListeningPrompt="Let me know if you are new to habit tracking or already have experience with habit tracking"
      voiceOptions={['simple', 'brain dump', 'braindump', 'beginner', 'advanced']}
      voiceFileId="ONBOARD-02"
      voicePrompt="Quick question — have you tracked habits before, or is this new for you? Either way is great. I just want to know the best way to guide you. If you're new, I'll walk you through it step by step. If you've done this before, just tell me what you want and I'll organize it."
      onVoiceAction={handleVoiceAction}
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
