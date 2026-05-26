import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { track } from '@/analytics';
import { CategoryCard } from '@/components/onboarding/CategoryCard';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { useAgentNavigation } from '@/hooks/useAgentNavigation';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useOnboardingFormSnapshot } from '@/hooks/useOnboardingFormSnapshot';
import { type OnboardingVoiceResult } from '@/hooks/useOnboardingVoice';
import { useStepTiming } from '../shared/useStepTiming';

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

const CATEGORY_LABELS = categories.map((c) => c.label);

export function Step3Page() {
  const navigate = useNavigate();
  const { state: onboardingState, saveStepAsync } = useOnboarding();
  const [selected, setSelected] = useState<string | null>(null);

  useAgentNavigation(3, '/onboarding/step-4');
  const trackStepComplete = useStepTiming(5, 'improvement_areas', 'beginner');

  useEffect(() => {
    if (onboardingState?.data?.category) {
      setSelected(onboardingState.data.category as string);
    }
  }, [onboardingState?.data?.category]);

  const handleVoiceAction = useCallback((result: OnboardingVoiceResult) => {
    if (result.action !== 'select_option') return;
    const params = result.params as { fieldName?: string; value?: string };
    if (params.fieldName !== 'category' || typeof params.value !== 'string') return;
    const match = CATEGORY_LABELS.find((l) => l.toLowerCase() === params.value!.toLowerCase());
    if (match) setSelected(match);
  }, []);

  const snapshot = useOnboardingFormSnapshot({ category: selected ?? undefined });

  const handleNext = useCallback(async () => {
    if (!selected) return;
    await saveStepAsync(3, { category: selected });
    track('select_improvement_areas', {
      areas: [selected],
      area_count: 1,
    });
    trackStepComplete();
    navigate('/onboarding/step-4', { state: { category: selected } });
  }, [selected, navigate, saveStepAsync, trackStepComplete]);

  return (
    <OnboardingLayout
      currentStep={3}
      screenId="ONBOARD-BEGINNER-01"
      autoAdvance
      formSnapshot={snapshot}
      ctaLabel="Continue"
      ctaVariant="inline"
      onNext={handleNext}
      onBack={() => navigate('/onboarding/step-2')}
      ctaDisabled={!selected}
      showVoiceButton
      aiListeningPrompt='"What is the main category you would like to focus on?"'
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
