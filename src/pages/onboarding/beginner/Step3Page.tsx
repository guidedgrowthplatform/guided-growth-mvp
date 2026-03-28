import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CategoryCard } from '@/components/onboarding/CategoryCard';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { type OnboardingVoiceResult } from '@/hooks/useOnboardingVoice';

const categories = [
  { label: 'Sleep better', emoji: '😴' },
  { label: 'Move more', emoji: '🏃' },
  { label: 'Eat better', emoji: '🥗' },
  { label: 'Feel more energized', emoji: '⚡' },
  { label: 'Reduce stress', emoji: '🧘' },
  { label: 'Improve focus', emoji: '🎯' },
  { label: 'Break bad habits', emoji: '🚫' },
  { label: 'Get more organized', emoji: '📋' },
];

const categoryLabels = categories.map((c) => c.label);

export function Step3Page() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string | null>(null);

  const handleVoiceAction = useCallback((result: OnboardingVoiceResult) => {
    if (result.params && typeof result.params.category === 'string') {
      setSelected(result.params.category);
    }
  }, []);

  const handleNext = useCallback(() => {
    navigate('/onboarding/step-4', { state: { category: selected } });
  }, [selected, navigate]);

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
      voicePrompt="Which category interests you most?"
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
            emoji={c.emoji}
            label={c.label}
            selected={selected === c.label}
            onSelect={() => setSelected(c.label)}
          />
        ))}
      </div>
    </OnboardingLayout>
  );
}
