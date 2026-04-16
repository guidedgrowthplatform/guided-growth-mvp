import { Icon } from '@iconify/react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { GoalCard } from '@/components/onboarding/GoalCard';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { goalsByCategory } from '@/data/onboardingHabits';
import { SUBCATEGORY_RESPONSES } from '@/data/subcategoryResponses';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useOnboardingRealtimeScreen } from '@/hooks/useOnboardingRealtimeScreen';
import { speak } from '@/lib/services/tts-service';

export function Step4Page() {
  const navigate = useNavigate();
  const location = useLocation();
  const { state: onboardingState, saveStepAsync } = useOnboarding();
  const category = (location.state as { category?: string })?.category ?? 'Sleep better';
  const goals = goalsByCategory[category] ?? goalsByCategory['Sleep better'];
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (onboardingState?.data?.goals && Array.isArray(onboardingState.data.goals)) {
      setSelected(new Set(onboardingState.data.goals as string[]));
    }
  }, [onboardingState?.data?.goals]);

  function toggleGoal(goal: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(goal)) {
        next.delete(goal);
      } else if (next.size < 2) {
        next.add(goal);
      }
      return next;
    });
  }

  useOnboardingRealtimeScreen({
    screen: 'onboard_04',
    onFieldCaptured: (field, value) => {
      if (field !== 'subcategory' && field !== 'goals') return;
      // Value may be comma-separated if multiple goals
      const spoken = value.toLowerCase();
      const matched = new Set<string>();
      for (const g of goals) {
        if (spoken.includes(g.toLowerCase())) matched.add(g);
      }
      if (matched.size > 0) setSelected(matched);
    },
    onNavigate: async (dest) => {
      const firstGoal = Array.from(selected)[0];
      const response = firstGoal ? SUBCATEGORY_RESPONSES[firstGoal] : null;
      if (response) speak(response);
      await saveStepAsync(4, { goals: Array.from(selected) });
      window.setTimeout(
        () =>
          navigate(dest ?? '/onboarding/step-5', {
            state: { goals: Array.from(selected), category },
            replace: true,
          }),
        response ? 1500 : 400,
      );
    },
  });

  const handleNext = useCallback(async () => {
    const firstGoal = Array.from(selected)[0];
    const response = firstGoal ? SUBCATEGORY_RESPONSES[firstGoal] : null;
    if (response) speak(response);

    await saveStepAsync(4, { goals: Array.from(selected) });
    setTimeout(
      () => {
        navigate('/onboarding/step-5', { state: { goals: Array.from(selected), category } });
      },
      response ? 1500 : 0,
    );
  }, [selected, category, navigate, saveStepAsync]);

  return (
    <OnboardingLayout
      currentStep={4}
      totalSteps={9}
      ctaLabel="Continue"
      ctaVariant="inline"
      onNext={handleNext}
      onBack={() => navigate('/onboarding/step-3')}
      ctaDisabled={selected.size === 0}
    >
      <OnboardingHeader
        title="Let's narrow it down"
        subtitle={`Choose 1 or 2 specific goals to help you ${category.toLowerCase()}`}
      />
      <div className="inline-flex items-center gap-1 rounded-[10px] bg-surface px-2 py-1">
        <Icon icon="iconamoon:category" width={24} height={24} className="text-content" />
        <span className="text-[16px] font-bold leading-[24px] text-content">Category:</span>
        <span className="text-[16px] font-bold leading-[24px] text-content">{category}</span>
      </div>
      <div className="flex flex-col gap-[16px]">
        {goals.map((g) => (
          <GoalCard
            key={g}
            label={g}
            selected={selected.has(g)}
            disabled={!selected.has(g) && selected.size >= 2}
            onToggle={() => toggleGoal(g)}
          />
        ))}
      </div>
    </OnboardingLayout>
  );
}
