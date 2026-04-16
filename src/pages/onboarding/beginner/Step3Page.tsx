import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CategoryCard } from '@/components/onboarding/CategoryCard';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { CATEGORY_RESPONSES } from '@/data/categoryResponses';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useOnboardingRealtimeScreen } from '@/hooks/useOnboardingRealtimeScreen';
import { speak } from '@/lib/services/tts-service';

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

function matchCategory(spoken: string): string | null {
  const s = spoken.toLowerCase();
  for (const c of categories) {
    if (s.includes(c.label.toLowerCase())) return c.label;
  }
  if (s.includes('sleep')) return 'Sleep better';
  if (s.includes('move') || s.includes('exercise') || s.includes('fit')) return 'Move more';
  if (s.includes('eat') || s.includes('food') || s.includes('nutrition')) return 'Eat better';
  if (s.includes('energy') || s.includes('energiz')) return 'Feel more energized';
  if (s.includes('stress') || s.includes('anxious') || s.includes('anxiety'))
    return 'Reduce stress';
  if (s.includes('focus') || s.includes('concentrat')) return 'Improve focus';
  if (s.includes('break') || s.includes('bad habit') || s.includes('quit'))
    return 'Break bad habits';
  if (s.includes('organi')) return 'Get more organized';
  return null;
}

export function Step3Page() {
  const navigate = useNavigate();
  const { state: onboardingState, saveStepAsync } = useOnboarding();
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (onboardingState?.data?.category) {
      setSelected(onboardingState.data.category as string);
    }
  }, [onboardingState?.data?.category]);

  useOnboardingRealtimeScreen({
    screen: 'onboard_03',
    onFieldCaptured: (field, value) => {
      if (field !== 'category') return;
      const matched = matchCategory(value);
      if (matched) setSelected(matched);
    },
    onNavigate: async (dest) => {
      const response = selected ? CATEGORY_RESPONSES[selected] : null;
      if (response) speak(response);
      await saveStepAsync(3, { category: selected });
      window.setTimeout(
        () =>
          navigate(dest ?? '/onboarding/step-4', { state: { category: selected }, replace: true }),
        response ? 1500 : 400,
      );
    },
  });

  const handleNext = useCallback(async () => {
    const response = selected ? CATEGORY_RESPONSES[selected] : null;
    if (response) speak(response);

    await saveStepAsync(3, { category: selected });
    setTimeout(
      () => {
        navigate('/onboarding/step-4', { state: { category: selected } });
      },
      response ? 1500 : 0,
    );
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
