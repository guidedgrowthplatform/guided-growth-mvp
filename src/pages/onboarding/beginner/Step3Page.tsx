import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CategoryCard } from '@/components/onboarding/CategoryCard';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { useAgentNavigation } from '@/hooks/useAgentNavigation';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useOnboardingAgent } from '@/hooks/useOnboardingAgent';
import { type OnboardingVoiceResult } from '@/hooks/useOnboardingVoice';

const categories = [
  { label: 'Sleep better', image: '/images/onboarding/sleep-better.png' },
  { label: 'Move more', image: '/images/onboarding/move-more.jpg' },
  { label: 'Eat better', image: '/images/onboarding/eat-better.png' },
  { label: 'Feel more energized', image: '/images/onboarding/feel-more-energized.png' },
  { label: 'Reduce stress', image: '/images/onboarding/reduce-stress.png' },
  { label: 'Improve focus', image: '/images/onboarding/improve-focus.jpg' },
  { label: 'Break bad habits', image: '/images/onboarding/break-bad-habits.png' },
  { label: 'Get more organized', image: '/images/onboarding/get-more-organized.png' },
];

const categoryLabels = categories.map((c) => c.label);

export function Step3Page() {
  const navigate = useNavigate();
  const { state: onboardingState, saveStepAsync } = useOnboarding();
  const [selected, setSelected] = useState<string | null>(null);

  useOnboardingAgent('onboard_03');

  // ONBOARD-03 → step-4 when the agent bumps current_step past 3
  // (per Voice System Impl Guide §2.5). State is pre-set to a category
  // by the agent's update_onboarding_data tool, so the page mount
  // already has the data needed — we just ride the Realtime edge.
  useAgentNavigation(3, '/onboarding/step-4');

  useEffect(() => {
    if (onboardingState?.data?.category) {
      setSelected(onboardingState.data.category as string);
    }
  }, [onboardingState?.data?.category]);

  const handleVoiceAction = useCallback((result: OnboardingVoiceResult) => {
    if (result.params && typeof result.params.category === 'string') {
      setSelected(result.params.category);
    }
  }, []);

  const handleNext = useCallback(async () => {
    await saveStepAsync(3, { category: selected });
    navigate('/onboarding/step-4', { state: { category: selected } });
  }, [selected, navigate, saveStepAsync]);

  return (
    <OnboardingLayout
      currentStep={3}
      totalSteps={7}
      ctaLabel="Continue"
      ctaVariant="inline"
      onNext={handleNext}
      onBack={() => navigate('/onboarding/step-2')}
      showVoiceButton
      aiListeningPrompt='"What is the main category you would like to focus on?"'
      ctaDisabled={!selected}
      voiceOptions={categoryLabels}
      voiceFileId="ONBOARD-03"
      voicePrompt="So — what feels most worth improving right now? Don't overthink it. There's no wrong answer. Just pick the one that pulls you."
      onVoiceAction={handleVoiceAction}
    >
      <OnboardingHeader
        title="What feels most worth improving right now?"
        subtitle="Pick one area to start. You can always add more later."
      />
      <div className="grid grid-cols-2 gap-[16px]">
        {categories.map((c) => (
          <CategoryCard
            key={c.label}
            image={c.image}
            label={c.label}
            selected={selected === c.label}
            onSelect={() => setSelected(c.label)}
          />
        ))}
      </div>
    </OnboardingLayout>
  );
}
