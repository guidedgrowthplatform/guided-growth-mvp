import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CategoryCard } from '@/components/onboarding/CategoryCard';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { useAgentNavigation } from '@/hooks/useAgentNavigation';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useOnboardingAgent } from '@/hooks/useOnboardingAgent';

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

export function Step3Page() {
  const navigate = useNavigate();
  const { state: onboardingState, saveStepAsync } = useOnboarding();
  const [selected, setSelected] = useState<string | null>(null);

  useOnboardingAgent('onboard_03');

  useAgentNavigation(3, '/onboarding/step-4');

  useEffect(() => {
    if (onboardingState?.data?.category) {
      setSelected(onboardingState.data.category as string);
    }
  }, [onboardingState?.data?.category]);

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
      ctaDisabled={!selected}
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
